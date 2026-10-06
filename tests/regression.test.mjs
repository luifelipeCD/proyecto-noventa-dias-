import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const worker = await import('data:text/javascript;base64,' + Buffer.from(source + '\nexport { appBaseURL, firmarSesion };').toString('base64'));
const request = (path, options = {}) => new Request('https://worker.example' + path, { ...options, headers: { Origin: 'https://luifelipecd.github.io', ...options.headers } });

function memoryDB() {
  const progress = new Map();
  return { progress, prepare(sql) { return { bind(...args) { return {
    async first() {
      if (sql.includes('FROM users')) return { id: args[0], email: 'demo@example.com', stripe_customer_id: 'cus_test', subscription_status: 'none' };
      return progress.get(args[0]) || null;
    },
    async run() {
      if (sql.startsWith('INSERT INTO user_progress')) {
        if (progress.has(args[0])) return { meta: { changes: 0 } };
        progress.set(args[0], { data: args[1], revision: 1 });
      } else if (sql.startsWith('UPDATE user_progress')) {
        const row = progress.get(args[1]);
        if (!row || row.revision !== args[2]) return { meta: { changes: 0 } };
        progress.set(args[1], { data: args[0], revision: row.revision + 1 });
      }
      return { meta: { changes: 1 } };
    }
  }; } }; } };
}

async function authenticated(path, env, { user = 1, method = 'GET', body } = {}) {
  const token = await worker.firmarSesion({ sub: user, exp: Date.now() + 10000 }, env.SESSION_SECRET);
  return worker.default.fetch(request(path, { method, headers: { Authorization: 'Bearer ' + token }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
}

test('correo y pagos conservan la carpeta de GitHub Pages y permiten localhost', () => {
  assert.equal(worker.appBaseURL(request('/'), {}), 'https://luifelipecd.github.io/proyecto-noventa-dias-/');
  assert.equal(worker.appBaseURL(request('/', { headers: { Origin: 'http://localhost:8000' } }), {}), 'http://localhost:8000/');
  assert.equal(worker.appBaseURL(request('/'), { APP_URL: 'https://luifelipecd.github.io/otra-app' }), 'https://luifelipecd.github.io/otra-app/');
  assert.equal(worker.appBaseURL(request('/'), { APP_URL: 'https://untrusted.example/' }), 'https://luifelipecd.github.io/proyecto-noventa-dias-/');
});

test('sin correo configurado producción no devuelve un enlace que permita iniciar sesión', async () => {
  const response = await worker.default.fetch(request('/auth/solicitar-link', { method: 'POST', body: JSON.stringify({ email: 'demo@example.com' }) }), { DB: memoryDB(), DEV_MODE: 'true' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).dev_link, undefined);
});

test('copias privadas: aislamiento, actualización y conflicto entre dispositivos', async () => {
  const env = { DB: memoryDB(), SESSION_SECRET: 'test-only' };
  assert.equal((await authenticated('/progreso', env, { method: 'PUT', body: { data: { rp90_pesos: [{ semana: 1, peso: 80 }] }, revision: 0 } })).status, 200);
  assert.equal((await authenticated('/progreso', env, { method: 'PUT', body: { data: { rp90_pesos: [] }, revision: 0 } })).status, 409);
  assert.equal((await (await authenticated('/progreso', env, { user: 2 })).json()).data, null);
  assert.equal((await authenticated('/progreso', env, { method: 'PUT', body: { data: { rp90_pesos: [] }, revision: 1 } })).status, 200);
  assert.equal((await (await authenticated('/progreso', env)).json()).revision, 2);
  assert.equal((await authenticated('/progreso', env, { method: 'PUT', body: { data: { rp90_sesion: 'token' }, revision: 2 } })).status, 400);
  assert.equal((await worker.default.fetch(request('/progreso'), env)).status, 401);
});

test('portal Stripe usa el cliente autenticado y regresa a la aplicación', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => { sent = { url, body: new URLSearchParams(options.body) }; return new Response(JSON.stringify({ url: 'https://billing.stripe.com/test' })); });
  const response = await authenticated('/billing/portal', { DB: memoryDB(), SESSION_SECRET: 'test-only', STRIPE_SECRET_KEY: 'test-only' }, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.equal(sent.body.get('customer'), 'cus_test');
  assert.equal(sent.body.get('return_url'), 'https://luifelipecd.github.io/proyecto-noventa-dias-/');
});

test('un webhook fallido permite que Stripe reintente', async (t) => {
  let released = false;
  const event = { id: 'evt_test', type: 'checkout.session.completed', data: { object: { customer: 'cus_test', subscription: 'sub_test' } } };
  const body = JSON.stringify(event), stamp = String(Math.floor(Date.now() / 1000)), secret = 'test-only';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stamp + '.' + body))).toString('hex');
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('fallo simulado de Stripe'); });
  const DB = { prepare(sql) { return { bind() { return { async run() { if (sql.startsWith('DELETE')) released = true; return { meta: { changes: 1 } }; } }; } }; } };
  const response = await worker.default.fetch(request('/billing/webhook', { method: 'POST', body, headers: { 'Stripe-Signature': 't=' + stamp + ',v1=' + signature } }), { DB, STRIPE_WEBHOOK_SECRET: secret, STRIPE_SECRET_KEY: secret });
  assert.equal(response.status, 503); assert.equal(released, true);
});

