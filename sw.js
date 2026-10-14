const CACHE = 'wash-fit-34d1b964e34d';
const ASSETS = ["./","./index.html","./css/styles.css?v=34d1b964e34d","./js/core.js?v=34d1b964e34d","./js/storage.js?v=34d1b964e34d","./js/pdf-report.js?v=34d1b964e34d","./js/drive-archive.js?v=34d1b964e34d","./js/app.js?v=34d1b964e34d","./js/config/tailwind-config.js","./js/data/indicators.js?v=34d1b964e34d","./img/barra.png","./img/paho-logo-blanco.png?v=34d1b964e34d","./vendor/leaflet-LICENSE","./vendor/leaflet.css?v=34d1b964e34d","./vendor/leaflet.js?v=34d1b964e34d","./vendor/lucide-LICENSE","./vendor/lucide.js?v=34d1b964e34d","./vendor/pdfmake-LICENSE","./vendor/pdfmake.min.js?v=34d1b964e34d","./vendor/tailwind.css?v=34d1b964e34d","./vendor/vfs_fonts.js?v=34d1b964e34d","./vendor/vue-LICENSE","./vendor/vue.global.js?v=34d1b964e34d","./vendor/images/layers-2x.png","./vendor/images/layers.png","./vendor/images/marker-icon-2x.png","./vendor/images/marker-icon.png","./vendor/images/marker-shadow.png"];
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
