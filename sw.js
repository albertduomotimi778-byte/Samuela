
const CACHE_NAME = 'soulsync-v4';

const PRECACHE_URLS = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@^19.2.4',
  'https://esm.sh/react-dom@^19.2.4'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
      event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
      return;
  }
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
