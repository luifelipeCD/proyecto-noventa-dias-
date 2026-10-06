import { mkdir, rm, cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
const files = ['index.html', 'redesign.css', 'interface.css', 'sw.js', 'manifest.json',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'assets'];
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of files) await cp(path.join(root, file), path.join(destination, file), { recursive: true });
await writeFile(path.join(destination, '.nojekyll'), '');
const manifest = JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8'));
if (!manifest.start_url || !manifest.scope) throw new Error('El manifiesto requiere inicio y alcance relativos.');
const entries = await readdir(destination);
if (entries.some(entry => ['worker', '.git', '.env', '.wrangler', 'node_modules', 'tests'].includes(entry))) {
  throw new Error('La entrega contiene archivos que no pertenecen al sitio público.');
}
console.log('Sitio preparado en dist/: solo aplicación, estilos, imágenes e iconos.');
