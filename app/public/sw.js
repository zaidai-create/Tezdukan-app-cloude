// App shell cache: the app opens instantly; data always comes fresh from the server.
const CACHE = 'qayam-v3';
const SHELL = ['/', '/index.html', '/app.css', '/js/app.js', '/js/core.js', '/js/screens.js', '/js/voice.js', '/js/invoice.js', '/js/webdash.js', '/web.css', '/manifest.webmanifest', '/icon-192.png', '/vendor/html2canvas.min.js', '/vendor/jspdf.umd.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // network first (so updates show), cache as fallback when offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
