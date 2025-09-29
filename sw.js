// 乾淨版 SW：只負責註冊與通過請求
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { /* 可以清快取版本 */ });
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
