// Service worker: makes the dashboard installable + offline-capable.
// Network-first for same-origin GETs (so deploys aren't served stale), falling
// back to cache when offline. API calls and cross-origin requests pass through
// untouched (never cached) so auth/data always hit the network.

const CACHE = "et-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/config.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle same-origin GETs; let API + cross-origin pass straight through.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/index.html")))
  );
});
