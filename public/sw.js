// Service worker for Aware: lagrer appskallet slik at appen kan starte uten nett.
// Kartfliser håndteres av IndexedDB-laget i appen, og /api/* røres aldri.

const params = new URL(self.location.href).searchParams;
const BUILD_ID = params.get('b') || 'dev';
const BUILD_TIME = params.get('t') || '0';
const CACHE_PREFIX = 'aware-shell-';
const CACHE = `${CACHE_PREFIX}${BUILD_TIME}-${BUILD_ID}`;
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(new Request('/', { cache: 'reload' }));
      const res = await fetch(`/_next/static/${BUILD_ID}/precache-manifest.json`, { cache: 'reload' });
      if (!res.ok) throw new Error('precache manifest mangler');
      const urls = await res.json();
      await Promise.all(urls.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Behold nyeste og forrige versjon, slik at en åpen side kan hente gamle filer
      const names = (await caches.keys()).filter((n) => n.startsWith(CACHE_PREFIX)).sort().reverse();
      await Promise.all(names.slice(2).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

async function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put('/', response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match('/');
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Kun hovedsiden har offline-skall; andre sider (f.eks. invitasjoner) krever nett
    if (url.pathname === '/') event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/pwa-icon/')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
