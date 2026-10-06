import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('const RECETAS = [');
const end = html.indexOf('\n];', start) + 3;
if (start < 0 || end < 3) throw new Error('No se encontró el catálogo de recetas.');
const recipes = vm.runInNewContext(html.slice(start, end) + '\nRECETAS', {}, { timeout: 1000 });
const plan = recipes.map(recipe => ({ id: recipe.id, name: recipe.nombre,
  ingredients: recipe.ingredientes.map(ingredient => `${ingredient.n} (${ingredient.g} g)`), steps: recipe.pasos }));
mkdirSync(path.join(root, '.wrangler'), { recursive: true });
writeFileSync(path.join(root, '.wrangler/image-plan.json'), JSON.stringify(plan, null, 2) + '\n');
console.log(plan.length + ' recetas preparadas para generar sus imágenes.');
