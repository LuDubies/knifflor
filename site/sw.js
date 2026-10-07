/**
 * Service Worker für knifflor.
 *
 * Legt die komplette App beim ersten Besuch in den Cache. Danach läuft sie
 * ohne Netz. Alle Pfade sind relativ, damit die Seite auch in einem
 * Unterverzeichnis funktioniert (etwa auf GitHub Pages).
 *
 * WICHTIG: Bei jedem Deployment CACHE_NAME hochzählen. Sonst behalten
 * Geräte, die schon einmal da waren, die alte Version.
 */
const CACHE_NAME = 'knifflor-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/bootstrap.min.css',
  './css/knifflor.css',
  './js/knifflor.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Nur eigene GET-Anfragen - alles andere geht unverändert ans Netz.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;

      return fetch(request).catch(() => {
        // Offline und nichts im Cache: Navigationen auf die Startseite lenken,
        // damit die App auch über einen fremden Link erreichbar bleibt.
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    }),
  );
});
