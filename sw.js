// sw.js
const CACHE_NAME = "pdf-reader-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./lib/pdfjs/pdf.js",
  "./lib/pdfjs/pdf.worker.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// Instalación: precache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activación: limpia versiones viejas
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

// Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo cachea peticiones de tu origen (GitHub Pages / dominio propio)
  const isSameOrigin = self.location.origin === url.origin;

  if (isSameOrigin) {
    // App shell: cache-first
    if (APP_SHELL.some(p => url.pathname.endsWith(p.replace("./","/")))) {
      event.respondWith(cacheFirst(req));
      return;
    }

    // JS/MJS locales: network-first (para facilitar desarrollo)
    if (url.pathname.endsWith(".mjs") || url.pathname.endsWith(".js")) {
      event.respondWith(networkFirst(req));
      return;
    }

    // HTML: network-first con fallback caché
    if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
      event.respondWith(networkFirst(req));
      return;
    }
  }

  // Por defecto: intenta red, luego caché si existe
  event.respondWith(networkThenCache(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  return cached || fetch(req);
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw e;
  }
}

async function networkThenCache(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response("Offline", { status: 503, statusText: "Offline" });
  }
}
