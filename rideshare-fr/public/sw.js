const CACHE_VERSION = "chepetsaride-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  "/",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstNavigation(request) {
  try {
    const freshResponse = await fetch(request);
    const cache = await caches.open(APP_SHELL_CACHE);
    cache.put("/", freshResponse.clone());
    return freshResponse;
  } catch (_error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse ?? caches.match("/");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse ?? fetchPromise;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)
  );
}
