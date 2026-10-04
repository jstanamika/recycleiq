const CACHE = 'recycleiq-shell-v5';
const ASSETS = [
  '/', '/index.html', '/css/styles.css', '/js/app.js', '/js/storage.js', '/js/icons.js', '/js/model-config.js',
  '/data/waste-items.json', '/data/categories.json', '/data/quiz.json', '/data/translations.json',
  '/manifest.json', '/icons/recycleiq-official.png', '/icons/recycleiq-official-192.png', '/icons/recycleiq-official-512.png'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => { if(event.request.method !== 'GET') return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if(new URL(event.request.url).origin === self.location.origin){ const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); } return response; }).catch(() => caches.match('/index.html')))); });
