/* Keeps the app and its question banks on the phone, so it opens at once and works on a bus with no signal.
 * The Sheet (script.google.com) is never cached: answers wait in the app's outbox until there is a connection.
 * Bump VERSION when the app's files change, so phones take the new copy. */
const VERSION = "fq-39";
const ART = "fq-art";
const KEEP = ["fq-banks", ART];   // the page's own copies of the question banks (app.js, BANK_KEPT) and the art outlive a version
const SHELL = ["./", "index.html", "app.css", "app.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];
const PATIENCE = 2500;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  /* The art (art/: the coin, the wreath, each girl's piece) never changes under a name: a changed picture gets a new
   * one. So the phone's copy is served without asking, and kept over every version: 1.8 MB is not fetched again
   * each time the app is updated. */
  /* The sounds (audio/, a third of a megabyte): the phone's copy is served without asking, but it is kept with the
   * version and not for good, so a sound that is cut again arrives with the next version under the same name. (They
   * are changed often: Avsha listens and says what does not fit.) */
  if (url.pathname.includes("/audio/")) {
    e.respondWith(caches.open(VERSION).then(c => c.match(e.request, { ignoreSearch: true }).then(kept => kept || fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }))));
    return;
  }
  if (url.pathname.includes("/art/")) {
    e.respondWith(caches.open(ART).then(c => c.match(e.request, { ignoreSearch: true }).then(kept => kept || fetch(e.request).then(r => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }))));
    return;
  }
  /* Network first, so a new question bank or app version arrives as soon as there is signal; the cache when there is none.
   * "no-cache" asks the server every time (a quick "not modified" when nothing changed): GitHub Pages lets a browser
   * keep a file 10 minutes, so an update could take that long to reach a phone.
   * On a weak signal a request neither answers nor fails for a long while, and the app sat on its opening screen
   * meanwhile (2026-11-26): after PATIENCE the copy the phone holds is served, and the answer, when it comes, is kept
   * for the next opening. */
  const net = fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return r;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(kept => {
    if (!kept) return net;
    return Promise.race([net.catch(() => kept), new Promise(done => setTimeout(() => done(kept), PATIENCE))]);
  }));
});
