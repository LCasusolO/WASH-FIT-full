const CACHE = 'wash-fit-350134357cde';
const ASSETS = ["./","./index.html","./css/styles.css?v=350134357cde","./js/core.js?v=350134357cde","./js/storage.js?v=350134357cde","./js/app.js?v=350134357cde","./js/config/tailwind-config.js","./js/data/indicators.js?v=350134357cde","./img/barra.png","./img/paho-logo-blanco.png?v=350134357cde","./vendor/leaflet-LICENSE","./vendor/leaflet.css?v=350134357cde","./vendor/leaflet.js?v=350134357cde","./vendor/lucide-LICENSE","./vendor/lucide.js?v=350134357cde","./vendor/tailwind.css?v=350134357cde","./vendor/vue-LICENSE","./vendor/vue.global.js?v=350134357cde","./vendor/images/layers-2x.png","./vendor/images/layers.png","./vendor/images/marker-icon-2x.png","./vendor/images/marker-icon.png","./vendor/images/marker-shadow.png"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('wash-fit-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Solo recursos estáticos de esta aplicación; los datos permanecen en IndexedDB.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.some(asset => new URL(asset, self.registration.scope).href === url.href)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(cached => cached || fetch(event.request))));
});
self.addEventListener('message', event => {
  if (event.data === 'offline-status') event.ports[0]?.postMessage('offline-ready');
  if (event.data === 'activate-update') self.skipWaiting();
});
