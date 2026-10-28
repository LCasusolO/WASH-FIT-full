const CACHE = 'wash-fit-6b1fb065f0aa';
const ASSETS = ["./","./index.html","./css/styles.css?v=6b1fb065f0aa","./js/core.js?v=6b1fb065f0aa","./js/storage.js?v=6b1fb065f0aa","./js/chrome-report.js?v=6b1fb065f0aa","./js/report-radar.js?v=6b1fb065f0aa","./js/drive-archive.js?v=6b1fb065f0aa","./js/app.js?v=6b1fb065f0aa","./js/config/tailwind-config.js","./js/data/indicators.js?v=6b1fb065f0aa","./img/barra.png","./img/paho-logo-blanco.png?v=6b1fb065f0aa","./vendor/leaflet-LICENSE","./vendor/leaflet.css?v=6b1fb065f0aa","./vendor/leaflet.js?v=6b1fb065f0aa","./vendor/lucide-LICENSE","./vendor/lucide.js?v=6b1fb065f0aa","./vendor/tailwind.css?v=6b1fb065f0aa","./vendor/vue-LICENSE","./vendor/vue.global.js?v=6b1fb065f0aa","./vendor/images/layers-2x.png","./vendor/images/layers.png","./vendor/images/marker-icon-2x.png","./vendor/images/marker-icon.png","./vendor/images/marker-shadow.png"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('wash-fit-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  // Al abrir la web se usa el HTML actual; sin conexión se recupera la copia instalada.
  // No se recarga ninguna evaluación que el usuario ya tenga abierta.
  if (event.request.mode === 'navigate' && url.origin === scope.origin && [scope.pathname, scope.pathname + 'index.html'].includes(url.pathname)) {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) throw new Error('Navigation unavailable');
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match('./'))));
    return;
  }
  // Solo recursos estáticos de esta aplicación; los datos permanecen en IndexedDB.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.some(asset => new URL(asset, self.registration.scope).href === url.href)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(cached => cached || fetch(event.request))));
});
self.addEventListener('message', event => {
  if (event.data === 'offline-status') event.ports[0]?.postMessage('offline-ready');
  if (event.data === 'activate-update') self.skipWaiting();
});
