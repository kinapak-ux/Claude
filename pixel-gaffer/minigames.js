// Pixel Gaffer '96: the mini-games. Each returns a Promise with the result.
'use strict';
const ADS = ['PIXEL', 'GAFFER', 'SCARVES', 'PIES', 'HOT TEA', 'CRISPS', '1996'];

function miniOverlay(title, hint, opts) {
  opts = opts || {};
  const el = document.createElement('div');
  el.className = 'mini';
  el.innerHTML = `<div class="mhead"><button class="mback">◀ Back</button><span class="mt">${title}</span><span class="ms" id="mscore">${opts.score || ''}</span></div>
    <div class="mwrap"><canvas class="mcv"></canvas></div><div class="mhint">${hint}</div>${opts.skip === false ? '' : `<button class="btn ghost small mskip">${opts.skipTxt || 'Let the computer decide'}</button>`}`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas');
  cv.width = opts.w || 200; cv.height = opts.h || 170;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const ov = {el, cv, g, quit: false, hint: t => { el.querySelector('.mhint').innerHTML = t; }, score: t => { el.querySelector('#mscore').innerHTML = t; }, close: () => el.remove()};
  // Back: leave the mini-game. Callers check ov.quit; a running scene finishes at once.
  el.querySelector('.mback').onclick = () => { ov.quit = true; if (ov.onBack) ov.onBack(); };
  return ov;
}
// Runs a scene until it calls finish(result).
function runScene(ov, scene) {
  return new Promise(resolve => {
    let last = performance.now(), fin = null, dead = false;
    scene.finish = (res, wait) => { if (fin) return; fin = {res, at: performance.now() + (wait ?? 1300)}; };
    const tap = e => { e.preventDefault(); SND.init(); if (!fin && scene.tap) { const r = ov.cv.getBoundingClientRect(); scene.tap((e.clientX - r.left) / r.width * ov.cv.width, (e.clientY - r.top) / r.height * ov.cv.height); } };
    const wrap = ov.el.querySelector('.mwrap');
    wrap.addEventListener('pointerdown', tap);
    const skip = ov.el.querySelector('.mskip'), prev = skip && skip.onclick;
    if (skip) skip.onclick = () => { if (prev) prev(); if (!fin) scene.finish(scene.auto ? scene.auto() : null, 0); };
    ov.onBack = () => { if (!fin) scene.finish(scene.auto ? scene.auto() : null, 0); };
    scene.parts = scene.parts || []; scene.shake = 0;
    const loop = now => {
      if (dead) return;
      const dt = Math.min(50, now - last); last = now;
      scene.t = (scene.t || 0) + dt;
      if (scene.update) scene.update(dt);
      stepParts(scene, dt);
      const g = ov.g;
      g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
      const s = scene.shake > 0 ? Math.round((R() - .5) * 2 * Math.min(2, scene.shake / 120)) : 0;
      scene.shake = Math.max(0, scene.shake - dt);
      g.setTransform(1, 0, 0, 1, s, s ? Math.round((R() - .5) * 2) : 0);
      scene.draw(g);
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (fin && now >= fin.at) { dead = true; wrap.removeEventListener('pointerdown', tap); resolve(fin.res); return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

// ---------- pixel sprites: little maps compiled to canvases, with a dark outline added
const MAPS = {
  back: ['....hhhh.....', '...hhhhhh....', '...hhhhhh....', '...hhhhhH....', '....kkkK.....', '..ssssssSS...', '.sssssssSSS..', '.ssnnnnsSSS..',
    '.sssssnsSSS..', 'kssssnssSSSk.', 'kssssnssSSSK.', 'k.ssnsssSS.K.', '..sssssSSS...', '..dddddDDD...', '..dddddDDD...', '..ddd..DDD...'],
  legsStand: ['..kkk..kkK...', '..kkk..kkK...', '..sss..ssS...', '..sss..ssS...', '..sss..ssS...', '..bbb..bbb...', '.bbbb..bbbb..'],
  legsKick: ['..kkk..kkK...', '..kkk...kkK..', '..sss....ssS.', '..sss.....ssS', '..sss.....bbb', '..bbb........', '.bbbb........'],
  legsRunA: ['..kkk..kkK...', '..kkk...kK...', '..sss...sS...', '..sss....bb..', '..sss........', '..bbb........', '.bbbb........'],
  legsRunB: ['..kkk..kkK...', '..kk...kkK...', '..ss...ssS...', '..bb...ssS...', '.......ssS...', '.......bbb...', '.......bbbb..'],
  gk: ['......hhh......', '.....hhhhh.....', '.....kekeK.....', '.....kkkkK.....', '......kKk......', '...sssssssSS...', '..ssssssssSSS..', '.sss.sssssS.SS.',
    '.ss..sssssS..SS', 'gg...sssssS...G', 'gG...sssssS..GG', '.....dddddD....', '.....dddddD....', '.....dd..dD....', '....kk....kK...', '....kk....kK...',
    '....ss....sS...', '....ss....sS...', '...bbb....bbb..'],
  gkUp: ['gg...........GG', 'gGs..........SG', '..ss..hhh...SS.', '...sshhhhhSS...', '....skekeKS....', '.....kkkkK.....', '......kKk......', '....sssssSS....',
    '...ssssssSSS...', '....sssssSS....', '....sssssSS....', '.....dddddD....', '.....dddddD....', '.....dd..dD....', '....kk....kK...', '....kk....kK...',
    '....ss....sS...', '....ss....sS...', '...bbb....bbb..'],
  dive: ['gg......................', 'gGss....................', '..ssshhh................', '...sshhhhsssssSSS.......', '....kekeKsssssSSSdddD...',
    '....kkkkKsssssSSSdddDkkss', '.....kKk.sssssSS.dddDkksb', '..........ggsS.....kk.sb', '...........gG............'],
  wall: ['...hhhh...', '..hhhhhh..', '..kekeKk..', '..kkkkKk..', '...kkKk...', '.ssssssSS.', 'sssssssSSS', 'sss.ssSS.S', 'kss.ssS.SK', 'k.kkkkKK.K',
    '..dddddDD.', '..dddddDD.', '..ddd.dDD.', '..kk...kK.', '..kk...kK.', '..ss...sS.', '..ss...sS.', '.bbb...bbb'],
  front: ['...hhhh...', '..hhhhhh..', '..kekeKk..', '..kkkkKk..', '...kkKk...', '.ssssssSS.', 'sssssssSSS', 'sssssssS.S', 'kssssssS.K', 'k.ssssSS.K',
    '..dddddDD.', '..dddddDD.', '..ddd.dDD.', '..kk...kK.', '..kk...kK.', '..ss...sS.', '..ss...sS.', '.bbb...bbb'],
  frontKick: ['...hhhh...', '..hhhhhh..', '..kekeKk..', '..kkkkKk..', 'k..kkKk...', 'kssssssSS.', '.ssssssSSS', '..sssssS.S', '..sssssS.K', '..ssssSS.K',
    '..dddddDD.', '..dddddDD.', '..dd.kkkKK', '..kk...ssS', '..kk...bbb', '..ss......', '..ss......', '.bbb......'],
};
const sprCache = {};
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => clamp(Math.round(v * f), 0, 255));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function palette(kit, look) {
  look = look || {};
  const skin = look.skin || '#f1c7a0', shorts = kit.shorts || '#ffffff';
  return {h: look.hair || '#2a1a0e', H: shade(look.hair || '#2a1a0e', .7), k: skin, K: shade(skin, .82), e: '#1a1010', s: kit.shirt, S: shade(kit.shirt, .7),
    n: sameish(kit.shirt, shorts) ? (sameish(kit.shirt, '#ffffff') ? '#1a1a1a' : '#ffffff') : shorts, d: shorts, D: shade(shorts, .72), b: '#151515', g: '#f4f4f4', G: '#b4b8c8'};
}
function spr(rows, pal) {
  const key = rows.join('|') + JSON.stringify(pal);
  if (sprCache[key]) return sprCache[key];
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const cv = document.createElement('canvas'); cv.width = w + 2; cv.height = h + 2;
  const g = cv.getContext('2d');
  const on = (x, y) => y >= 0 && y < h && x >= 0 && x < rows[y].length && rows[y][x] !== '.';
  g.fillStyle = 'rgba(6,6,18,.8)';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) if (on(x, y)) { g.fillStyle = pal[rows[y][x]] || '#f0f'; g.fillRect(x + 1, y + 1, 1, 1); }
  return sprCache[key] = cv;
}
// draw a sprite with its feet at (x, y)
function blit(g, cv, x, y, sc, flip) {
  sc = sc || 1;
  const w = cv.width * sc, h = cv.height * sc, X = Math.round(x - w / 2), Y = Math.round(y - h);
  if (flip) { g.save(); g.translate(X + w, Y); g.scale(-1, 1); g.drawImage(cv, 0, 0, w, h); g.restore(); }
  else g.drawImage(cv, X, Y, w, h);
}
const lookOf = seed => ({skin: SKIN[seed % SKIN.length], hair: HAIR[(seed >> 1) % HAIR.length]});
function shadow(g, x, y, w) { g.fillStyle = 'rgba(0,0,0,.28)'; w = Math.max(2, Math.round(w)); g.fillRect(Math.round(x - w / 2), Math.round(y), w, 1); g.fillRect(Math.round(x - w / 2 + 1), Math.round(y) + 1, Math.max(1, w - 2), 1); }

// a shaded football with spinning panels
function ballSpr(d, f) {
  const key = 'ball' + d + '_' + f;
  if (sprCache[key]) return sprCache[key];
  const cv = document.createElement('canvas'); cv.width = d + 2; cv.height = d + 2;
  const g = cv.getContext('2d'), r = d / 2, c = d / 2 + 1;
  const a = f * 1.05, pts = d >= 5 ? [[0, 0]].concat([0, 2.1, 4.2].map(k => [Math.cos(a + k) * r * .62, Math.sin(a + k) * r * .62])) : [];
  for (let y = 0; y < d + 2; y++) for (let x = 0; x < d + 2; x++) {
    const dx = x + .5 - c, dy = y + .5 - c, dist = Math.hypot(dx, dy);
    if (dist > r + .7) continue;
    let col = dist > r - .4 ? '#20232c' : (dx + dy) > r * .55 ? '#c4c9d6' : '#ffffff';
    if (dist <= r - .4 && pts.some(([px, py]) => Math.hypot(dx - px, dy - py) < (d >= 8 ? 1.25 : .85))) col = (dx + dy) > r * .55 ? '#15161c' : '#2a2c36';
    if (dist <= r - .4 && dx < -r * .25 && dy < -r * .25 && dx > -r * .7 && dy > -r * .7 && d >= 6) col = '#ffffff';
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  return sprCache[key] = cv;
}
function drawBall(g, x, y, r, spin, gy) {
  const d = clamp(Math.round(r * 2), 3, 12);
  if (gy != null) shadow(g, x, gy, d * .9);
  const cv = ballSpr(d, ((Math.floor(spin || 0) % 6) + 6) % 6);
  g.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height / 2));
}

// ---------- particles: confetti, dust, sparks
function burst(sc, x, y, n, cols, opts) {
  opts = opts || {};
  for (let i = 0; i < n; i++) sc.parts.push({x, y, vx: (R() - .5) * (opts.sp || .14), vy: -R() * (opts.up || .12) - .02, g: opts.g ?? .00025, life: opts.life || 1400 + R() * 600, t: 0, c: pick(cols), w: R() < .5 ? 2 : 1});
}
function stepParts(sc, dt) { (sc.parts || []).forEach(p => { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }); sc.parts = (sc.parts || []).filter(p => p.t < p.life); }
function drawParts(g, sc) { sc.parts.forEach(p => { g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.w, 1); }); }
const CONFETTI = ['#ffd23f', '#ff4b55', '#5fe3ff', '#3ddc5a', '#ffffff', '#ff7ae0'];

// ---------- the goal-mouth scene shared by penalties and free kicks
const GOAL = {l: 46, r: 154, top: 40, line: 82};
let goalBg = null, fans = null;
function goalBackground() {
  if (goalBg) return goalBg;
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 170;
  const g = cv.getContext('2d');
  // night sky, stand roof and floodlights
  g.fillStyle = '#0a0d24'; g.fillRect(0, 0, 200, 8);
  g.fillStyle = '#2b2f45'; g.fillRect(0, 3, 200, 3); g.fillStyle = '#41465f'; g.fillRect(0, 3, 200, 1);
  for (let x = 6; x < 200; x += 24) { g.fillStyle = '#1b1e30'; g.fillRect(x, 6, 2, 3); }
  [[2, 0], [178, 0]].forEach(([x]) => {
    g.fillStyle = '#5b6077'; g.fillRect(x, 0, 20, 3);
    for (let i = 0; i < 5; i++) { g.fillStyle = '#fff6c8'; g.fillRect(x + 1 + i * 4, 0, 3, 2); }
  });
  // terraces
  for (let y = 8; y < 30; y++) { g.fillStyle = y % 3 === 0 ? '#1d2138' : '#262b46'; g.fillRect(0, y, 200, 1); }
  g.fillStyle = '#3a3f5c'; for (let x = 33; x < 200; x += 34) g.fillRect(x, 8, 1, 22);
  // advertising boards
  const cols = ['#d8242c', '#1d3fbf', '#ffd23f', '#2a9d3f', '#ff8a1f'];
  for (let i = 0; i < 5; i++) {
    g.fillStyle = cols[i]; g.fillRect(i * 40, 29, 40, 8);
    g.fillStyle = shade(cols[i], 1.25); g.fillRect(i * 40, 29, 40, 1);
    g.fillStyle = shade(cols[i], .6); g.fillRect(i * 40, 36, 40, 1); g.fillRect(i * 40 + 39, 29, 1, 8);
  }
  g.font = `5px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) { g.fillStyle = i === 2 ? '#3a2a00' : '#ffffff'; g.fillText(ADS[i], i * 40 + 20, 33); }
  // grass: perspective stripes with a fine mowing texture
  let y = 37, h = 3, k = 0;
  while (y < 170) {
    const base = k++ % 2 ? '#2f9a3a' : '#288c32';
    g.fillStyle = base; g.fillRect(0, y, 200, h);
    g.fillStyle = shade(base, 1.08); for (let x = (k % 2) * 2; x < 200; x += 4) g.fillRect(x, y + (h > 3 ? 1 : 0), 1, 1);
    y += h; h = Math.min(20, Math.round(h * 1.28) + 1);
  }
  // the goal's shadow on the grass
  g.fillStyle = 'rgba(0,30,0,.25)'; g.fillRect(GOAL.l + 4, GOAL.line + 1, GOAL.r - GOAL.l - 2, 3);
  // markings: goal line, six-yard box, penalty area, the D
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillRect(0, GOAL.line, 200, 1);
  g.fillRect(24, 97, 152, 1); for (let i = 0; i < 15; i++) { g.fillRect(24 + Math.round(-i * .25), GOAL.line + i, 1, 1); g.fillRect(175 + Math.round(i * .25), GOAL.line + i, 1, 1); }
  for (let i = 0; i < 48; i++) { g.fillRect(Math.round(-6 - i * .6), GOAL.line + i, 1, 1); g.fillRect(Math.round(205 + i * .6), GOAL.line + i, 1, 1); }
  g.fillRect(0, 131, 200, 1);
  for (let a = 0; a <= 40; a++) { const t = a / 40 * Math.PI; g.fillRect(Math.round(100 - Math.cos(t) * 34), Math.round(131 + Math.sin(t) * 9), 1, 1); }
  // back of the goal and side nets
  g.fillStyle = '#1f5f27'; g.fillRect(GOAL.l + 1, GOAL.top + 1, GOAL.r - GOAL.l - 1, GOAL.line - GOAL.top - 1);
  g.fillStyle = 'rgba(200,200,220,.55)';
  g.fillRect(GOAL.l + 7, GOAL.top + 6, GOAL.r - GOAL.l - 13, 1);
  for (let yy = GOAL.top + 6; yy < GOAL.line - 4; yy++) { g.fillRect(GOAL.l + 7, yy, 1, 1); g.fillRect(GOAL.r - 7, yy, 1, 1); }
  for (let i = 0; i < 6; i++) { g.fillRect(GOAL.l + 1 + i, GOAL.top + 1 + i, 1, 1); g.fillRect(GOAL.r - 1 - i, GOAL.top + 1 + i, 1, 1); g.fillRect(GOAL.l + 7 - i, GOAL.line - 4 + Math.round(i * .7), 1, 1); g.fillRect(GOAL.r - 7 + i, GOAL.line - 4 + Math.round(i * .7), 1, 1); }
  return goalBg = cv;
}
function drawGoalScene(g, t, opts) {
  opts = opts || {};
  g.drawImage(goalBackground(), 0, 0);
  // the crowd
  if (!fans) { fans = []; for (let y = 10; y < 28; y += 3) for (let x = (y % 2) * 1; x < 200; x += 3) if (R() < .86) fans.push({x: x + ri(0, 1), y, s: pick(['#d8242c', '#ffffff', '#1d3fbf', '#ffd23f', '#2a9d3f', '#d8242c', '#5fb8ff', '#333']), k: pick(SKIN), p: ri(0, 9)}); }
  const cheer = opts.cheer;
  fans.forEach((f, i) => {
    const up = cheer ? ((Math.floor(t / 110) + f.p) % 3 === 0 ? -1 : 0) : ((Math.floor(t / 900) + f.p) % 9 === 0 ? -1 : 0);
    g.fillStyle = f.s; g.fillRect(f.x, f.y + 1 + up, 2, 2);
    g.fillStyle = f.k; g.fillRect(f.x, f.y + up, 2, 1);
    if (cheer && up) { g.fillRect(f.x - 1, f.y - 1, 1, 1); }
  });
  if (cheer && R() < .5) { g.fillStyle = '#ffffff'; g.fillRect(ri(0, 199), ri(9, 27), 1, 1); }
  // net with a diamond mesh that bulges where the ball hits
  const imp = opts.impact, age = imp ? t - imp.t : 1e9, amp = imp ? 4 * Math.max(0, 1 - age / 900) * Math.abs(Math.cos(age / 90)) : 0;
  g.fillStyle = 'rgba(235,240,255,.42)';
  for (let y = GOAL.top + 1; y < GOAL.line; y++) for (let x = GOAL.l + 1; x < GOAL.r; x++) {
    let sx = x, sy = y;
    if (amp > .2) { const dx = x - imp.x, dy = y - imp.y, d = Math.hypot(dx, dy); if (d < 22) { const f = amp * (1 - d / 22); sx = x + dx / (d || 1) * f; sy = y + dy / (d || 1) * f; } }
    const a = Math.round(sx + sy), b = Math.round(sx - sy);
    if (a % 5 === 0 || ((b % 5) + 5) % 5 === 0) g.fillRect(x, y, 1, 1);
  }
  // posts and bar, shaded
  g.fillStyle = '#ffffff'; g.fillRect(GOAL.l - 2, GOAL.top - 2, GOAL.r - GOAL.l + 4, 2); g.fillRect(GOAL.l - 2, GOAL.top, 2, GOAL.line - GOAL.top + 1); g.fillRect(GOAL.r, GOAL.top, 2, GOAL.line - GOAL.top + 1);
  g.fillStyle = '#b9bdd0'; g.fillRect(GOAL.l - 2, GOAL.top - 1, GOAL.r - GOAL.l + 4, 1); g.fillRect(GOAL.l - 1, GOAL.top, 1, GOAL.line - GOAL.top + 1); g.fillRect(GOAL.r + 1, GOAL.top, 1, GOAL.line - GOAL.top + 1);
  if (opts.spot) { g.fillStyle = '#ffffff'; g.fillRect(98, 151, 4, 1); g.fillRect(99, 152, 2, 1); }
}
// a keeper standing, stretching or diving, with feet at (x, y)
function drawKeeper(g, x, y, kit, lean, look, you) {
  const pal = palette(kit, look), a = Math.abs(lean);
  shadow(g, x, y - (a > .45 ? 2 : 0), a > .45 ? 22 : 12);
  if (a > .45) blit(g, spr(MAPS.dive, pal), x, y - 3 - Math.round(Math.min(1, a) * 6), 1, lean > 0);
  else if (a > .15) blit(g, spr(MAPS.gkUp, pal), x, y, 1, lean > 0);
  else blit(g, spr(MAPS.gk, pal), x, y, 1);
  if (you) { const bob = Math.floor(performance.now() / 250) % 2; g.fillStyle = '#ffd23f'; g.fillRect(Math.round(x) - 2, Math.round(y) - 27 - bob, 5, 1); g.fillRect(Math.round(x) - 1, Math.round(y) - 26 - bob, 3, 1); g.fillRect(Math.round(x), Math.round(y) - 25 - bob, 1, 1); }
}
function drawTaker(g, x, y, kit, look, legs, sc) {
  const pal = palette(kit, look);
  shadow(g, x, y - 1, 14 * (sc || 1));
  blit(g, spr(MAPS.back.concat(MAPS[legs]), pal), x, y, sc || 1);
}
function outlineText(g, txt, x, y, col, size, align) {
  g.font = `${size}px ${FONT}`; g.textAlign = align || 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#000';
  [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2]].forEach(([dx, dy]) => g.fillText(txt, x + dx, y + dy));
  g.fillStyle = col; g.fillText(txt, x, y);
}
function bannerText(g, txt, col, t, t0) {
  const k = clamp((t - (t0 || 0)) / 160, 0, 1), off = Math.round((1 - k) * -200);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 98, 200, 26);
  g.fillStyle = col; g.fillRect(off, 98, 200, 2); g.fillRect(-off, 122, 200, 2);
  for (let x = -20 + (Math.floor(t / 40) % 8); x < 200; x += 8) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, 100, 4, 22); }
  outlineText(g, txt, 100 + off, 111, Math.floor(t / 150) % 2 ? col : '#ffffff', 14);
}
function reticle(g, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  const o = 4 + (Math.floor(t / 180) % 2);
  const corner = (cx, cy, dx, dy) => { g.fillRect(cx, cy, 3 * dx || 1, 1); g.fillRect(cx, cy, 1, 3 * dy || 1); };
  [['#000', 1], ['#ffd23f', 0]].forEach(([c, s]) => {
    g.fillStyle = c;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => { const cx = x + dx * o + s, cy = y + dy * o + s; g.fillRect(dx < 0 ? cx : cx - 2, cy, 3, 1); g.fillRect(cx, dy < 0 ? cy : cy - 2, 1, 3); });
    g.fillRect(x + s, y + s, 1, 1);
  });
}
function meter(g, x, y, w, v, label, zone) {
  g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - 4, y - 9, w + 8, 18);
  g.fillStyle = '#4d63d6'; g.fillRect(x - 4, y - 9, w + 8, 1); g.fillRect(x - 4, y + 8, w + 8, 1);
  g.font = `5px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText(label, x, y - 5);
  g.fillStyle = '#111'; g.fillRect(x, y, w, 5);
  if (zone) { g.fillStyle = '#1f6b2b'; g.fillRect(x + Math.round(zone[0] * w), y, Math.round((zone[1] - zone[0]) * w), 5); }
  for (let i = 0; i < w; i++) { const f = i / w; if (f > v) break; g.fillStyle = f > .88 ? '#ff4b55' : f > .7 ? '#ffb02e' : '#ffd23f'; g.fillRect(x + i, y + 1, 1, 3); }
  g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 1; i < 10; i++) g.fillRect(x + Math.round(i * w / 10), y + 4, 1, 1);
  const mx = x + Math.round(v * w); g.fillStyle = '#ffffff'; g.fillRect(mx - 1, y - 2, 3, 1); g.fillRect(mx, y - 1, 1, 1);
}
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
function goalFx(sc, x, y) { sc.impact = {x, y, t: sc.t}; sc.shake = 380; burst(sc, 100, 20, 70, CONFETTI, {sp: .2, up: .05, g: .00012, life: 2200}); }

