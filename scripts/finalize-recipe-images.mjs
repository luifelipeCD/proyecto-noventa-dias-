import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const plan = JSON.parse(readFileSync(path.join(root, '.wrangler/image-plan.json'), 'utf8'));
const images = plan.map(recipe => {
  const metadata = path.join(root, '.wrangler/generated-recipes/' + recipe.id + '.json');
  if (!existsSync(metadata)) throw new Error('Falta la imagen de la receta ' + recipe.id);
  const info = JSON.parse(readFileSync(metadata, 'utf8'));
  if (!existsSync(path.join(root, info.path))) throw new Error('No existe ' + info.path);
  return info;
});
const catalog = Object.fromEntries(images.map(({ id, path, width, height }) => [id, { path, width, height }]));
writeFileSync(path.join(root, 'assets/recipes/catalog.js'), '/* Imágenes ilustrativas generadas para cada receta. */\nconst FOTOS_RECETAS = Object.freeze(' + JSON.stringify(catalog) + ');\n');
writeFileSync(path.join(root, 'assets/recipes/catalog.json'), JSON.stringify(images.map(({ prompt, ...image }) => image), null, 2) + '\n');
writeFileSync(path.join(root, 'docs/IMAGENES-GENERADAS.json'), JSON.stringify(images, null, 2) + '\n');
console.log(images.length + ' imágenes verificadas e integradas en el catálogo.');
