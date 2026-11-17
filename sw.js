/* SH Enterprise Solar — service worker. App-shell cache only.
   Bump CACHE_NAME whenever index.html, app.js or styles.css changes,
   so installed users get the new version (the browser re-checks this
   file on every visit; a changed CACHE_NAME re-caches the shell).
   Each shell file is cached individually and a missing file is skipped,
   so one absent file (e.g. the offer poster before it is uploaded)
   never breaks the install.
   Firebase / Firestore / Gemini API requests are NEVER cached — they
   always go to the network (the fetch handler only answers same-origin
   requests, and only from the cache when the file is already there). */
var CACHE_NAME = 'sh-solar-v3';
var SHELL = [
  './',
  'index.html',
  'refer.html',
  'app.js',
  'refer-form.js',
  'styles.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  'apple-touch-icon.png',
  'offer-poster.jpg'
];
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(SHELL.map(function (u) {
        return cache.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(function (hit) {
      if (hit) return hit;
      return fetch(event.request);
    })
  );
});
