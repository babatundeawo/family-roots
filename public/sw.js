const CACHE = 'family-roots-v2';
const SHELL = ['./', './index.html', './app.js', './styles.css', './theme.js', './firebase-config.js', './manifest.json', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Stale-while-revalidate for the app shell and Firebase SDK files; Firestore/Auth API calls go to network.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const ok = u.origin === location.origin || u.hostname === 'www.gstatic.com';
  if (e.request.method !== 'GET' || !ok) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
