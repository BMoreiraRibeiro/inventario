const CACHE_NAME = 'inventario-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/supabase-sync.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  // Activate new SW as soon as it's finished installing
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Attempt to cache core assets; ignore failures for individual items
      return cache.addAll(ASSETS_TO_CACHE.map(p => new Request(p, { cache: 'no-cache' }))).catch(err => {
        console.warn('Some assets failed to cache during install:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();

    // Notify clients that the SW is active (useful on first install)
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED' }));
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore chrome-extension and other non-http(s) schemes
  if (!request.url.startsWith('http')) return;

  // Always allow passthrough for non-GET
  if (request.method !== 'GET') return;

  const acceptHeader = request.headers.get('accept') || '';

  // Network-first for navigation requests (HTML pages) to get latest index
  if (request.mode === 'navigate' || acceptHeader.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Update cache in background
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other GET requests: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Clone BEFORE consuming the response body
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clonedResponse));
          }
          return response;
        })
        .catch(() => null);

      // Return cached if available, otherwise wait network
      return cached || networkFetch;
    })
  );
});

// Listen for messages from the page (e.g., to skip waiting)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
