// sw.js  ✅ S77 - cache con versionado + limpieza automática
// Cambiá esta versión cada vez que subas cambios:
const SW_VERSION = "s77-v2026-02-04-01";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./sw.js",
];

// Instalación: precache mínimo
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting(); // ✅ toma control más rápido
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
// - HTML (navegación): network-first (si hay red, trae lo nuevo; si no, usa cache)
// - Assets estáticos: cache-first
// - Requests externos (API onrender): network-only (no cachear)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ✅ No cachear tu API (muy importante)
  // Ajustá si tu API cambia:
  if (url.hostname.includes("onrender.com") && url.pathname.startsWith("/api")) {
    event.respondWith(fetch(req));
    return;
  }

  // ✅ Navegación (HTML): network-first
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

  // ✅ Archivos estáticos: cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      const fresh = await fetch(req);
      // Guardar solo mismos-orígenes
      if (url.origin === self.location.origin) {
        const cache = await caches.open(SW_VERSION);
        cache.put(req, fresh.clone());
      }
      return fresh;
    })()
  );
});

// ✅ Permite “saltear espera” desde el cliente
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
