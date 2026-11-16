// App files come from the phone's cache (opens instantly). The server stamps a new version on every deploy,
// which makes this worker re-download everything once, in the background, as one consistent set.
const CACHE = 'qayam-__BUILD__';
const SHELL = ['/', '/app/', '/index.html', '/app.css', '/web.css', '/js/app.js', '/js/core.js', '/js/screens.js', '/js/voice.js', '/js/roman.js', '/js/invoice.js', '/js/webdash.js', '/js/finance.js', '/js/approvals.js', '/js/registers.js',
  '/manifest.webmanifest', '/icon-192.png', '/favicon.png', '/brand/logo-full.png', '/brand/logo-mark.png', '/vendor/html2canvas.min.js', '/vendor/jspdf.umd.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  const page = e.request.mode === 'navigate';
  const key = page ? (u.pathname.startsWith('/app') ? '/app/' : '/') : e.request;
  e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => hit || fetch(e.request).then(r => { if (r.ok && !page) c.put(e.request, r.clone()); return r; })
    .catch(() => c.match('/index.html')))));
});