function swHarness() {
  const handlers = {}, puts = [], deletes = [];
  const cache = { match: async () => undefined, put: async (key) => puts.push(typeof key === 'string' ? key : key.url) };
  const scope = { self: { location: { href: 'https://app.example/proyecto/sw.js', origin: 'https://app.example' }, addEventListener: (type, fn) => handlers[type] = fn, clients: { claim: async () => {} } }, caches: { match: async () => undefined, open: async () => cache, keys: async () => ['another-app', 'transforma90-old'], delete: async (key) => deletes.push(key) }, fetch: async () => new Response('image', { headers: { 'Content-Type': 'image/jpeg' } }), URL, Promise };
  vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), scope);
  return { handlers, puts, deletes, scope };
}

test('abrir una foto no reemplaza el HTML utilizado sin conexión', async () => {
  const h = swHarness(); let response;
  h.handlers.fetch({ request: { url: 'https://app.example/proyecto/assets/exercises/photo.jpg', method: 'GET', mode: 'navigate' }, respondWith: (p) => response = p });
  await response; await Promise.resolve();
  assert.equal(h.puts.includes('./index.html'), false);
});

test('la caché no guarda errores como página principal ni elimina cachés ajenas', async () => {
  const h = swHarness(); let response, activation;
  h.scope.fetch = async () => new Response('not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
  h.handlers.fetch({ request: { url: 'https://app.example/proyecto/', method: 'GET', mode: 'navigate' }, respondWith: (p) => response = p });
  await response; assert.equal(h.puts.length, 0);
  h.handlers.activate({ waitUntil: p => activation = p }); await activation;
  assert.deepEqual(h.deletes, ['transforma90-old']);
});

test('el calendario conserva la fecha local de Ecuador después de las 19:00', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const fn = html.slice(html.indexOf('function fechaLocalISO'), html.indexOf('function diasEntre'));
  const result = spawnSync(process.execPath, ['-e', fn + "console.log(fechaLocalISO(new Date('2026-10-06T02:00:00Z')));"], { env: { ...process.env, TZ: 'America/Guayaquil' }, encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout.trim(), '2026-10-05');
});

test('las fotos incluidas en la caché existen y todos los scripts son válidos', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const images = [...sw.matchAll(/'\.\/(assets\/exercises-webp\/[^']+\.webp)'/g)]; assert.equal(images.length, 52);
  for (const [, path] of images) assert.equal(existsSync(new URL('../' + path, import.meta.url)), true);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script);
});

test('una copia mal formada no puede romper la aplicación al restaurarse', async () => {
  const env = { DB: memoryDB(), SESSION_SECRET: 'test-only' };
  for (const data of [
    { rp90_pesos: 'invalid' },
    { rp90_plan: { calorias: '<script>' } },
    { rp90_mov: [42] },
    { rp90_ejercicios_hechos: { '2026-01-01': { dia: 7, hechos: [0] } } }, // día de rutina fuera de 0-6
    { rp90_ejercicios_hechos: { '2026-01-01': { dia: 2, hechos: ['x'] } } }, // índice de ejercicio no numérico
    { rp90_datos: { peso: 70, altura: 170, edad: 30, actividad: 1.375, genero: 'hombre', dieta: 'vegana-falsa' } }, // preferencia inválida
  ]) {
    const response = await authenticated('/progreso', env, { method: 'PUT', body: { data, revision: 0 } });
    assert.equal(response.status, 400);
  }
});

