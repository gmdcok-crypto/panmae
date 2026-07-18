/* panmae ERP — Service Worker (오프라인 캐시) */
const CACHE = 'panmae-erp-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/erp.css',
  './js/format.js',
  './js/store.js',
  './js/panels.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

/* 네트워크 우선, 실패 시 캐시 (항상 최신 UI + 오프라인 동작) */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
