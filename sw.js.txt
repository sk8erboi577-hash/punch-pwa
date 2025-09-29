const CACHE_VERSION = 'v2025-09-29';
const CACHE_NAME = `punch-cache-${CACHE_VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/public/manifest.json',
  '/public/icon-192.png',
  '/public/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('punch-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // 只快取本站檔案；API 走網路
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
  }
});
