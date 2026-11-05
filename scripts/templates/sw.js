/* Family Roots service worker. Generated into dist/sw.js by scripts/build.mjs.
   VERSION is a fingerprint of the build, so old caches are removed automatically.
   - Pages: network first, then the saved copy, then offline.html.
   - Styles, scripts, fonts and images: saved copy first (their file names change when they change).
   - A new version waits until the person taps Refresh, so nobody loses work mid-edit.
   - Firebase traffic (other origins) is never touched, so your data is never cached by this file. */
const VERSION = "__VERSION__";
const PREFIX = "family-roots-";
const SHELL = PREFIX + "shell-" + VERSION;
const PAGES = PREFIX + "pages-" + VERSION;
const PRECACHE = __PRECACHE__;

const scope = new URL(self.registration.scope);
const abs = (p) => new URL(p, scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => Promise.all(PRECACHE.map((p) => cache.add(new Request(abs(p), { cache: "reload" })).catch(() => null)))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && ![SHELL, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

async function pageStrategy(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await Promise.race([fetch(request), timeout(4500)]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = (await cache.match(request)) || (await caches.match(abs("./"))) || (await caches.match(request, { ignoreSearch: true }));
    if (hit) return hit;
    return (await caches.match(abs("offline.html"))) || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) (await caches.open(SHELL)).put(request, response.clone());
    return response;
  } catch (err) {
    return new Response("", { status: 504 });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (url.pathname.endsWith("/sw.js")) return;
  if (request.mode === "navigate") { event.respondWith(pageStrategy(request)); return; }
  if (url.pathname.includes("/assets/") || /\.(?:png|svg|ico|webmanifest)$/.test(url.pathname)) { event.respondWith(cacheFirst(request)); return; }
});
