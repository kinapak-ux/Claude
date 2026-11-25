// Offline helper: always tries the network first so updates show straight away,
// and falls back to the last saved copy when there's no signal.
const CACHE = 'pixtext-v1';
const SHELL = ['./', './screen.js', './rules.js', './pages.js', '../pixel-gaffer/data.js', '../pixel-gaffer/engine.js', '../pixel-gaffer/scenarios.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
// All the family games share one storage area, so only clear out this game's own older copies.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('pixtext-v')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const ours = url.origin === location.origin;
  if (!ours && !STATIC_HOSTS.includes(url.hostname)) return;
  e.respondWith(
    fetch(ours ? new Request(req.url, {cache: 'no-cache', credentials: 'same-origin'}) : req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: ours}).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});