// ---------- PENALTY: you take it. Tap to aim, tap for power.
// opts: {taker: player, gk: player|null, kit: {shirt, shorts}, gkKit}
function penShoot(opts, ov) {
  const own = !ov; ov = ov || miniOverlay('PENALTY!', 'Tap to <b>aim</b>...');
  ov.hint(`${opts.taker ? pname(opts.taker) : 'You'} to take. Tap to <b>aim</b>...`);
  const sho = opts.taker ? opts.taker.a.sho : 12, gkv = opts.gk ? opts.gk.a.gk : 10;
  const gkKit = Object.assign({shirt: '#33d17a', shorts: '#1a1a1a'}, opts.gkKit || {});
  const sp = 1 - (sho - 10) * .025;
  const sc = {phase: 'aim', ax: 100, ay: 60, pow: 0, kx: 100, ky: 70, lean: 0, res: null, ballK: 0, t: 0, trail: [],
    lookT: lookOf(opts.taker ? opts.taker.id : 3), lookK: lookOf(opts.gk ? opts.gk.id + 5 : 8)};
  sc.update = dt => {
    const t = sc.t / 1000;
    if (sc.phase === 'aim') { sc.ax = 100 + 62 * Math.sin(t * 2.3 * sp); sc.ay = 60 + 23 * Math.sin(t * 3.4 * sp + 1); }
    if (sc.phase === 'power') { sc.pow = (Math.sin(sc.t / 1000 * 4.2 * sp - Math.PI / 2) + 1) / 2; sc.phaseT = sc.t; }
    if (sc.phase === 'fly') {
      const k = clamp((sc.t - sc.k0) / sc.dur, 0, 1); sc.ballK = k;
      const dk = ease((sc.t - sc.k0 - 60) / 330);
      sc.kx = lerp(100, sc.dive.x, dk); sc.ky = lerp(70, sc.dive.y, dk); sc.lean = (sc.dive.x - 100) / 60 * dk;
      if (k >= 1) result();
    }
  };
  const result = () => {
    sc.phase = 'done'; sc.resT = sc.t;
    const {tx, ty} = sc, inX = tx > GOAL.l + 1 && tx < GOAL.r - 1, inY = ty > GOAL.top + 1;
    let res;
    if (!inX || !inY) res = (Math.abs(tx - GOAL.l) < 4 || Math.abs(tx - GOAL.r) < 4 || Math.abs(ty - GOAL.top) < 4) && ty < GOAL.line ? 'post' : ty <= GOAL.top ? 'over' : 'wide';
    else res = Math.hypot(sc.kx - tx, (sc.ky - 6) - ty) < sc.reach ? 'saved' : 'goal';
    sc.res = res;
    if (res === 'goal') { SND.roar(); goalFx(sc, tx, ty); } else { SND.ooh(); if (res === 'saved') burst(sc, tx, ty, 10, ['#ffffff', '#c4c9d6'], {sp: .1, up: .08}); if (res === 'post') sc.shake = 200; }
    sc.finish(res === 'goal', 1500);
  };
  sc.tap = (x, y) => {
    SND.click();
    if (sc.phase === 'aim') { sc.phase = 'power'; sc.tx = sc.ax; sc.ty = sc.ay; ov.hint('Now tap for <b>power</b>. Not too hard!'); return; }
    if (sc.phase === 'power') {
      const p = sc.pow, err = 7 - sho * .25;
      sc.tx += (R() - .5) * err * 2; sc.ty += (R() - .5) * err;
      if (p > .86) sc.ty -= (p - .86) * 160;
      sc.dur = 330 + (1 - p) * 420;
      // the keeper guesses
      const read = R() < .26 + gkv / 55;
      sc.dive = read ? {x: clamp(sc.tx + (R() - .5) * 26, 48, 152), y: clamp(sc.ty + 4, 50, 80)} : {x: pick([60, 100, 140]) + ri(-8, 8), y: ri(55, 78)};
      sc.reach = 10 + gkv * .35 + (p < .4 ? 8 : 0) + (opts.gk && opts.gk.tr === 'cat' ? 3 : 0);
      sc.phase = 'fly'; sc.k0 = sc.t; SND.kick(); ov.hint('');
      burst(sc, 100, 152, 6, ['#6fbf5a', '#3a7a2a'], {sp: .06, up: .04});
    }
  };
  sc.auto = () => R() < penChance(opts.taker || {a: {sho: 12}}, opts.gk);
  sc.draw = g => {
    drawGoalScene(g, sc.t, {spot: true, cheer: sc.res === 'goal', impact: sc.impact});
    const idle = sc.phase === 'aim' || sc.phase === 'power' ? Math.round(Math.sin(sc.t / 300) * 3) : 0;
    drawKeeper(g, sc.kx + idle, sc.ky + 12, gkKit, sc.lean, sc.lookK);
    const kitT = opts.kit || {shirt: '#d8242c', shorts: '#fff'};
    const flying = sc.phase === 'fly' || sc.phase === 'done';
    // the ball, with a short trail, then the taker in front of it
    if (flying) {
      const k = sc.ballK, bx = lerp(100, sc.tx, k), gy = lerp(150, Math.min(GOAL.line + 2, sc.ty + 22), k), by = lerp(150, sc.ty, k) - Math.sin(k * Math.PI) * 6;
      if (sc.phase === 'fly') { sc.trail.push([bx, by]); sc.trail = sc.trail.slice(-4); }
      sc.trail.forEach(([x, y], i) => { g.fillStyle = `rgba(255,255,255,${.12 + i * .08})`; g.fillRect(Math.round(x), Math.round(y), 2, 2); });
      drawBall(g, bx, by, lerp(4, 2, k), sc.t / 50, gy);
    } else drawBall(g, 100, 148, 4, 0, 151);
    drawTaker(g, flying ? 108 : 116, 172, kitT, sc.lookT, flying && sc.t - sc.k0 < 300 ? 'legsKick' : 'legsStand', 2);
    if (sc.phase === 'aim' || sc.phase === 'power') reticle(g, sc.phase === 'aim' ? sc.ax : sc.tx, sc.phase === 'aim' ? sc.ay : sc.ty, sc.t);
    if (sc.phase === 'power') meter(g, 8, 156, 76, sc.pow, 'POWER', [.45, .86]);
    drawParts(g, sc);
    if (sc.res) bannerText(g, {goal: 'GOAL!', saved: 'SAVED!', wide: 'WIDE!', over: 'OVER!', post: 'POST!'}[sc.res], sc.res === 'goal' ? '#3ddc5a' : '#ff4b55', sc.t, sc.resT);
  };
  return runScene(ov, sc).then(r => { if (own) ov.close(); return r == null ? sc.auto() : r; });
}

