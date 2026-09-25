// NYC Drift — service worker. Caches the app shell so the generator works
// offline once the app has loaded. Map tiles are NOT cached.
var CACHE = "nyc-drift-v1";
var SHELL = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/zone.js",
  "js/drift.js",
  "js/app.js",
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet/leaflet.css",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Same-origin GETs: network first (so updates land), falling back to cache.
// Query strings such as ?seed=1A2B3C4D are ignored when matching the cache.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok && !new URL(req.url).search) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("./");
        return Response.error();
      }).then(function (res) { return res || Response.error(); });
    })
  );
});
