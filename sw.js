/* Service worker de "Transforma tu Cuerpo en 90 Días"
 * App shell cacheada para carga instantánea y uso offline.
 * No toca las peticiones POST (p. ej. el Worker de recetas con IA).
 */
const VERSION = 'v10-preparacion-publicacion';
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
  './assets/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  './assets/exercises/Barbell_Bench_Press_-_Medium_Grip/1.jpg',
  './assets/exercises/Incline_Dumbbell_Press/0.jpg',
  './assets/exercises/Incline_Dumbbell_Press/1.jpg',
  './assets/exercises/Dumbbell_Flyes/0.jpg',
  './assets/exercises/Dumbbell_Flyes/1.jpg',
  './assets/exercises/Dips_-_Chest_Version/0.jpg',
  './assets/exercises/Dips_-_Chest_Version/1.jpg',
  './assets/exercises/Pushups/0.jpg',
  './assets/exercises/Pushups/1.jpg',
  './assets/exercises/Pullups/0.jpg',
  './assets/exercises/Pullups/1.jpg',
  './assets/exercises/Bent_Over_Barbell_Row/0.jpg',
  './assets/exercises/Bent_Over_Barbell_Row/1.jpg',
  './assets/exercises/Seated_Cable_Rows/0.jpg',
  './assets/exercises/Seated_Cable_Rows/1.jpg',
  './assets/exercises/Barbell_Deadlift/0.jpg',
  './assets/exercises/Barbell_Deadlift/1.jpg',
  './assets/exercises/Leverage_Iso_Row/0.jpg',
  './assets/exercises/Leverage_Iso_Row/1.jpg',
  './assets/exercises/Barbell_Squat/0.jpg',
  './assets/exercises/Barbell_Squat/1.jpg',
  './assets/exercises/Leg_Press/0.jpg',
  './assets/exercises/Leg_Press/1.jpg',
  './assets/exercises/Dumbbell_Lunges/0.jpg',
  './assets/exercises/Dumbbell_Lunges/1.jpg',
  './assets/exercises/Lying_Leg_Curls/0.jpg',
  './assets/exercises/Lying_Leg_Curls/1.jpg',
  './assets/exercises/Leg_Extensions/0.jpg',
  './assets/exercises/Leg_Extensions/1.jpg',
  './assets/exercises/Standing_Calf_Raises/0.jpg',
  './assets/exercises/Standing_Calf_Raises/1.jpg',
  './assets/exercises/Standing_Military_Press/0.jpg',
  './assets/exercises/Standing_Military_Press/1.jpg',
  './assets/exercises/Side_Lateral_Raise/0.jpg',
  './assets/exercises/Side_Lateral_Raise/1.jpg',
  './assets/exercises/Front_Dumbbell_Raise/0.jpg',
  './assets/exercises/Front_Dumbbell_Raise/1.jpg',
  './assets/exercises/Reverse_Flyes/0.jpg',
  './assets/exercises/Reverse_Flyes/1.jpg',
  './assets/exercises/Arnold_Dumbbell_Press/0.jpg',
  './assets/exercises/Arnold_Dumbbell_Press/1.jpg',
  './assets/exercises/Barbell_Curl/0.jpg',
  './assets/exercises/Barbell_Curl/1.jpg',
  './assets/exercises/Hammer_Curls/0.jpg',
  './assets/exercises/Hammer_Curls/1.jpg',
  './assets/exercises/Lying_Triceps_Press/0.jpg',
  './assets/exercises/Lying_Triceps_Press/1.jpg',
  './assets/exercises/Triceps_Pushdown/0.jpg',
  './assets/exercises/Triceps_Pushdown/1.jpg',
  './assets/exercises/Concentration_Curls/0.jpg',
  './assets/exercises/Concentration_Curls/1.jpg',
  './assets/recipes/avena.jpg',
  './assets/recipes/batido.jpg',
  './assets/recipes/carne.jpg',
  './assets/recipes/ensalada.jpg',
  './assets/recipes/fruta.jpg',
  './assets/recipes/huevo.jpg',
  './assets/recipes/lacteo.jpg',
  './assets/recipes/legumbre.jpg',
  './assets/recipes/nuez.jpg',
  './assets/recipes/pescado.jpg',
  './assets/recipes/plato.jpg',
  './assets/recipes/pollo.jpg',
  './assets/recipes/sopa.jpg',
  './assets/recipes/tofu.jpg',
  './assets/recipes/wrap.jpg',
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
