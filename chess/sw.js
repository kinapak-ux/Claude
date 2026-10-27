// Offline helper: always tries the network first so updates show straight away,
// and falls back to the last saved copy when there's no signal.
const CACHE = 'chess-v2';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const ours = url.origin === location.origin;
  if (!ours && !STATIC_HOSTS.includes(url.hostname)) return;
  // Our own files skip the browser's cache, so a new version shows up the next time you open the game.
  e.respondWith(
    fetch(ours ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: ours}).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});
