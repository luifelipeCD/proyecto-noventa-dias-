import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('la entrega pública incluye assets y excluye servidor, credenciales y demostración', () => {
  const result = spawnSync(process.execPath, ['scripts/build-site.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const files = readdirSync(new URL('../dist/', import.meta.url));
  for (const file of ['index.html', 'assets', 'sw.js', 'manifest.json', '.nojekyll']) assert.ok(files.includes(file));
  for (const file of ['worker', '.git', '.wrangler', '.dev.vars', '.env', 'node_modules', 'tests', 'CLAUDE.md']) assert.ok(!files.includes(file));
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('demo@example.com'));
  assert.ok(existsSync(new URL('../dist/assets/recipes/catalog/1.webp', import.meta.url)));
});
