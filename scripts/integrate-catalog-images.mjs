import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export function integrateCatalogImages(html) {
  const replaceRange = (start, end, replacement) => {
    const from = html.indexOf(start), to = html.indexOf(end, from);
    if (from < 0 || to < 0) throw new Error('No se encontró el punto de integración: ' + start);
    html = html.slice(0, from) + replacement + '\n\n' + html.slice(to);
  };
  if (!html.includes('src="assets/recipes/catalog.js"')) {
    html = html.replace('<script>', '<script src="assets/recipes/catalog.js"></script>\n<script>');
  }
  if (!html.includes('href="assets/brand/catalog-media.css"')) {
    html = html.replace('</head>', '<link rel="stylesheet" href="assets/brand/catalog-media.css">\n</head>');
  }
  replaceRange('function recetaMediaHTML(r){', 'function renderCreditosFotos(){', `function recetaMediaHTML(r){
  const image = FOTOS_RECETAS[r.id];
  if(!image) return recetaThumb(r);
  return \`<div class="rc-media rc-media-generated">
    <img class="rc-photo-img" src="\${image.path}" width="\${image.width}" height="\${image.height}" alt="Imagen ilustrativa de \${esc(r.nombre)}" loading="lazy" decoding="async"
         onerror="this.parentElement.classList.add('foto-error');">
    <div class="rc-thumb-fallback">\${recetaThumb(r)}</div>
    <span class="rc-photo-tag">Imagen ilustrativa</span>
  </div>\`;
}`);
  replaceRange('function renderCreditosFotos(){', 'function renderRecetaCard(r){', `function renderCreditosFotos(){
  const panel = document.getElementById('credits-panel');
  if(!panel) return;
  panel.innerHTML = '<div class="note" style="margin:0;">Las imágenes del catálogo fueron generadas con IA para ilustrar cada receta. El aspecto y la porción del plato preparado pueden variar. Las fotografías de ejercicios provienen de Free Exercise DB; sus créditos están en Rutina.</div>';
}`);
  const start = html.indexOf('const EX_FOTO_BASE ='), end = html.indexOf('const EX_EQUIPO =', start);
  if (start < 0 || end < 0) throw new Error('No se encontró el catálogo de ejercicios.');
  const section = html.slice(start, end).replace("'assets/exercises/'", "'assets/exercises-webp/'").replace(/\.jpg/g, '.webp');
  html = html.slice(0, start) + section + html.slice(end);
  return html;
}

export function integrateCatalogCache(sw) {
  const images = JSON.parse(readFileSync(path.join(root, 'assets/recipes/catalog.json'), 'utf8'));
  sw = sw.replace(/\.\/assets\/exercises\//g, './assets/exercises-webp/');
  sw = sw.replace(/(assets\/exercises-webp\/[^']+)\.jpg/g, '$1.webp');
  sw = sw.replace(/^\s*'\.\/assets\/recipes\/[^']+\.jpg',\r?\n/gm, '');
  if (!sw.includes("'./assets/recipes/catalog.js'")) {
    const start = sw.indexOf('const CORE = ['), end = sw.indexOf('\n];', start);
    if (start < 0 || end < 0) throw new Error('No se encontró la caché principal.');
    const extra = ["./icon.svg", "./assets/brand/catalog-media.css", "./assets/recipes/catalog.js", ...images.map(image => './' + image.path)];
    sw = sw.slice(0, end) + '\n' + extra.map(file => "  '" + file + "',").join('\n') + sw.slice(end);
  }
  return sw.replace(/const VERSION = '[^']+';/, "const VERSION = 'v12-catalogo-72';");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const htmlPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'index.html');
  writeFileSync(htmlPath, integrateCatalogImages(readFileSync(htmlPath, 'utf8')));
  if (!process.argv[2]) {
    const swPath = path.join(root, 'sw.js');
    writeFileSync(swPath, integrateCatalogCache(readFileSync(swPath, 'utf8')));
  }
  console.log('Imágenes específicas de recetas y fotografías optimizadas integradas.');
}
