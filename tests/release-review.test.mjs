import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const worker = await import('data:text/javascript;base64,' + Buffer.from(source + '\nexport { progresoValido };').toString('base64'));
function slice(start, end) { return html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start))); }

test('una cuenta antes activa no desbloquea premium si falla la verificación', () => {
  const scope = { cuenta: { subscription: { status: 'active' } }, cuentaVerificacionError: true };
  vm.runInNewContext(slice('function tienePremium(){', 'function fmtFechaCorta'), scope);
  assert.equal(scope.tienePremium(), false);
  scope.cuentaVerificacionError = false;
  assert.equal(scope.tienePremium(), true);
});

test('la solicitud de IA incluye la sesión y escapa los errores recibidos', async () => {
  const elements = Object.fromEntries(['ia-estado','ia-resultado','ia-generar'].map(id => [id, { innerHTML: '', disabled: false }]));
  let sent;
  const scope = {
    document: { getElementById: id => elements[id] }, favIng: ['tofu'], dieta: 'vegana',
    IA_WORKER_URL: 'https://example.com', sesion: { token: 'test-session' }, tienePremium: () => true,
    disponibilidad: { generacionIA: true }, disponibilidadError: false,
    window: { turnstileToken: 'test-captcha' },
    esc: s => String(s).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    fetch: async (url, options) => { sent = options; return { ok: false, status: 401, json: async () => ({ error: '<img src=x onerror=alert(1)>' }) }; },
  };
  const start = html.indexOf('async function generarRecetaIA(){');
  const end = html.indexOf('\n}', start) + 2;
  vm.runInNewContext(html.slice(start, end), scope);
  await scope.generarRecetaIA();
  assert.equal(sent.headers.Authorization, 'Bearer test-session');
  assert.equal(JSON.parse(sent.body).dieta, 'vegana');
  assert.ok(elements['ia-estado'].innerHTML.includes('&lt;img'));
  assert.ok(!elements['ia-estado'].innerHTML.includes('<img'));
  assert.equal(elements['ia-generar'].disabled, false);
  sent = undefined;
  scope.sesion = null;
  await scope.generarRecetaIA();
  assert.equal(sent, undefined);
});

test('marcar otra rutina conserva los ejercicios de la misma fecha y migra el formato anterior', () => {
  const scope = { ejerciciosHechos: { '2026-10-05': { dia: 0, hechos: [1] } }, hoyISO: () => '2026-10-05', LS: { ejercicios: 'test' }, lsSet() {}, renderRutinaMov() {} };
  vm.runInNewContext(slice('function sesionEjercicios(iso, dia){', 'function setDiaMov(d)'), scope);
  scope.toggleEjercicioHecho(1, 2);
  assert.equal(JSON.stringify(scope.sesionEjercicios('2026-10-05', 0)), '[1]');
  assert.equal(JSON.stringify(scope.sesionEjercicios('2026-10-05', 1)), '[2]');
  assert.equal(worker.progresoValido({ rp90_ejercicios_hechos: scope.ejerciciosHechos }), true);
  for (const sesiones of [{ 7: [0] }, { 1: [1,1] }, { 0: [20] }, { 1: ['1'] }]) {
    assert.equal(worker.progresoValido({ rp90_ejercicios_hechos: { '2026-10-05': { sesiones } } }), false);
  }
});

test('el temporizador descuenta el tiempo real aunque se retrase la pestaña', () => {
  let now = 0, tick;
  const scope = {
    Date: { now: () => now }, document: { getElementById: () => null, querySelectorAll: () => [] },
    setInterval: cb => { tick = cb; return 1; }, clearInterval() {}, toast() {},
  };
  vm.runInNewContext(slice('let restTimerDuracion = 90;', '// Si una de las fotos del ejercicio'), scope);
  scope.iniciarRestTimer(); now = 45000; tick();
  assert.equal(vm.runInNewContext('restTimerRestante', scope), 45);
  scope.pausarRestTimer(); now = 60000;
  scope.iniciarRestTimer(); now = 106000; tick();
  assert.equal(vm.runInNewContext('restTimerRestante', scope), 0);
  assert.equal(vm.runInNewContext('restTimerCorriendo', scope), false);
  scope.reiniciarRestTimer();
  assert.equal(vm.runInNewContext('restTimerRestante', scope), 90);
});

test('las claves sueltas no anuncian servicios disponibles sin sus dependencias', async () => {
  const request = new Request('https://worker.example/config', { headers: { Origin: 'https://luifelipecd.github.io' } });
  const env = { RESEND_API_KEY: 'test', ANTHROPIC_API_KEY: 'test', STRIPE_SECRET_KEY: 'test', STRIPE_PRICE_MENSUAL: 'test' };
  let data = await (await worker.default.fetch(request, env)).json();
  assert.deepEqual(data.disponible, { correo: false, generacionIA: false, pagos: { mensual: false, anual: false } });
  env.DB = {}; env.SESSION_SECRET = 'test';
  data = await (await worker.default.fetch(request, env)).json();
  assert.deepEqual(data.disponible, { correo: false, generacionIA: false, pagos: { mensual: false, anual: false } });
});
