import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('las 72 recetas tienen su propia imagen local y todos los archivos de la caché existen', () => {
  const start = html.indexOf('const RECETAS = [');
  const recipes = vm.runInNewContext(html.slice(start, html.indexOf('\n];', start) + 3) + '\nRECETAS;');
  const catalog = JSON.parse(readFileSync(new URL('../assets/recipes/catalog.json', import.meta.url), 'utf8'));
  assert.equal(catalog.length, 72);
  assert.equal(new Set(catalog.map(r => r.path)).size, 72);
  for (const recipe of recipes) {
    const image = catalog.find(r => r.id === recipe.id);
    assert.ok(image, recipe.nombre);
    assert.equal(image.name, recipe.nombre);
    assert.ok(image.width > 0 && image.height > 0);
    assert.ok(existsSync(new URL('../' + image.path, import.meta.url)), image.path);
  }
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const core = sw.slice(sw.indexOf('const CORE = ['), sw.indexOf('\n];', sw.indexOf('const CORE = [')));
  for (const [, file] of core.matchAll(/'\.\/([^']+)'/g)) {
    assert.ok(existsSync(new URL('../' + file.split('?')[0], import.meta.url)), file);
  }
  assert.ok(html.includes('src="assets/recipes/catalog.js"'));
});

test('la receta generada sin foto propia usa su ilustración de respaldo', () => {
  const start = html.indexOf('function recetaMediaHTML(r){');
  const fn = html.slice(start, html.indexOf('function renderCreditosFotos(){', start));
  const scope = { FOTOS_RECETAS: { 1: { path: 'one.webp', width: 960, height: 720 } }, recetaThumb: () => 'respaldo', esc: s => s.replaceAll('<', '&lt;') };
  vm.runInNewContext(fn + '\nthis.photo = recetaMediaHTML({id:1,nombre:"Plato <"}); this.fallback = recetaMediaHTML({id:999,nombre:"IA"});', scope);
  assert.equal(scope.fallback, 'respaldo');
  assert.ok(scope.photo.includes('one.webp'));
  assert.ok(scope.photo.includes('Plato &lt;'));
});