// ---------- PENALTY: you're in goal. Tap where to dive. Early guess or quick reactions!
function penSave(opts, ov) {
  const own = !ov; ov = ov || miniOverlay('SAVE IT!', '');
  ov.hint(`${opts.taker ? pname(opts.taker) : 'They'} step${opts.taker ? 's' : ''} up... <b>3, 2, 1, then he shoots.</b> Watch the ball and tap where to dive!`);
  const sho = opts.taker ? opts.taker.a.sho + (opts.taker.tr === 'deadball' ? 4 : 0) : 12, gkv = opts.gk ? opts.gk.a.gk : 10;
  const gkKit = Object.assign({shirt: '#33d17a', shorts: '#1a1a1a'}, opts.gkKit || {});
  const kitT = opts.kit || {shirt: '#1d3fbf', shorts: '#fff'};
  const sc = {phase: 'run', kx: 100, ky: 70, lean: 0, dive: null, res: null, t: 0, runT: 1800, trail: [],
    lookT: lookOf(opts.taker ? opts.taker.id : 4), lookK: lookOf(opts.gk ? opts.gk.id + 5 : 9)};
  // where the taker goes
  const corner = R() < .5 ? -1 : 1, centre = R() < .15;
  sc.tx = centre ? 100 + ri(-10, 10) : 100 + corner * (30 + R() * 22 + (sho - 10) * .8);
  sc.ty = R() < .5 ? ri(46, 60) : ri(62, 78);
  const missP = clamp(.1 - (sho - 10) * .01, .02, .15);
  if (R() < missP) { if (R() < .5) sc.ty = GOAL.top - ri(3, 12); else sc.tx = 100 + corner * ri(56, 66); }
  // slower shots and a quicker dive than before, so you can react to the ball once it's struck
  sc.dur = clamp(660 - sho * 9, 450, 660);
  sc.reach = 11 + gkv * .35 + (opts.gk && opts.gk.tr === 'cat' ? 3 : 0);
  sc.update = dt => {
    if (sc.phase === 'run' && sc.t >= sc.runT) { sc.phase = 'fly'; sc.k0 = sc.t; SND.kick(); burst(sc, 100, 152, 6, ['#6fbf5a', '#3a7a2a'], {sp: .06, up: .04}); }
    if (sc.dive) {
      const k = ease((sc.t - sc.dive.t0) / 220);
      sc.kx = lerp(sc.dive.fx, sc.dive.x, k); sc.ky = lerp(sc.dive.fy, sc.dive.y, k); sc.lean = (sc.kx - 100) / 60;
    }
    if (sc.phase === 'fly') {
      sc.ballK = clamp((sc.t - sc.k0) / sc.dur, 0, 1);
      if (sc.ballK >= 1) {
        sc.phase = 'done'; sc.resT = sc.t;
        const inX = sc.tx > GOAL.l + 1 && sc.tx < GOAL.r - 1, inY = sc.ty > GOAL.top + 1;
        sc.res = !inX || !inY ? 'miss' : Math.hypot(sc.kx - sc.tx, (sc.ky - 6) - sc.ty) < sc.reach ? 'saved' : 'goal';
        if (sc.res === 'goal') { SND.ooh(); sc.impact = {x: sc.tx, y: sc.ty, t: sc.t}; sc.shake = 200; }
        else { SND.roar(); burst(sc, 100, 20, 60, CONFETTI, {sp: .2, up: .05, g: .00012, life: 2200}); if (sc.res === 'saved') burst(sc, sc.tx, sc.ty, 12, ['#ffffff', '#c4c9d6'], {sp: .1, up: .08}); }
        sc.finish(sc.res === 'goal', 1500);
      }
    }
  };
  sc.tap = (x, y) => {
    if (sc.dive || sc.phase === 'done') return;
    SND.click();
    sc.dive = {fx: sc.kx, fy: sc.ky, x: clamp(x, 44, 156), y: clamp(y + 6, 52, 80), t0: sc.t};
  };
  sc.auto = () => R() < penChance(opts.taker || {a: {sho: 12}}, opts.gk);
  sc.draw = g => {
    drawGoalScene(g, sc.t, {spot: true, cheer: sc.res && sc.res !== 'goal', impact: sc.impact});
    const idle = !sc.dive ? Math.round(Math.sin(sc.t / 220) * 2) : 0;
    drawKeeper(g, sc.kx + idle, sc.ky + 12, gkKit, sc.lean, sc.lookK, !sc.dive);
    const runK = clamp(sc.t / sc.runT, 0, 1), running = sc.phase === 'run';
    if (!running) {
      const k = sc.ballK || 1, bx = lerp(100, sc.tx, k), by = lerp(150, sc.ty, k) - Math.sin(k * Math.PI) * 5, gy = lerp(150, Math.min(GOAL.line + 2, sc.ty + 22), k);
      if (sc.phase === 'fly') { sc.trail.push([bx, by]); sc.trail = sc.trail.slice(-4); }
      sc.trail.forEach(([x, y], i) => { g.fillStyle = `rgba(255,255,255,${.12 + i * .08})`; g.fillRect(Math.round(x), Math.round(y), 2, 2); });
      drawBall(g, bx, by, lerp(4, 2, k), sc.t / 50, gy);
    } else drawBall(g, 100, 148, 4, 0, 151);
    const legs = running ? (Math.floor(sc.t / 120) % 2 ? 'legsRunA' : 'legsRunB') : sc.t - sc.k0 < 300 ? 'legsKick' : 'legsStand';
    drawTaker(g, running ? lerp(132, 110, runK) : 110, running ? lerp(186, 172, runK) : 172, kitT, sc.lookT, legs, 2);
    drawParts(g, sc);
    // countdown over the run-up: 3, 2, 1, then the kick
    if (running) { const n = 3 - Math.floor(sc.t / 600); bannerText(g, String(n), '#ffd23f', sc.t, (3 - n) * 600); }
    if (sc.res) bannerText(g, {goal: 'GOAL...', saved: 'SAVED!', miss: 'MISSED!'}[sc.res], sc.res === 'goal' ? '#ff4b55' : '#3ddc5a', sc.t, sc.resT);
  };
  return runScene(ov, sc).then(r => { if (own) ov.close(); return r == null ? sc.auto() : r; });
}

