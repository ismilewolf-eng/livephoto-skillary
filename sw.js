const CACHE_NAME = 'livephoto-v3';
const CORE = ['/', '/app.js', '/zip.js', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('livephoto-') && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !['http:', 'https:'].includes(url.protocol)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && ['document', 'script', 'style', 'image', ''].includes(request.destination)) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        } catch {
          // Storage can be unavailable; the network response is still usable.
        }
      }
      return response;
    } catch {
      return (await caches.match(request)) ||
        (request.mode === 'navigate' ? await caches.match('/') : undefined) ||
        Response.error();
    }
  })());
});
