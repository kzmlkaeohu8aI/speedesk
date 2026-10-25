/* test-planner/service-worker.js
 *
 * Speedesk offline cache. Serves the app shell and JSON data from
 * cache when the network is unavailable.
 *
 * ─── MAINTENANCE RULE ───
 * Whenever you change ANY of the files listed in ASSETS below, bump
 * CACHE_VERSION. If you don't, students will keep seeing the OLD
 * version from their cache until the SW is updated.
 * ────────────────────────
 */

const CACHE_VERSION = "speedesk-v2";

// Every file the app needs to run offline. Add new files here when
// they are added to the app; remove files when deleted.
const ASSETS = [
  "./",
  "./index.html",
  "./calendar.html",
  "./install.html",
  "./offline.html",
  "./site.webmanifest",

  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/app-look.css",
  "./css/calendar.css",
  "./css/print.css",

  "./js/config.js",
  "./js/utils.js",
  "./js/time.js",
  "./js/data.js",
  "./js/filters.js",
  "./js/qr.js",
  "./js/render.js",
  "./js/interactions.js",
  "./js/calendar.js",
  "./js/reminder-modal.js",
  "./js/calendar-page.js",
  "./js/app-look.js",
  "./js/main.js",

  "./test-planner-pw-26-27.json",

  "./speedesk-txt-logo.png",
  "./favicon-96x96.png",
  "./favicon.svg",
  "./apple-touch-icon.png",
  "./web-app-manifest-192x192.png",
  "./web-app-manifest-512x512.png",
];

// ── Install: pre-cache all assets ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails if any single file 404s. Fetch each one and skip
      // the ones that fail so a missing favicon doesn't kill the SW.
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn("[Speedesk SW] skip missing asset:", url, err)
          )
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old cache versions ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("speedesk-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for same-origin GET requests ──
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Don't touch non-GET or cross-origin (fonts, Google APIs, etc.)
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((resp) => {
          // Cache successful HTML / CSS / JS / JSON responses for next time.
          if (
            resp &&
            resp.status === 200 &&
            (req.destination === "document" ||
              /\.(css|js|json|png|svg|ico|webmanifest)$/i.test(url.pathname))
          ) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => {
          // Network failed and not in cache.
          if (req.destination === "document") {
            return caches.match("./offline.html");
          }
          return new Response("", { status: 504 });
        });
    })
  );
});