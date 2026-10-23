// Uygulama kabuğunu önbelleğe alır; telefonda ana ekrandan açılınca hızlı ve çevrimdışı da açılır.
// API istekleri (/api/*) hiçbir zaman önbelleğe alınmaz.
const CACHE = 'kirinti-v7';
const SHELL = [
  '/', '/index.html', '/styles.css', '/manifest.webmanifest',
  '/js/app.js', '/js/store.js', '/js/ai.js', '/js/impact.js', '/js/sample-tray.js', '/shared/gemini-core.js',
  '/js/i18n.js', '/js/i18n-en.js', '/js/charts.js', '/js/forecast.js', '/js/metrics.js', '/js/pilot.js', '/js/report.js', '/js/tour.js', '/js/voice.js', '/js/evidence.js',
  '/pilot/manifest.json',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Ağ öncelikli: yeni sürüm hemen gelsin, ağ yoksa önbellekten aç.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match('/index.html')))
  );
});
