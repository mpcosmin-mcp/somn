/* somn — minimal service worker
 *
 * Purpose: satisfy the install-criteria so Chrome/Edge fire the
 * `beforeinstallprompt` event and users can add the app to their home
 * screen / desktop. NOT an offline-first strategy — we keep API reads
 * online (Sheets is source of truth) and only cache static assets.
 *
 * Bump CACHE on each meaningful asset change so old caches get reaped.
 */
const CACHE = 'somn-v1';
const APP_SHELL = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API responses — Sheets data must stay fresh.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network-first so HTML updates land immediately.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/')))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (/\.(js|css|svg|jpg|jpeg|png|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkPromise = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
  }
});
