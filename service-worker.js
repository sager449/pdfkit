/* PDFKit PWA service worker */
const CACHE_NAME = 'pdfkit-cache-v1';

const CORE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML navigations: network first, then cached page, then offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));

          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cached) => {
              return cached || caches.match('/offline.html');
            });
        })
    );

    return;
  }

  // Static assets: cache first, then network and runtime cache.
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') {
              const copy = response.clone();

              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, copy));
            }

            return response;
          });
      })
  );
});
                
