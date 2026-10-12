const CACHE_NAME = "pdfkit-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/css/style.css",
  "/css/tool.css",
  "/js/lang.js",
  "/manifest.json",
  "/tools/text-to-pdf.html",
  "/tools/images-to-pdf.html",
  "/tools/merge-pdf.html",
  "/tools/split-pdf.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
