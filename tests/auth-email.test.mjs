import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const worker = await import('data:text/javascript;base64,' + Buffer.from(source + '\nexport { enviarCorreo };').toString('base64'));
const origin = 'https://luifelipecd.github.io';
const request = (path, body, customOrigin = origin) => new Request('https://worker.example' + path, {
  headers: { Origin: customOrigin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
});

function accountDB() {
  const links = new Map(), users = new Map();
  return { links, prepare(sql) { return { bind(...args) { return {
    async first() {
      if(sql.includes('FROM magic_links')) return links.get(args[0]) || null;
      if(sql.includes('FROM users')) return users.get(args[0]) || [...users.values()].find(u => u.id === args[0]) || null;
      throw new Error('Consulta inesperada');
    },
    async run() {
      if(sql.startsWith('INSERT INTO magic_links')) links.set(args[0], { email: args[1], created_at: args[2], expires_at: args[3], used_at: null });
      else if(sql.startsWith('DELETE FROM magic_links')) links.delete(args[0]);
      else if(sql.startsWith('INSERT OR IGNORE INTO users')) {
        if(!users.has(args[0])) users.set(args[0], { id: users.size + 1, email: args[0], subscription_status: 'none' });
      } else if(sql.startsWith('UPDATE magic_links')) {
        const row = links.get(args[1]);
        if(!row || row.used_at !== null) return { meta: { changes: 0 } };
        row.used_at = args[0];
      } else throw new Error('Escritura inesperada');
      return { meta: { changes: 1 } };
    },
  }; } }; } };
}
function environment() {
  const kv = new Map();
  return { DB: accountDB(), SESSION_SECRET: 'test-only', RESEND_API_KEY: 'test-only', RESEND_FROM: 'noventa <acceso@example.com>',
    RATE_LIMIT: { get: async key => kv.get(key), put: async (key, value) => kv.set(key, value) }, kv,
  };
}

test('un rechazo de correo no afirma enviado, borra su token y permite reintentar', async t => {
  const env = environment();
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async () => { attempts++; return new Response(JSON.stringify({ message: 'detalle privado del proveedor' }), { status: 403 }); });
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const response = await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.enviado, undefined);
  assert.equal(body.dev_link, undefined);
  assert.equal(env.DB.links.size, 0);
  assert.equal(env.kv.size, 1); // solo el límite separado de intentos, no la cuota de envíos
  assert.ok([...env.kv.keys()][0].includes('intentos'));
  assert.ok(!JSON.stringify(logs).includes('detalle privado'));
  assert.ok(!JSON.stringify(logs).includes('persona@example.com'));
  assert.equal((await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env)).status, 503);
  assert.equal(attempts, 2);
});

test('los fallos repetidos del proveedor también tienen un límite de intentos', async t => {
  let calls = 0;
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}', { status: 403 }); });
  const env = environment();
  for(let i=0; i<20; i++) assert.equal((await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env)).status, 503);
  assert.equal((await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env)).status, 429);
  assert.equal(calls, 20);
});

test('una respuesta sin confirmación del proveedor tampoco muestra enviado', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  t.mock.method(console, 'error', () => {});
  const response = await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), environment());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});

test('falta de sesión, remitente o dominio de pruebas impide enviar en producción', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}'); });
  for (const missing of ['SESSION_SECRET', 'RESEND_API_KEY', 'RESEND_FROM']) {
    const env = environment(); delete env[missing];
    const response = await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env);
    assert.equal(response.status, 503, missing);
    assert.equal((await response.json()).dev_link, undefined);
  }
  for (const from of ['noventa <onboarding@resend.dev>', 'acceso@example.com\r\nBcc:x@example.com']) {
    const env = environment(); env.RESEND_FROM = from;
    assert.equal((await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env)).status, 503);
    assert.equal((await (await worker.default.fetch(request('/config'), env)).json()).disponible.correo, false);
  }
  assert.equal(calls, 0);
});

test('el correo aceptado abre una cuenta y el enlace no se puede reutilizar', async t => {
  let mail;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails'); mail = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'test-delivery-id' }));
  });
  const env = environment();
  const response = await worker.default.fetch(request('/auth/solicitar-link', { email: ' Persona@example.com ' }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).enviado, true);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(mail.to[0], 'persona@example.com');
  assert.equal(mail.from, env.RESEND_FROM);
  const link = mail.text.match(/https:\/\/[^\s]+/)[0];
  const token = new URL(link).searchParams.get('login_token');
  assert.equal(new URL(link).pathname, '/proyecto-noventa-dias-/');
  assert.ok(!env.DB.links.has(token)); // solo se almacena el hash
  const login = await worker.default.fetch(request('/auth/verificar?token=' + token), env);
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(session.email, 'persona@example.com');
  assert.ok(session.token);
  assert.equal((await worker.default.fetch(request('/auth/verificar?token=' + token), env)).status, 400);
  const me = await worker.default.fetch(new Request('https://worker.example/me', { headers: { Origin: origin, Authorization: 'Bearer ' + session.token } }), env);
  assert.equal(me.status, 200);
  assert.equal((await me.json()).email, 'persona@example.com');
});