// ---------- FREE KICK: aim, curl, power. Bend it round the wall!
function freeKick(opts, ov) {
  const own = !ov; ov = ov || miniOverlay('FREE KICK!', '');
  ov.hint(`Tap to <b>aim</b>. The wall covers one side, so bend it!`);
  const sho = opts.taker ? opts.taker.a.sho + (opts.taker.tr === 'deadball' ? 4 : 0) : 12, gkv = opts.gk ? opts.gk.a.gk : 10;
  const gkKit = Object.assign({shirt: '#33d17a', shorts: '#1a1a1a'}, opts.gkKit || {});
  const wallKit = opts.wallKit || {shirt: '#1d3fbf', shorts: '#ffffff'};
  const kitT = opts.kit || {shirt: '#d8242c', shorts: '#fff'};
  const side = R() < .5 ? -1 : 1, start = {x: 100 + ri(-20, 20), y: 162};
  const WALL_W = 52;
  const sc = {phase: 'aim', t: 0, curl: 0, pow: 0, wallX: 100 + side * 22 - 24 + ri(-4, 4), jump: R() < .35, kx: 100 - side * 16, ky: 70, lean: 0, trail: [],
    lookT: lookOf(opts.taker ? opts.taker.id : 6), lookK: lookOf(opts.gk ? opts.gk.id + 5 : 2), looks: [0, 1, 2, 3].map(i => lookOf(i * 3 + ri(0, 20)))};
  const sp = 1 - (sho - 10) * .02;
  sc.update = dt => {
    const t = sc.t / 1000;
    if (sc.phase === 'aim') { sc.ax = 100 + 62 * Math.sin(t * 2.1 * sp); sc.ay = 60 + 22 * Math.sin(t * 3.1 * sp + .5); }
    if (sc.phase === 'curl') sc.curl = Math.sin((sc.t - sc.p0) / 1000 * 3.6 * sp);
    if (sc.phase === 'power') sc.pow = (Math.sin((sc.t - sc.p0) / 1000 * 4 * sp - Math.PI / 2) + 1) / 2;
    if (sc.phase === 'fly') {
      const k = clamp((sc.t - sc.k0) / sc.dur, 0, 1); sc.ballK = k;
      const b = bez(k); sc.bx = b.x; sc.by = b.y; sc.gy = b.gy;
      // the wall
      if (!sc.blocked && sc.by <= 120 && sc.prevY > 120) {
        const inWall = sc.bx > sc.wallX - 2 && sc.bx < sc.wallX + WALL_W;
        if (inWall && sc.pow < (sc.jump ? .6 : .52)) { sc.blocked = true; sc.res = 'wall'; sc.resT = sc.t; sc.shake = 220; SND.kick(); SND.ooh(); burst(sc, sc.bx, sc.by, 10, ['#ffffff', '#c4c9d6'], {sp: .12, up: .1}); sc.phase = 'done'; sc.finish(false, 1500); }
      }
      sc.prevY = sc.by;
      // keeper reacts, later if the ball came over the wall
      const delay = sc.hidden ? 230 : 90;
      if (sc.t - sc.k0 > delay) { const v = (.075 + gkv * .004) * dt; const dx = sc.tx - sc.kx; sc.kx += clamp(dx, -v, v); sc.lean = clamp((sc.kx - 100) / 50, -1, 1) * Math.min(1, Math.abs(dx) / 20 + .3); }
      if (k >= 1 && !sc.blocked) {
        sc.phase = 'done'; sc.resT = sc.t;
        const inX = sc.tx > GOAL.l + 1 && sc.tx < GOAL.r - 1, inY = sc.ty > GOAL.top + 1;
        sc.res = !inX || !inY ? (sc.ty <= GOAL.top ? 'over' : 'wide') : Math.hypot(sc.kx - sc.tx, (sc.ky - 6) - sc.ty) < 9 + gkv * .3 ? 'saved' : 'goal';
        if (sc.res === 'goal') { SND.roar(); goalFx(sc, sc.tx, sc.ty); } else { SND.ooh(); if (sc.res === 'saved') burst(sc, sc.tx, sc.ty, 10, ['#ffffff', '#c4c9d6'], {sp: .1, up: .08}); }
        sc.finish(sc.res === 'goal', 1500);
      }
    }
  };
  const bez = k => {
    const cx = (start.x + sc.tx) / 2 + sc.curl * 46, cy = (start.y + sc.ty) / 2;
    const x = (1 - k) * (1 - k) * start.x + 2 * (1 - k) * k * cx + k * k * sc.tx;
    const y = (1 - k) * (1 - k) * start.y + 2 * (1 - k) * k * cy + k * k * sc.ty;
    return {x, y: y - Math.sin(k * Math.PI) * sc.pow * 26, gy: lerp(start.y + 2, Math.min(GOAL.line + 2, sc.ty + 22), k)};
  };
  sc.tap = () => {
    SND.click();
    if (sc.phase === 'aim') { sc.tx = sc.ax; sc.ty = sc.ay; sc.phase = 'curl'; sc.p0 = sc.t; ov.hint('Tap to set the <b>curl</b>. Bend it round the wall!'); return; }
    if (sc.phase === 'curl') { sc.phase = 'power'; sc.p0 = sc.t; ov.hint('Tap for <b>power</b>. Enough to clear the wall, not the bar!'); return; }
    if (sc.phase === 'power') {
      const err = 7 - sho * .25; sc.tx += (R() - .5) * err * 2; sc.ty += (R() - .5) * err;
      if (sc.pow > .88) sc.ty -= (sc.pow - .88) * 170;
      sc.dur = 760 - sc.pow * 260; sc.k0 = sc.t; sc.phase = 'fly'; sc.prevY = start.y;
      sc.hidden = (sc.tx - 100) * side > 0;
      SND.kick(); ov.hint('');
      burst(sc, start.x, start.y, 6, ['#6fbf5a', '#3a7a2a'], {sp: .06, up: .04});
    }
  };
  sc.auto = () => R() < clamp(.1 + (sho - 10) * .01, .04, .3);
  sc.draw = g => {
    drawGoalScene(g, sc.t, {cheer: sc.res === 'goal', impact: sc.impact});
    drawKeeper(g, sc.kx, sc.ky + 12, gkKit, sc.lean, sc.lookK);
    const flying = sc.phase === 'fly' || sc.phase === 'done';
    const k = sc.ballK ?? 0, overWall = flying && (sc.by ?? 200) < 120;
    // ball behind the wall once it has passed it
    if (overWall) { sc.trail.forEach(([x, y], i) => { g.fillStyle = `rgba(255,255,255,${.12 + i * .08})`; g.fillRect(Math.round(x), Math.round(y), 2, 2); }); drawBall(g, sc.bx, sc.by, lerp(4, 2, k), sc.t / 50, sc.gy); }
    const jumpY = sc.jump && sc.phase === 'fly' && sc.ballK > .2 && sc.ballK < .6 ? -6 : 0;
    const wpal = sc.looks.map(l => palette(wallKit, l));
    for (let i = 0; i < 4; i++) { shadow(g, sc.wallX + 10 + i * 11, 133, 16); blit(g, spr(MAPS.wall, wpal[i]), sc.wallX + 10 + i * 11, 134 + jumpY, 2); }
    if (!overWall) {
      if (flying) { sc.trail.forEach(([x, y], i) => { g.fillStyle = `rgba(255,255,255,${.12 + i * .08})`; g.fillRect(Math.round(x), Math.round(y), 2, 2); }); drawBall(g, sc.bx ?? start.x, sc.by ?? start.y, lerp(4, 2, k), sc.t / 50, sc.gy); }
      else drawBall(g, start.x, start.y - 2, 4, 0, start.y + 1);
    }
    if (sc.phase === 'fly') { sc.trail.push([sc.bx, sc.by]); sc.trail = sc.trail.slice(-4); }
    if (!flying || sc.t - sc.k0 < 500) drawTaker(g, start.x + 9, 186, kitT, sc.lookT, flying ? 'legsKick' : 'legsStand', 2);
    if (sc.phase === 'aim' || sc.phase === 'curl' || sc.phase === 'power') reticle(g, sc.phase === 'aim' ? sc.ax : sc.tx, sc.phase === 'aim' ? sc.ay : sc.ty, sc.t);
    if (sc.phase === 'curl' || sc.phase === 'power') {
      // preview of the bend
      for (let k2 = .08; k2 < 1; k2 += .08) { const b = bez(k2); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(Math.round(b.x) + 1, Math.round(b.y + Math.sin(k2 * Math.PI) * sc.pow * 26) + 1, 1, 1); g.fillStyle = 'rgba(255,210,63,.85)'; g.fillRect(Math.round(b.x), Math.round(b.y + Math.sin(k2 * Math.PI) * sc.pow * 26), 1, 1); }
    }
    const mx = start.x + 9 > 100 ? 4 : 112;
    if (sc.phase === 'curl') {
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(mx, 147, 84, 18); g.fillStyle = '#4d63d6'; g.fillRect(mx, 147, 84, 1); g.fillRect(mx, 164, 84, 1);
      g.font = `5px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('CURL', mx + 4, 151);
      g.fillStyle = '#5fe3ff'; g.fillText('<', mx + 3, 158); g.textAlign = 'right'; g.fillText('>', mx + 82, 158);
      const c0 = mx + 42; g.fillStyle = '#111'; g.fillRect(mx + 10, 156, 64, 5); g.fillStyle = '#5fe3ff'; g.fillRect(c0 - 1, 155, 2, 7);
      const cx = Math.round(c0 + sc.curl * 30); g.fillStyle = '#ffd23f'; g.fillRect(Math.min(cx, c0), 157, Math.abs(cx - c0) + 1, 3); g.fillStyle = '#fff'; g.fillRect(cx - 1, 154, 3, 1);
    }
    if (sc.phase === 'power') meter(g, mx + 4, 156, 76, sc.pow, 'POWER', [sc.jump ? .6 : .52, .88]);
    drawParts(g, sc);
    if (sc.res) bannerText(g, {goal: 'GOAL!', saved: 'SAVED!', wide: 'WIDE!', over: 'OVER!', wall: 'THE WALL!'}[sc.res], sc.res === 'goal' ? '#3ddc5a' : '#ff4b55', sc.t, sc.resT);
  };
  return runScene(ov, sc).then(r => { if (own) ov.close(); return r == null ? sc.auto() : r; });
}

// ---------- KEEPY-UPPY: tap the ball to keep it up. Tap the side of it to steer.
let keepyBg = null;
function keepyBackground() {
  if (keepyBg) return keepyBg;
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 220;
  const g = cv.getContext('2d');
  // sky in dithered bands
  const sky = ['#4fa6f0', '#63b4f4', '#7cc3f7', '#97d2fa', '#b5e0fc'];
  sky.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 18, 160, 18); if (i) { g.fillStyle = sky[i - 1]; for (let x = 0; x < 160; x += 2) g.fillRect(x + (i % 2), i * 18, 1, 1); } });
  g.fillStyle = sky[4]; g.fillRect(0, 90, 160, 20);
  // sun
  g.fillStyle = '#fff3b0'; for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36) g.fillRect(134 + x, 22 + y, 1, 1);
  g.fillStyle = '#ffe066'; for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 22) g.fillRect(134 + x, 22 + y, 1, 1);
  // terraced houses
  for (let i = 0; i < 9; i++) {
    const x = i * 18 - 4, h = 22 + (i % 3) * 3, top = 112 - h;
    g.fillStyle = i % 2 ? '#a0503a' : '#93452f'; g.fillRect(x, top, 18, h);
    g.fillStyle = '#5a5f73'; g.fillRect(x - 1, top - 4, 20, 4); g.fillStyle = '#6c7188'; g.fillRect(x - 1, top - 4, 20, 1);
    g.fillStyle = '#7a3a2a'; g.fillRect(x + 12, top - 9, 3, 5); g.fillStyle = '#c86a4a'; g.fillRect(x + 12, top - 10, 3, 1);
    g.fillStyle = '#ffe9a0'; g.fillRect(x + 3, top + 4, 4, 4); g.fillRect(x + 11, top + 4, 4, 4);
    g.fillStyle = '#2b3550'; g.fillRect(x + 4, top + 5, 2, 3); g.fillRect(x + 12, top + 5, 2, 3);
    g.fillStyle = '#3a2216'; g.fillRect(x + 7, top + h - 7, 4, 7);
  }
  // trees
  [[10, 100], [70, 98], [128, 101]].forEach(([x, y]) => { g.fillStyle = '#5a3a1e'; g.fillRect(x + 4, y + 6, 2, 8); g.fillStyle = '#2f7a34'; g.fillRect(x, y, 10, 8); g.fillRect(x + 2, y - 3, 6, 3); g.fillStyle = '#3f9444'; g.fillRect(x + 1, y + 1, 4, 3); });
  // fence
  g.fillStyle = '#7a5532'; for (let x = 0; x < 160; x += 8) g.fillRect(x, 112, 2, 18); g.fillRect(0, 115, 160, 2); g.fillRect(0, 124, 160, 2);
  g.fillStyle = '#9a7048'; for (let x = 0; x < 160; x += 8) g.fillRect(x, 112, 1, 18);
  // grass with perspective stripes
  let y = 130, h = 4, k = 0;
  while (y < 220) { const base = k++ % 2 ? '#2f9a3a' : '#288c32'; g.fillStyle = base; g.fillRect(0, y, 160, h); g.fillStyle = shade(base, 1.08); for (let x = (k % 2) * 2; x < 160; x += 4) g.fillRect(x, y + 1, 1, 1); y += h; h = Math.round(h * 1.3) + 1; }
  // a training goal and cones
  g.fillStyle = '#ffffff'; g.fillRect(8, 118, 30, 1); g.fillRect(8, 118, 1, 16); g.fillRect(37, 118, 1, 16);
  g.fillStyle = 'rgba(255,255,255,.3)'; for (let x = 10; x < 37; x += 3) g.fillRect(x, 119, 1, 15);
  [[60, 150], [104, 152], [134, 146]].forEach(([x, y]) => { g.fillStyle = '#ff8a1f'; g.fillRect(x + 1, y, 2, 1); g.fillRect(x, y + 1, 4, 2); g.fillStyle = '#fff'; g.fillRect(x, y + 2, 4, 1); g.fillStyle = '#c45a10'; g.fillRect(x - 1, y + 3, 6, 1); });
  return keepyBg = cv;
}
function keepyUppy(opts) {
  opts = opts || {};
  const ov = miniOverlay('KEEPY-UPPY', 'Tap the ball to keep it up! Tap its left side to send it right.', {w: 160, h: 220, skip: true, skipTxt: 'Stop'});
  const kit = opts.kit || {shirt: '#d8242c', shorts: '#fff'};
  const look = lookOf(ri(0, 20));
  const sc = {t: 0, x: 80, y: 60, vx: 0, vy: 0, g: .00055, n: 0, started: false, px: 80, kickT: -999, over: false, best: opts.best || 0, pops: [], parts: []};
  const CHEERS = {10: 'NICE!', 20: 'SUPER!', 30: 'CRACKING!', 50: 'WORLD CLASS!', 75: 'LEGEND!', 100: 'UNREAL!'};
  sc.update = dt => {
    if (!sc.started || sc.over) return;
    sc.vy += sc.g * dt; sc.x += sc.vx * dt; sc.y += sc.vy * dt;
    if (sc.x < 10) { sc.x = 10; sc.vx = Math.abs(sc.vx) * .8; } if (sc.x > 150) { sc.x = 150; sc.vx = -Math.abs(sc.vx) * .8; }
    if (sc.y < 8) { sc.y = 8; sc.vy = Math.abs(sc.vy) * .3; }
    sc.px += clamp(sc.x - sc.px, -.06 * dt, .06 * dt);
    if (sc.y > 196) { sc.y = 196; sc.over = true; SND.bad(); burst(sc, sc.x, 201, 10, ['#8a6a3a', '#6fbf5a'], {sp: .1, up: .06}); ov.hint(`<b>${sc.n}</b> touch${sc.n === 1 ? '' : 'es'}!${sc.n > sc.best ? ' New best!' : ''}`); sc.finish(sc.n, 1600); }
    sc.pops = sc.pops.filter(p => sc.t - p.t < 900);
  };
  sc.tap = (x, y) => {
    if (sc.over) return;
    if (!sc.started) { sc.started = true; sc.vy = -.05; return; }
    if (Math.hypot(x - sc.x, y - sc.y) > 26) return;
    sc.n++; sc.kickT = sc.t; SND.kick(); if (sc.n % 10 === 0) SND.good();
    sc.vy = -(.36 + R() * .04); sc.vx = clamp((sc.x - x) * .012 + (R() - .5) * .04, -.14, .14);
    sc.g = Math.min(.0011, .00055 * (1 + sc.n * .025));
    sc.pops.push({x: sc.x, y: sc.y, t: sc.t, txt: CHEERS[sc.n] || '+1', big: !!CHEERS[sc.n]});
    burst(sc, sc.x, sc.y + 5, 5, ['#ffffff', '#ffd23f'], {sp: .08, up: .02, g: .0002, life: 400});
    if (CHEERS[sc.n]) burst(sc, sc.x, sc.y, 30, CONFETTI, {sp: .18, up: .1, life: 1400});
  };
  sc.auto = () => sc.n;
  sc.draw = g => {
    g.drawImage(keepyBackground(), 0, 0);
    // drifting clouds
    [[20, 20, 22], [100, 40, 16], [60, 10, 26]].forEach(([x, y, w]) => { const xx = Math.round((x + sc.t / 180) % 200) - 30; g.fillStyle = '#ffffff'; g.fillRect(xx, y, w, 4); g.fillRect(xx + 4, y - 3, w - 10, 3); g.fillRect(xx + 8, y - 5, 6, 2); g.fillStyle = '#d8ecfb'; g.fillRect(xx + 2, y + 3, w - 4, 1); });
    const kicking = sc.t - sc.kickT < 160;
    const pal = palette(kit, look);
    shadow(g, sc.px, 207, 18);
    blit(g, spr(kicking ? MAPS.frontKick : MAPS.front, pal), sc.px, 209, 2, sc.x < sc.px);
    // ball shadow shrinks as it rises
    const hgt = clamp((200 - sc.y) / 200, 0, 1);
    shadow(g, sc.x, 205, 10 - hgt * 6);
    drawBall(g, sc.x, sc.y, 5, sc.t / 60 * (sc.vx > 0 ? 1 : -1));
    drawParts(g, sc);
    outlineText(g, String(sc.n), 80, 14, '#ffd23f', 16);
    outlineText(g, `BEST ${Math.max(sc.best, sc.n)}`, 80, 32, '#ffffff', 6);
    sc.pops.forEach(p => outlineText(g, p.txt, p.big ? 80 : p.x + 10, (p.big ? 60 : p.y - 8) - (sc.t - p.t) / 30, p.big ? '#3ddc5a' : '#ffffff', p.big ? 10 : 6));
    if (!sc.started) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 86, 160, 30); g.fillStyle = '#ffd23f'; g.fillRect(0, 86, 160, 1); g.fillRect(0, 115, 160, 1); outlineText(g, 'TAP TO START', 80, 101, Math.floor(sc.t / 400) % 2 ? '#ffffff' : '#ffd23f', 8); }
  };
  return runScene(ov, sc).then(r => { ov.close(); return r ?? sc.n; });
}

// ---------- SHOOT-OUT: five each, then sudden death. You take yours and save theirs.
// opts: {us: {name, takers:[players], gk, kit}, them: {...}}
async function shootout(opts) {
  const ov = miniOverlay('PENALTY SHOOT-OUT', '', {skip: true, skipTxt: 'Let the computer finish it'});
  const sc = [0, 0], marks = [[], []];
  let auto = false;
  ov.el.querySelector('.mskip').onclick = () => { auto = true; };
  const backBtn = ov.el.querySelector('.mback'), runBack = () => { auto = true; if (ov.onBack) ov.onBack(); };
  backBtn.onclick = runBack;
  const board = () => ov.score(`${opts.us.short} ${dots(marks[0])} ${sc[0]}-${sc[1]} ${dots(marks[1])} ${opts.them.short}`);
  const dots = m => { const a = m.map(x => x ? '●' : '○'); while (a.length < 5) a.push('·'); return `<span class="dots">${a.slice(-5).join('')}</span>`; };
  board();
  for (let k = 0; k < 40; k++) {
    for (let side = 0; side < 2; side++) {
      const shooter = side === 0 ? opts.us : opts.them, keeper = side === 0 ? opts.them : opts.us;
      const taker = shooter.takers[k % shooter.takers.length];
      let goal;
      if (auto) goal = R() < penChance(taker, keeper.gk);
      else {
        // fresh scene in the same overlay
        const cv = ov.cv; ov.el.querySelector('.mskip').onclick = () => { auto = true; }; backBtn.onclick = runBack;
        goal = await (side === 0 ? penShoot({taker, gk: keeper.gk, kit: shooter.kit, gkKit: keeper.gkKit}, ov) : penSave({taker, gk: keeper.gk, kit: shooter.kit, gkKit: keeper.gkKit}, ov));
        cv.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
      }
      if (goal) sc[side]++;
      marks[side].push(!!goal);
      board();
      // decided?
      const left = [Math.max(0, 5 - marks[0].length), Math.max(0, 5 - marks[1].length)];
      if (k < 5 && (sc[0] + left[0] < sc[1] || sc[1] + left[1] < sc[0])) { ov.hint(sc[0] > sc[1] ? '<b>YOU WIN THE SHOOT-OUT!</b>' : '<b>Out on penalties...</b>'); await wait(auto ? 300 : 1200); ov.close(); return sc; }
    }
    if (k >= 4 && sc[0] !== sc[1]) break;
  }
  ov.hint(sc[0] > sc[1] ? '<b>YOU WIN THE SHOOT-OUT!</b>' : '<b>Out on penalties...</b>');
  await wait(1200); ov.close();
  return sc;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