test('el progreso acepta ejercicios marcados como hechos y una preferencia alimentaria válida', async () => {
  const env = { DB: memoryDB(), SESSION_SECRET: 'test-only' };
  const data = {
    rp90_ejercicios_hechos: { '2026-01-01': { dia: 2, hechos: [0, 1, 3] } },
    rp90_datos: { peso: 70, altura: 170, edad: 30, actividad: 1.375, genero: 'hombre', dieta: 'vegetariana' },
  };
  const response = await authenticated('/progreso', env, { method: 'PUT', body: { data, revision: 0 } });
  assert.equal(response.status, 200);
});

test('GET /config expone solo disponibilidad (booleanos), nunca claves, y no requiere sesión', async () => {
  let response = await worker.default.fetch(request('/config'), {
    DB: memoryDB(), SESSION_SECRET: 'test-only', RESEND_FROM: 'test@example.com', TURNSTILE_SECRET_KEY: 'test-only', STRIPE_WEBHOOK_SECRET: 'test-only',
    RESEND_API_KEY: 'x', ANTHROPIC_API_KEY: 'y', STRIPE_SECRET_KEY: 'z',
    STRIPE_PRICE_MENSUAL: 'price_1', STRIPE_PRICE_ANUAL: 'price_2',
  });
  assert.equal(response.status, 200);
  let data = await response.json();
  assert.deepEqual(data, { ok: true, disponible: { correo: true, generacionIA: true, pagos: { mensual: true, anual: true } } });

  response = await worker.default.fetch(request('/config'), {});
  data = await response.json();
  assert.deepEqual(data.disponible, { correo: false, generacionIA: false, pagos: { mensual: false, anual: false } });

  // Stripe configurado pero falta el precio del plan anual: ese plan no cuenta como disponible.
  response = await worker.default.fetch(request('/config'), { DB: memoryDB(), SESSION_SECRET: 'test-only', STRIPE_WEBHOOK_SECRET: 'test-only', STRIPE_SECRET_KEY: 'z', STRIPE_PRICE_MENSUAL: 'price_1' });
  data = await response.json();
  assert.equal(data.disponible.pagos.mensual, true);
  assert.equal(data.disponible.pagos.anual, false);
  assert.equal(JSON.stringify(data).includes('price_1'), false); // nunca se devuelve el valor, solo el booleano
});

test('el generador de IA recibe la preferencia alimentaria y la aplica sin tratarla como alergia', async (t) => {
  let capturedSystem = '';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    capturedSystem = JSON.parse(options.body).system;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      nombre: 'Bowl vegano', categoria: 'comida', dieta: 'vegana', kcal: 400, proteina: 25, carbos: 40, grasa: 12,
      ingredientes: ['tofu', 'arroz'], pasos: ['Cocinar todo junto.'],
    }) }] }));
  });
  const db = { prepare(sql) { return { bind(...args) { return { async first() {
    if (sql.includes('FROM users')) return { id: args[0], subscription_status: 'active' };
    return null;
  } }; } }; } };
  const env = { DB: db, SESSION_SECRET: 'test-only', ANTHROPIC_API_KEY: 'test-key' };
  const response = await authenticated('/', env, { method: 'POST', body: { ingredientes: ['tofu'], turnstileToken: 'x', dieta: 'vegana' } });
  assert.equal(response.status, 200);
  assert.ok(capturedSystem.includes('VEGANA'));
  assert.ok(capturedSystem.includes('preferencia declarada'));
  assert.ok(capturedSystem.toLowerCase().includes('no un diagnóstico de alergia') || capturedSystem.toLowerCase().includes('no la presentes como tal'));
});

test('las 15 fotos de comida tienen archivo local y créditos', () => {
  const credits = JSON.parse(readFileSync(new URL('../assets/recipes/sources.json', import.meta.url), 'utf8'));
  assert.equal(credits.length, 15);
  for (const info of credits) {
    assert.ok(info.artist && info.license && info.page);
    assert.equal(existsSync(new URL('../assets/recipes/' + info.localFile, import.meta.url)), true);
  }
});

