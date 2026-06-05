// Minimal service worker — required for Chrome/Edge to consider the app installable.
// Strategy: network-first for everything (since this is a live SaaS), no opaque caching
// of API/WebSocket. Static assets are revalidated on each load by Vite's hashed filenames.

const CACHE = 'meetsync-static-v1';
const APP_SHELL = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
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
  // Never touch API or WebSocket — always go to network.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;

  // Network-first with cache fallback for the rest (so the app opens offline).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});
