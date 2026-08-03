/* Service worker — deja usar SuperCasa sin internet. */
const CACHE = 'supercasa-v1';

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/db.js',
  './js/app.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;   // links externos: siempre a la red
  // Network-first con respaldo en cache, así siempre ves la última versión
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
