const CACHE = 'wash-fit-3c5556b96cb5';
const ASSETS = ["./","./index.html","./css/styles.css?v=3c5556b96cb5","./js/core.js?v=3c5556b96cb5","./js/storage.js?v=3c5556b96cb5","./js/pdf-report.js?v=3c5556b96cb5","./js/drive-archive.js?v=3c5556b96cb5","./js/app.js?v=3c5556b96cb5","./js/config/tailwind-config.js","./js/data/indicators.js?v=3c5556b96cb5","./img/barra.png","./img/paho-logo-blanco.png?v=3c5556b96cb5","./vendor/leaflet-LICENSE","./vendor/leaflet.css?v=3c5556b96cb5","./vendor/leaflet.js?v=3c5556b96cb5","./vendor/lucide-LICENSE","./vendor/lucide.js?v=3c5556b96cb5","./vendor/pdfmake-LICENSE","./vendor/pdfmake.min.js?v=3c5556b96cb5","./vendor/tailwind.css?v=3c5556b96cb5","./vendor/vfs_fonts.js?v=3c5556b96cb5","./vendor/vue-LICENSE","./vendor/vue.global.js?v=3c5556b96cb5","./vendor/images/layers-2x.png","./vendor/images/layers.png","./vendor/images/marker-icon-2x.png","./vendor/images/marker-icon.png","./vendor/images/marker-shadow.png"];
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
