/* Service worker de "Transforma tu Cuerpo en 90 Días"
 * App shell cacheada para carga instantánea y uso offline.
 * No toca las peticiones POST (p. ej. el Worker de recetas con IA).
 */
const VERSION = 'v13-acceso-correo';
const CACHE = 'transforma90-' + VERSION;
const FONT_CACHE = 'transforma90-fonts-' + VERSION;

// La app entera vive en index.html; el resto son recursos de la PWA.
const CORE = [
  './',
  './index.html',
  './redesign.css',
  './interface.css?v=training-photos-1',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './assets/exercises-webp/Barbell_Bench_Press_-_Medium_Grip/0.webp',
  './assets/exercises-webp/Barbell_Bench_Press_-_Medium_Grip/1.webp',
  './assets/exercises-webp/Incline_Dumbbell_Press/0.webp',
  './assets/exercises-webp/Incline_Dumbbell_Press/1.webp',
  './assets/exercises-webp/Dumbbell_Flyes/0.webp',
  './assets/exercises-webp/Dumbbell_Flyes/1.webp',
  './assets/exercises-webp/Dips_-_Chest_Version/0.webp',
  './assets/exercises-webp/Dips_-_Chest_Version/1.webp',
  './assets/exercises-webp/Pushups/0.webp',
  './assets/exercises-webp/Pushups/1.webp',
  './assets/exercises-webp/Pullups/0.webp',
  './assets/exercises-webp/Pullups/1.webp',
  './assets/exercises-webp/Bent_Over_Barbell_Row/0.webp',
  './assets/exercises-webp/Bent_Over_Barbell_Row/1.webp',
  './assets/exercises-webp/Seated_Cable_Rows/0.webp',
  './assets/exercises-webp/Seated_Cable_Rows/1.webp',
  './assets/exercises-webp/Barbell_Deadlift/0.webp',
  './assets/exercises-webp/Barbell_Deadlift/1.webp',
  './assets/exercises-webp/Leverage_Iso_Row/0.webp',
  './assets/exercises-webp/Leverage_Iso_Row/1.webp',
  './assets/exercises-webp/Barbell_Squat/0.webp',
  './assets/exercises-webp/Barbell_Squat/1.webp',
  './assets/exercises-webp/Leg_Press/0.webp',
  './assets/exercises-webp/Leg_Press/1.webp',
  './assets/exercises-webp/Dumbbell_Lunges/0.webp',
  './assets/exercises-webp/Dumbbell_Lunges/1.webp',
  './assets/exercises-webp/Lying_Leg_Curls/0.webp',
  './assets/exercises-webp/Lying_Leg_Curls/1.webp',
  './assets/exercises-webp/Leg_Extensions/0.webp',
  './assets/exercises-webp/Leg_Extensions/1.webp',
  './assets/exercises-webp/Standing_Calf_Raises/0.webp',
  './assets/exercises-webp/Standing_Calf_Raises/1.webp',
  './assets/exercises-webp/Standing_Military_Press/0.webp',
  './assets/exercises-webp/Standing_Military_Press/1.webp',
  './assets/exercises-webp/Side_Lateral_Raise/0.webp',
  './assets/exercises-webp/Side_Lateral_Raise/1.webp',
  './assets/exercises-webp/Front_Dumbbell_Raise/0.webp',
  './assets/exercises-webp/Front_Dumbbell_Raise/1.webp',
  './assets/exercises-webp/Reverse_Flyes/0.webp',
  './assets/exercises-webp/Reverse_Flyes/1.webp',
  './assets/exercises-webp/Arnold_Dumbbell_Press/0.webp',
  './assets/exercises-webp/Arnold_Dumbbell_Press/1.webp',
  './assets/exercises-webp/Barbell_Curl/0.webp',
  './assets/exercises-webp/Barbell_Curl/1.webp',
  './assets/exercises-webp/Hammer_Curls/0.webp',
  './assets/exercises-webp/Hammer_Curls/1.webp',
  './assets/exercises-webp/Lying_Triceps_Press/0.webp',
  './assets/exercises-webp/Lying_Triceps_Press/1.webp',
  './assets/exercises-webp/Triceps_Pushdown/0.webp',
  './assets/exercises-webp/Triceps_Pushdown/1.webp',
  './assets/exercises-webp/Concentration_Curls/0.webp',
  './assets/exercises-webp/Concentration_Curls/1.webp',
  './icon.svg',
  './assets/brand/catalog-media.css',
  './assets/recipes/catalog.js',
  './assets/recipes/catalog/1.webp',
  './assets/recipes/catalog/2.webp',
  './assets/recipes/catalog/3.webp',
  './assets/recipes/catalog/4.webp',
  './assets/recipes/catalog/5.webp',
  './assets/recipes/catalog/6.webp',
  './assets/recipes/catalog/7.webp',
  './assets/recipes/catalog/8.webp',
  './assets/recipes/catalog/33.webp',
  './assets/recipes/catalog/34.webp',
  './assets/recipes/catalog/35.webp',
  './assets/recipes/catalog/36.webp',
  './assets/recipes/catalog/37.webp',
  './assets/recipes/catalog/38.webp',
  './assets/recipes/catalog/39.webp',
  './assets/recipes/catalog/40.webp',
  './assets/recipes/catalog/9.webp',
  './assets/recipes/catalog/10.webp',
  './assets/recipes/catalog/11.webp',
  './assets/recipes/catalog/12.webp',
  './assets/recipes/catalog/13.webp',
  './assets/recipes/catalog/14.webp',
  './assets/recipes/catalog/15.webp',
  './assets/recipes/catalog/16.webp',
  './assets/recipes/catalog/17.webp',
  './assets/recipes/catalog/18.webp',
  './assets/recipes/catalog/19.webp',
  './assets/recipes/catalog/20.webp',
  './assets/recipes/catalog/21.webp',
  './assets/recipes/catalog/22.webp',
  './assets/recipes/catalog/23.webp',
  './assets/recipes/catalog/24.webp',
  './assets/recipes/catalog/41.webp',
  './assets/recipes/catalog/42.webp',
  './assets/recipes/catalog/43.webp',
  './assets/recipes/catalog/44.webp',
  './assets/recipes/catalog/45.webp',
  './assets/recipes/catalog/46.webp',
  './assets/recipes/catalog/47.webp',
  './assets/recipes/catalog/48.webp',
  './assets/recipes/catalog/49.webp',
  './assets/recipes/catalog/50.webp',
  './assets/recipes/catalog/51.webp',
  './assets/recipes/catalog/52.webp',
  './assets/recipes/catalog/53.webp',
  './assets/recipes/catalog/54.webp',
  './assets/recipes/catalog/55.webp',
  './assets/recipes/catalog/56.webp',
  './assets/recipes/catalog/65.webp',
  './assets/recipes/catalog/66.webp',
  './assets/recipes/catalog/67.webp',
  './assets/recipes/catalog/68.webp',
  './assets/recipes/catalog/69.webp',
  './assets/recipes/catalog/25.webp',
  './assets/recipes/catalog/26.webp',
  './assets/recipes/catalog/27.webp',
  './assets/recipes/catalog/28.webp',
  './assets/recipes/catalog/29.webp',
  './assets/recipes/catalog/30.webp',
  './assets/recipes/catalog/31.webp',
  './assets/recipes/catalog/32.webp',
  './assets/recipes/catalog/57.webp',
  './assets/recipes/catalog/58.webp',
  './assets/recipes/catalog/59.webp',
  './assets/recipes/catalog/60.webp',
  './assets/recipes/catalog/61.webp',
  './assets/recipes/catalog/62.webp',
  './assets/recipes/catalog/63.webp',
  './assets/recipes/catalog/64.webp',
  './assets/recipes/catalog/72.webp',
  './assets/recipes/catalog/73.webp',
  './assets/recipes/catalog/74.webp',
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
            .filter((k) => k.startsWith('transforma90-') && k !== CACHE && k !== FONT_CACHE)
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
  const appPath = new URL('./', self.location.href).pathname;
  if (req.mode === 'navigate' && sameOrigin && [appPath, appPath + 'index.html'].includes(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res.ok || !res.headers.get('Content-Type')?.includes('text/html')) return res;
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
