// Offline helper: always tries the network first so updates show straight away,
// and falls back to the last saved copy when there's no signal.
const CACHE = 'turbo-cross-v2';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './lib/three.module.min.js', './lib/GLTFLoader.js', './lib/BufferGeometryUtils.js',
  './models/ambulance.glb','./models/bannerTowerGreen.glb','./models/bannerTowerRed.glb','./models/barrierRed.glb','./models/barrierWall.glb','./models/barrierWhite.glb','./models/billboard.glb','./models/cactus_short.glb','./models/cactus_tall.glb','./models/delivery.glb','./models/fenceStraight.glb','./models/fence_simple.glb','./models/firetruck.glb','./models/flagCheckers.glb','./models/flagGreen.glb','./models/flagRed.glb','./models/grandStand.glb','./models/grandStandCovered.glb','./models/grass_large.glb','./models/hatchbackSports.glb','./models/lightPostLarge.glb','./models/log_large.glb','./models/overhead.glb','./models/overheadLights.glb','./models/pitsGarage.glb','./models/plant_bushLarge.glb','./models/police.glb','./models/pylon.glb','./models/race.glb','./models/raceFuture.glb','./models/rock_largeA.glb','./models/rock_largeB.glb','./models/rock_tallA.glb','./models/rock_tallB.glb','./models/sedan.glb','./models/sedanSports.glb','./models/stone_largeA.glb','./models/stone_tallA.glb','./models/suv.glb','./models/suvLuxury.glb','./models/taxi.glb','./models/tent.glb','./models/tentLong.glb','./models/tractor.glb','./models/treeLarge.glb','./models/treeSmall.glb','./models/tree_oak.glb','./models/tree_oak_fall.glb','./models/tree_palmTall.glb','./models/tree_pineRoundA.glb','./models/tree_pineTallA.glb','./models/truck.glb','./models/truckFlat.glb','./models/van.glb'];
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
// All the family games share one storage area, so only clear out this game's own older copies.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith(CACHE.replace(/\d+$/, ''))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const ours = url.origin === location.origin;
  if (!ours && !STATIC_HOSTS.includes(url.hostname)) return;
  e.respondWith(
    fetch(ours ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: ours}).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});