test('el menú de 90 días respeta la preferencia alimentaria en cada dieta y los datos antiguos sin dieta usan omnívora', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const recetasSrc = html.slice(html.indexOf('const RECETAS = ['), html.indexOf('\n];', html.indexOf('const RECETAS = [')) + 3);
  const dietaSrc = html.slice(html.indexOf('const DIETAS = ['), html.indexOf('// ---------- Fórmula del plan'));
  const menuSrc = html.slice(html.indexOf('const MEAL_PCT = '), html.indexOf('// Índice (0-89)'));
  const driver = `
    ${recetasSrc}
    ${dietaSrc}
    ${menuSrc}
    let plan = { calorias: 2000, proteina: 150, carbos: 200, grasa: 60 };
    let objetivo = 'bajar';
    let intensidad = 0.25;
    let dieta;
    let planStart = null;
    const LS = { planDias: 'x', planStart: 'y' };
    function lsSet(){}
    function hoyISO(){ return '2026-01-01'; }
    const resultados = ['omnivora','vegetariana','vegana'].map(d => {
      dieta = d;
      const dias = generarPlanDias(90);
      const permitido = new Set(recetasParaDieta(d).map(r => r.id));
      const ok = dias.length === 90 && dias.every(day => ['desayuno','almuerzo','cena','merienda'].every(m => permitido.has(day[m])));
      return { dieta: d, ok };
    });
    const datosViejos = { peso: 70, altura: 170, edad: 30, genero: 'hombre', actividad: 1.375 }; // sin campo "dieta"
    let dietaRestaurada = 'omnivora';
    if (datosViejos && ['omnivora','vegetariana','vegana'].includes(datosViejos.dieta)) dietaRestaurada = datosViejos.dieta;
    console.log(JSON.stringify({ resultados, dietaRestaurada }));
  `;
  const result = spawnSync(process.execPath, ['-e', driver], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout.trim());
  for (const r of out.resultados) assert.equal(r.ok, true, `la dieta "${r.dieta}" tiene platillos fuera de la preferencia en alguno de los 90 días`);
  assert.equal(out.dietaRestaurada, 'omnivora');
});

test('la lista de compras agrupa los próximos días sumando gramos y respeta el final del programa', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ingNombreSrc = html.slice(html.indexOf('function ingNombre'), html.indexOf('function ingTexto'));
  const normalizaSrc = html.slice(html.indexOf('function normaliza(s){'), html.indexOf('// Ingredientes base que vale la pena cocinar por lote'));
  const mealOrderSrc = html.slice(html.indexOf('const MEAL_ORDER'), html.indexOf(';', html.indexOf('const MEAL_ORDER')) + 1);
  const listaSrc = html.slice(html.indexOf('function diasRestantesParaLista'), html.indexOf('let listaComprasTexto'));
  const driver = `
    ${ingNombreSrc}
    ${normalizaSrc}
    ${mealOrderSrc}
    ${listaSrc}
    const planDias = Array.from({ length: 90 }, () => ({ desayuno: 1, almuerzo: 2, cena: 3, merienda: 4 }));
    const recetaFn = () => ({ ingredientes: [{ n: 'Pollo', g: 100 }, { n: 'Arroz', g: 50 }] });
    const diasDesdeHoy = diasRestantesParaLista(90, 0, 7);
    const items = agregarIngredientesDias(planDias, 0, diasDesdeHoy, recetaFn);
    const cercaDelFinal = diasRestantesParaLista(90, 88, 7); // "día 88" del programa
    const enElUltimoDia = diasRestantesParaLista(90, 89, 7);
    console.log(JSON.stringify({
      diasDesdeHoy, cercaDelFinal, enElUltimoDia,
      totalPollo: items.find(x => x.nombre === 'Pollo').g,
      totalItems: items.length,
    }));
  `;
  const result = spawnSync(process.execPath, ['-e', driver], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout.trim());
  assert.equal(out.diasDesdeHoy, 7);
  assert.equal(out.cercaDelFinal, 2); // quedan 2 días del programa de 90
  assert.equal(out.enElUltimoDia, 1); // último día: no se piden 7 días de más
  assert.equal(out.totalItems, 2);
  assert.equal(out.totalPollo, 7 * 4 * 100); // 7 días × 4 comidas × 100 g, sin duplicar por ingrediente
});
