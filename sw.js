const CACHE = 'wash-fit-da840031de49';
const ASSETS = ["./","./index.html","./css/styles.css?v=da840031de49","./js/core.js?v=da840031de49","./js/storage.js?v=da840031de49","./js/pdf-report.js?v=da840031de49","./js/drive-archive.js?v=da840031de49","./js/app.js?v=da840031de49","./js/config/tailwind-config.js","./js/data/indicators.js?v=da840031de49","./img/barra.png","./img/paho-logo-blanco.png?v=da840031de49","./vendor/leaflet-LICENSE","./vendor/leaflet.css?v=da840031de49","./vendor/leaflet.js?v=da840031de49","./vendor/lucide-LICENSE","./vendor/lucide.js?v=da840031de49","./vendor/pdfmake-LICENSE","./vendor/pdfmake.min.js?v=da840031de49","./vendor/tailwind.css?v=da840031de49","./vendor/vfs_fonts.js?v=da840031de49","./vendor/vue-LICENSE","./vendor/vue.global.js?v=da840031de49","./vendor/images/layers-2x.png","./vendor/images/layers.png","./vendor/images/marker-icon-2x.png","./vendor/images/marker-icon.png","./vendor/images/marker-shadow.png"];
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
