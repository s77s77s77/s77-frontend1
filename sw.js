// sw.js ✅ S77 - cache con versionado + limpieza automática
// ✅ NO cachea manifest ni íconos (para que no queden pegados viejos)
const SW_VERSION = "s77-v2026-02-08-03";

// ✅ Cacheamos solo assets que ayudan a cargar rápido (incluye splash)
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./bg.jpg",
  "./bg-casino-square.png",
  "./bg-casino-green.png",
  "./btn-neon-cian.png",
  "./btn-neon-gold.png",
  "./bg-acierto-blue.png",
  "./splash.png",
  "./sw.js"
];

// ❌ Nunca cachear estos
const NO_CACHE = new Set([
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
]);

function isNoCacheRequest(reqUrl){
  try{
    const u = new URL(reqUrl);
    return NO_CACHE.has(u.pathname);
  }catch(e){
    return false;
  }
}

// Instalación: precache mínimo
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activación: borrar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SW_VERSION)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Estrategia:
// - HTML: network-first
// - Assets estáticos: cache-first
// - API onrender: network-only
// - manifest + icons: network-only (para que cambien de verdad)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ❌ No cachear manifest ni icons (siempre red)
  if (isNoCacheRequest(req.url)) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // ❌ No cachear API
  if (url.hostname.includes("onrender.com") && url.pathname.startsWith("/api")) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML navegación
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(SW_VERSION);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match("./index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Assets estáticos
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      const fresh = await fetch(req);
      if (url.origin === self.location.origin) {
        const cache = await caches.open(SW_VERSION);
        cache.put(req, fresh.clone());
      }
      return fresh;
    })()
  );
});

// Permite forzar actualización
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

