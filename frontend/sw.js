const CACHE_NAME = 'smartlib-pwa-v1';
const urlsToCache = [
  './index.html',
  './student.html',
  './admin.html',
  './css/landing.css',
  './css/style.css',
  './js/app.js',
  './js/admin.js',
  './js/landing.js',
  './logo.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
