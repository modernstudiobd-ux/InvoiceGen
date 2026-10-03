// InvoGen - Invoice Generator — Service Worker
// Bump this version string whenever index.html (or any cached asset) changes,
// so returning users automatically pick up the new version.
const VERSION = "v3.24.0";
const SHELL_CACHE = `invoice-studio-shell-${VERSION}`;
const RUNTIME_CACHE = `invoice-studio-runtime-${VERSION}`;

// Everything needed to run the app with zero network connection.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/invoice.css",
  "./css/templates.css",
  "./css/responsive.css",
  "./css/print.css",
  "./js/dom.js",
  "./js/state.js",
  "./js/format.js",
  "./js/calc.js",
  "./js/toast.js",
  "./js/accent.js",
  "./js/preview.js",
  "./js/columnCanvas.js",
  "./js/currencySearch.js",
  "./js/items.js",
  "./js/toggles.js",
  "./js/persistence.js",
  "./js/invoiceData.js",
  "./js/library.js",
  "./js/brandTemplates.js",
  "./js/layout.js",
  "./js/importSheet.js",
  "./js/print.js",
  "./js/install.js",
  "./js/logo.js",
  "./js/settings.js",
  "./js/docType.js",
  "./js/calculators.js",
  "./js/version.js",
  "./js/main.js",
  "./js/vendor/xlsx.full.min.js",
  "./fonts/inter-variable.woff2",
  "./fonts/currency-latinext.woff2",
  "./fonts/currency-thai.woff2",
  "./fonts/currency-bengali.woff2",
  "./icons/icon.svg",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
  "./favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // One missing/renamed file must never abort the whole install (that
      // is how a stale precache entry once left the app with no working
      // service worker, and therefore not installable/offline-capable).
      // Add each asset on its own and just log any that fail.
      .then((cache) => Promise.all(SHELL_ASSETS.map((url) =>
        cache.add(url).catch((err) => console.warn("SW precache skipped", url, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only. Anything cross-origin is left entirely to the browser
  // (never intercepted or cached) — the app needs no third-party requests, and
  // the page's Content-Security-Policy blocks them anyway.
  if (url.origin !== self.location.origin) return;

  // App shell: network-first, so a returning visitor always gets the latest
  // files whenever there's a connection, falling back to the cache offline.
  // Only complete, same-origin, successful responses are ever cached — never
  // errors (404/500), redirects or opaque responses.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});
