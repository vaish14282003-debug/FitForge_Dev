/*
 * FitForge service worker: lets the installed app open and log workouts without signal.
 *
 * - /api/*: never touched. Data is always live; the app keeps its own offline copies (lib/offline.ts).
 * - Build files (/_next/static/*, hashed and immutable), icons, fonts, images, the 3D model:
 *   cache-first, since a given URL never changes.
 * - Pages: network-first, keeping the last good copy for when there's no signal. Pages hold no
 *   personal data (everything personal is fetched by the page through /api), so the copies are safe.
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const STATIC_CACHE = `ff-static-${VERSION}`;
const PAGE_CACHE = `ff-pages-${VERSION}`;
const MAX_STATIC_ENTRIES = 300;

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0707"><title>Offline · FitForge</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0707;color:#f5efee;font-family:system-ui,sans-serif;text-align:center;padding:24px}p{color:#a9a09e;max-width:28rem;line-height:1.5}a{display:inline-block;margin-top:16px;background:#ff2d1f;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px}</style></head>
<body><main><h1>You're offline</h1><p>This page hasn't been opened on this phone yet, so it isn't available without signal. Your workouts still save on the phone and upload when you're back online.</p><a href="/workouts">Go to my workouts</a></main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
      for (const name of await caches.keys()) if (name.startsWith("ff-") && !keep.has(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/models/") ||
  /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|glb)$/.test(url.pathname);

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    trim(STATIC_CACHE, MAX_STATIC_ENTRIES);
  }
  return response;
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  // One copy per page, whatever the query string (e.g. ?plan=…&day=… on the workout screen).
  const key = url.origin + url.pathname;
  try {
    const response = await fetch(request);
    // Only real pages: not redirects (e.g. to /login when signed out) or errors.
    if (response.ok && !response.redirected && response.type === "basic") {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(key, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(key);
    if (cached) return cached;
    return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else (e.g. Next.js page-data requests) goes to the network as usual. If that fails
  // offline, Next.js falls back to a full page load, which the navigate handler above serves.
});

// Signing out from the app clears the remembered pages.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGE_CACHE));
});
