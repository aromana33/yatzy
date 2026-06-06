const CACHE_NAME = 'yatzy-v3';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './poker.js',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
];

function isAppFile(url) {
  return ASSETS.some((asset) => {
    const path = asset === './' ? '/index.html' : asset.slice(1);
    return url.pathname.endsWith(path) || (asset === './' && url.pathname.endsWith('/'));
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isScriptOrStyle = /\.(js|css|html)$/.test(url.pathname);

  if (isNavigation || isScriptOrStyle || isAppFile(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) => cached || caches.match('./index.html')
          )
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
