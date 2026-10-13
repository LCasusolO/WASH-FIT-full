const CACHE = 'wash-fit-350134357cde';
const ASSETS = ["./","./index.html","./css/styles.css","./js/core.js","./js/storage.js","./js/app.js","./js/config/tailwind-config.js","./js/data/indicators.js","./img/barra.png","./img/paho-logo-blanco.png","./vendor/leaflet-LICENSE","./vendor/leaflet.css","./vendor/leaflet.js","./vendor/lucide-LICENSE","./vendor/lucide.js","./vendor/tailwind.css","./vendor/vue-LICENSE","./vendor/vue.global.js","./vendor/images/layers-2x.png","./vendor/images/layers.png","./vendor/images/marker-icon-2x.png","./vendor/images/marker-icon.png","./vendor/images/marker-shadow.png"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('wash-fit-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Solo recursos estáticos de esta aplicación; los datos permanecen en IndexedDB.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || !ASSETS.some(asset => new URL(asset, self.registration.scope).pathname === url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(cached => cached || fetch(event.request))));
});
self.addEventListener('message', event => {
  if (event.data === 'offline-status') event.ports[0]?.postMessage('offline-ready');
  if (event.data === 'activate-update') self.skipWaiting();
});