test('un enlace caducado y el límite de envíos no se confunden con un envío exitoso', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ id: 'test-id' })));
  const env = environment();
  for(let i=0; i<3; i++) assert.equal((await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env)).status, 200);
  const limited = await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal((await limited.json()).ok, false);
  const first = [...env.DB.links.entries()][0]; first[1].expires_at = Date.now() - 1;
  // Un token cuyo hash existe pero está caducado nunca genera una sesión.
  env.DB.links.set(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('test-expired')).then(b => Buffer.from(b).toString('hex')), first[1]);
  assert.equal((await worker.default.fetch(request('/auth/verificar?token=test-expired'), env)).status, 400);
});

test('el enlace de desarrollo solo existe con modo local explícito', async () => {
  const env = environment(); delete env.RESEND_API_KEY; env.DEV_MODE = 'true';
  const response = await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }, 'http://localhost:8000'), env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.enviado, false);
  assert.ok(data.dev_link.startsWith('http://localhost:8000/?login_token='));
  assert.equal((await worker.default.fetch(request('/auth/solicitar-link', { email: 'persona@example.com' }), env)).status, 503);
});

test('el envío deja de esperar cuando el proveedor no responde', async t => {
  let timeoutMs;
  t.mock.method(globalThis, 'setTimeout', (cb, ms) => { timeoutMs = ms; return setImmediate(cb); });
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelado', 'AbortError')), { once: true })));
  const result = await worker.enviarCorreo(environment(), 'persona@example.com', 'Prueba', '<p>Prueba</p>');
  assert.equal(result.ok, false);
  assert.equal(timeoutMs, 10000);
});

function frontendHarness(payload, status=200) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const nodes = { 'auth-email': { value: 'persona@example.com' }, 'auth-enviar': { disabled: false }, 'auth-estado': { innerHTML: '' }, 'auth-modal-body': { innerHTML: '' }, 'auth-disponibilidad': { innerHTML: '' } };
  const scope = { document: { getElementById: id => nodes[id] }, disponibilidad: { correo: true }, disponibilidadError: false,
    location: { hostname: 'luifelipecd.github.io' }, IA_WORKER_URL: 'https://worker.example', AbortController, setTimeout, clearTimeout,
    authShell: s => s, MAIL_ICON: '', esc: s => String(s).replaceAll('<','&lt;'),
    fetch: async () => new Response(JSON.stringify(payload), { status }),
  };
  vm.runInNewContext(html.slice(html.indexOf('let envioLinkPendiente = false;'), html.indexOf('function authCuentaHTML(){')), scope);
  vm.runInNewContext(html.slice(html.indexOf('async function solicitarLink(){'), html.indexOf('function cerrarSesion(){')), scope);
  return { scope, nodes };
}

test('la pantalla rechaza confirmaciones antiguas o errores y vuelve a habilitar el botón', async () => {
  for(const [payload, status] of [[{ok:true},200],[{ok:false,error:'No se pudo enviar'},503],[{ok:true,dev_link:'https://example.com'},200]]) {
    const { scope, nodes } = frontendHarness(payload,status);
    await scope.solicitarLink();
    assert.equal(nodes['auth-modal-body'].innerHTML, '');
    assert.ok(nodes['auth-estado'].innerHTML.includes('is-error'));
    assert.equal(nodes['auth-enviar'].disabled, false);
    assert.equal(nodes['auth-email'].value, 'persona@example.com');
  }
  const { scope, nodes } = frontendHarness({ok:true,enviado:true});
  await scope.solicitarLink();
  assert.ok(nodes['auth-modal-body'].innerHTML.includes('Revisa tu correo'));
});

test('actualizar disponibilidad conserva el correo escrito y bloquea envíos no disponibles', () => {
  const { scope, nodes } = frontendHarness({ok:true,enviado:true});
  scope.disponibilidad = null;
  scope.actualizarDisponibilidadAuth();
  assert.equal(nodes['auth-enviar'].disabled, true);
  scope.disponibilidad = { correo: true };
  scope.actualizarDisponibilidadAuth();
  assert.equal(nodes['auth-enviar'].disabled, false);
  assert.equal(nodes['auth-email'].value, 'persona@example.com');
});
