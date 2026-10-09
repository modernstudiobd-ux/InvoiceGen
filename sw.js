// InvoGen - Invoice Generator — Service Worker
// Bump this version string whenever index.html (or any cached asset) changes,
// so returning users automatically pick up the new version.
const VERSION = "v3.37.0";
const SHELL_CACHE = `invoice-studio-shell-${VERSION}`;
const RUNTIME_CACHE = `invoice-studio-runtime-${VERSION}`;

// Everything needed to run the app with zero network connection.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./css/base.css",
  "./css/design-system.css",
  "./css/invoice.css",
  "./css/print.css",
  "./css/responsive.css",
  "./css/templates.css",
  "./fonts/Lora-400-latin-ext.woff2",
  "./fonts/Lora-400-latin.woff2",
  "./fonts/Lora-700-latin-ext.woff2",
  "./fonts/Lora-700-latin.woff2",
  "./fonts/Montserrat-400-latin-ext.woff2",
  "./fonts/Montserrat-400-latin.woff2",
  "./fonts/Montserrat-700-latin-ext.woff2",
  "./fonts/Montserrat-700-latin.woff2",
  "./fonts/NotoArabic-400.woff2",
  "./fonts/NotoArabic-700.woff2",
  "./fonts/NotoBengali-400.woff2",
  "./fonts/NotoBengali-700.woff2",
  "./fonts/NotoDevanagari-400.woff2",
  "./fonts/NotoDevanagari-700.woff2",
  "./fonts/NotoSans-400-latin-ext.woff2",
  "./fonts/NotoSans-400-latin.woff2",
  "./fonts/NotoSans-700-latin-ext.woff2",
  "./fonts/NotoSans-700-latin.woff2",
  "./fonts/NotoSinhala-400.woff2",
  "./fonts/NotoSinhala-700.woff2",
  "./fonts/PTSerif-400-latin-ext.woff2",
  "./fonts/PTSerif-400-latin.woff2",
  "./fonts/PTSerif-700-latin-ext.woff2",
  "./fonts/PTSerif-700-latin.woff2",
  "./fonts/Playfair-400-latin-ext.woff2",
  "./fonts/Playfair-400-latin.woff2",
  "./fonts/Playfair-700-latin-ext.woff2",
  "./fonts/Playfair-700-latin.woff2",
  "./fonts/PlexMono-400-latin-ext.woff2",
  "./fonts/PlexMono-400-latin.woff2",
  "./fonts/PlexMono-700-latin-ext.woff2",
  "./fonts/PlexMono-700-latin.woff2",
  "./fonts/SpaceGrotesk-700-latin-ext.woff2",
  "./fonts/SpaceGrotesk-700-latin.woff2",
  "./fonts/currency-bengali.woff2",
  "./fonts/currency-latinext.woff2",
  "./fonts/currency-symbols.woff2",
  "./fonts/currency-thai.woff2",
  "./fonts/inter-variable.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-48.png",
  "./icons/icon-512.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./img/templates/agency.webp",
  "./img/templates/apple.webp",
  "./img/templates/classic.webp",
  "./img/templates/compact.webp",
  "./img/templates/construction.webp",
  "./img/templates/corporate.webp",
  "./img/templates/dark.webp",
  "./img/templates/freelancer.webp",
  "./img/templates/legal.webp",
  "./img/templates/luxury.webp",
  "./img/templates/manufacturing.webp",
  "./img/templates/medical.webp",
  "./img/templates/modern.webp",
  "./img/templates/realestate.webp",
  "./img/templates/restaurant.webp",
  "./img/templates/retail.webp",
  "./img/templates/technology.webp",
  "./js/accent.js",
  "./js/backup.js",
  "./js/brandTemplates.js",
  "./js/calc.js",
  "./js/calculators.js",
  "./js/catalog.js",
  "./js/columnCanvas.js",
  "./js/columnDialog.js",
  "./js/currencySearch.js",
  "./js/docType.js",
  "./js/dom.js",
  "./js/features.js",
  "./js/formEditor.js",
  "./js/format.js",
  "./js/i18n.js",
  "./js/icons.js",
  "./js/importSheet.js",
  "./js/install.js",
  "./js/invoiceData.js",
  "./js/items.js",
  "./js/layout.js",
  "./js/library.js",
  "./js/logo.js",
  "./js/main.js",
  "./js/pdfExport.js",
  "./js/persistence.js",
  "./js/preview.js",
  "./js/print.js",
  "./js/reports.js",
  "./js/settings.js",
  "./js/state.js",
  "./js/toast.js",
  "./js/toggles.js",
  "./js/uxExtras.js",
  "./js/vendor/qrcode.js",
  "./js/vendor/xlsx.full.min.js",
  "./js/version.js",
  "./js/words.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // One missing/renamed file must never abort the whole install (that
      // is how a stale precache entry once left the app with no working
      // service worker, and therefore not installable/offline-capable).
      // Add each asset on its own and just log any that fail.
      .then((cache) => Promise.all(SHELL_ASSETS.map((url) =>
        cache.add(new Request(url, { cache: "reload" })).catch((err) => console.warn("SW precache skipped", url, err)))))
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
    fetch(request.url, { cache: "no-cache", credentials: "same-origin" })
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
