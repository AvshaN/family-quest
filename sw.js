/* Keeps the app and its question banks on the phone, so it opens at once and works on a bus with no signal.
 * The Sheet (script.google.com) is never cached: answers wait in the app's outbox until there is a connection.
 * Bump VERSION when the app's files change, so phones take the new copy. */
const VERSION = "fq-7";
const SHELL = ["./", "index.html", "app.css", "app.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  /* Network first, so a new question bank or app version arrives as soon as there is signal; the cache when there is none.
   * "no-cache" asks the server every time (a quick "not modified" when nothing changed): GitHub Pages lets a browser
   * keep a file 10 minutes, so an update could take that long to reach a phone. */
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => {
    const copy = r.clone();
    caches.open(VERSION).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
