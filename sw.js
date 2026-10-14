const CACHE = 'wash-fit-a8b9cd628dce';
const ASSETS = ["./","./index.html","./css/styles.css?v=a8b9cd628dce","./js/core.js?v=a8b9cd628dce","./js/storage.js?v=a8b9cd628dce","./js/pdf-report.js?v=a8b9cd628dce","./js/drive-archive.js?v=a8b9cd628dce","./js/app.js?v=a8b9cd628dce","./js/config/tailwind-config.js","./js/data/indicators.js?v=a8b9cd628dce","./img/barra.png","./img/paho-logo-blanco.png?v=a8b9cd628dce","./vendor/leaflet-LICENSE","./vendor/leaflet.css?v=a8b9cd628dce","./vendor/leaflet.js?v=a8b9cd628dce","./vendor/lucide-LICENSE","./vendor/lucide.js?v=a8b9cd628dce","./vendor/pdfmake-LICENSE","./vendor/pdfmake.min.js?v=a8b9cd628dce","./vendor/tailwind.css?v=a8b9cd628dce","./vendor/vfs_fonts.js?v=a8b9cd628dce","./vendor/vue-LICENSE","./vendor/vue.global.js?v=a8b9cd628dce","./vendor/images/layers-2x.png","./vendor/images/layers.png","./vendor/images/marker-icon-2x.png","./vendor/images/marker-icon.png","./vendor/images/marker-shadow.png"];
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
