/* Service worker de "Transforma tu Cuerpo en 90 Días"
 * App shell cacheada para carga instantánea y uso offline.
 * No toca las peticiones POST (p. ej. el Worker de recetas con IA).
 */
const VERSION = 'v2';
const CACHE = 'transforma90-' + VERSION;
const FONT_CACHE = 'transforma90-fonts-' + VERSION;

// La app entera vive en index.html; el resto son recursos de la PWA.
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== FONT_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Deja pasar todo lo que no sea GET (POST del Worker de IA, etc.)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Abrir la app: red primero (para recibir actualizaciones), caché si no hay conexión.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then((r) => r || caches.match('./'))
        )
    );
    return;
  }

  // Recursos propios (iconos, manifest): caché primero; solo va a la red si no está.
  // Para forzar una actualización, sube VERSION arriba (invalida la caché entera).
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Google Fonts (CSS y .woff2): stale-while-revalidate para que funcione offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => {
              if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Cualquier otra cosa (incluida la API del Worker): comportamiento normal del navegador.
});
