// Pixel Gaffer '96: the mini-games. Each returns a Promise with the result.
'use strict';
const ADS = ['PIXEL', 'GAFFER', 'TELETEXT', 'PIES', 'HOT TEA', 'CRISPS', '1996'];
let crowdDots = null;

function miniOverlay(title, hint, opts) {
  opts = opts || {};
  const el = document.createElement('div');
  el.className = 'mini';
  el.innerHTML = `<div class="mhead"><span class="mt">${title}</span><span class="ms" id="mscore">${opts.score || ''}</span></div>
    <div class="mwrap"><canvas class="mcv"></canvas></div><div class="mhint">${hint}</div>${opts.skip === false ? '' : `<button class="btn ghost small mskip">${opts.skipTxt || 'Let the computer decide'}</button>`}`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas');
  cv.width = opts.w || 200; cv.height = opts.h || 170;
  return {el, cv, g: cv.getContext('2d'), hint: t => { el.querySelector('.mhint').innerHTML = t; }, score: t => { el.querySelector('#mscore').innerHTML = t; }, close: () => el.remove()};
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
    const loop = now => {
      if (dead) return;
      const dt = Math.min(50, now - last); last = now;
      scene.t = (scene.t || 0) + dt;
      if (scene.update) scene.update(dt);
      scene.draw(ov.g);
      if (fin && now >= fin.at) { dead = true; wrap.removeEventListener('pointerdown', tap); resolve(fin.res); return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

// ---------- the goal-mouth scene shared by penalties and free kicks
const GOAL = {l: 46, r: 154, top: 40, line: 82};
function drawGoalScene(g, t, opts) {
  opts = opts || {};
  if (!crowdDots) { crowdDots = []; for (let i = 0; i < 260; i++) crowdDots.push([ri(0, 199), ri(0, 27), pick(['#d8242c', '#ffffff', '#1d3fbf', '#ffd23f', '#2a9d3f', '#f1c7a0', '#333'])]); }
  g.fillStyle = '#1a1f3a'; g.fillRect(0, 0, 200, 30);
  crowdDots.forEach(([x, y, c], i) => { g.fillStyle = c; g.fillRect(x, y + ((opts.cheer && (i + Math.floor(t / 90)) % 3 === 0) ? -1 : 0), 1, 2); });
  // advertising boards
  for (let i = 0; i < 5; i++) { g.fillStyle = ['#d8242c', '#1d3fbf', '#ffd23f', '#2a9d3f', '#ff8a1f'][i]; g.fillRect(i * 40, 28, 40, 9); }
  g.font = `5px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) { g.fillStyle = i === 2 ? '#000' : '#fff'; g.fillText(ADS[i], i * 40 + 20, 33); }
  // grass with perspective stripes
  let y = 37, h = 4, k = 0;
  while (y < 170) { g.fillStyle = k++ % 2 ? '#2f9a3a' : '#278a31'; g.fillRect(0, y, 200, h); y += h; h = Math.min(18, Math.round(h * 1.25)); }
  // six-yard box and goal line
  g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(0, GOAL.line, 200, 1);
  g.fillRect(28, 96, 144, 1); g.fillRect(28, GOAL.line, 1, 14); g.fillRect(171, GOAL.line, 1, 14);
  if (opts.spot) { g.fillRect(99, 150, 3, 1); }
  // net
  g.fillStyle = 'rgba(255,255,255,.28)';
  const shake = opts.netShake ? Math.sin(t / 25) * 1.5 : 0;
  for (let x = GOAL.l + 2; x < GOAL.r; x += 4) g.fillRect(x + shake, GOAL.top + 2, 1, GOAL.line - GOAL.top - 2);
  for (let yy = GOAL.top + 3; yy < GOAL.line; yy += 4) g.fillRect(GOAL.l + 1, yy + shake * .5, GOAL.r - GOAL.l - 1, 1);
  g.fillStyle = '#fff'; g.fillRect(GOAL.l - 2, GOAL.top - 2, GOAL.r - GOAL.l + 4, 2); g.fillRect(GOAL.l - 2, GOAL.top, 2, GOAL.line - GOAL.top + 1); g.fillRect(GOAL.r, GOAL.top, 2, GOAL.line - GOAL.top + 1);
}
function bigSprite(g, x, y, sc, shirt, shorts, frame, opts) { g.save(); g.scale(sc, sc); sprite(g, x / sc, y / sc, shirt, shorts, frame, opts); g.restore(); }
// a keeper, drawn diving when lean != 0
function drawKeeper(g, x, y, kit, lean) {
  g.save(); g.translate(Math.round(x), Math.round(y));
  if (Math.abs(lean) > .15) g.rotate(lean * 1.2);
  g.scale(3, 3);
  sprite(g, 0, 0, kit.shirt, kit.shorts, 0, {skin: kit.skin, hair: kit.hair});
  g.fillStyle = '#e8e8e8'; g.fillRect(-3, -4, 1, 1); g.fillRect(2, -4, 1, 1);   // gloves
  g.restore();
}
function drawBall(g, x, y, r, spin) {
  r = Math.max(1, Math.round(r));
  g.fillStyle = 'rgba(0,0,0,.3)';
  for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r + r) {
    const dark = ((xx + yy + Math.floor(spin || 0)) % 3 === 0) && r > 2 && (xx * xx + yy * yy < r * r - 1);
    g.fillStyle = dark ? '#222' : '#fff'; g.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
  }
}
function bannerText(g, txt, col, t) {
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 98, 200, 26);
  g.font = `14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#000'; g.fillText(txt, 102, 113);
  g.fillStyle = Math.floor(t / 150) % 2 ? col : '#fff'; g.fillText(txt, 100, 111);
}
function meter(g, x, y, w, v, label, zone) {
  g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, 8);
  if (zone) { g.fillStyle = '#1e5a26'; g.fillRect(x + zone[0] * w, y, (zone[1] - zone[0]) * w, 6); }
  g.fillStyle = v > .88 ? '#ff4b55' : '#ffd23f'; g.fillRect(x, y, Math.round(v * w), 6);
  g.font = `5px ${FONT}`; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(label, x, y - 5);
}
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

// ---------- PENALTY: you take it. Tap to aim, tap for power.
// opts: {taker: player, gk: player|null, kit: {shirt, shorts}, gkKit}
function penShoot(opts, ov) {
  const own = !ov; ov = ov || miniOverlay('PENALTY!', 'Tap to <b>aim</b>...');
  ov.hint(`${opts.taker ? pname(opts.taker) : 'You'} to take. Tap to <b>aim</b>...`);
  const sho = opts.taker ? opts.taker.a.sho : 12, gkv = opts.gk ? opts.gk.a.gk : 10;
  const gkKit = Object.assign({shirt: '#33d17a', shorts: '#1a1a1a'}, opts.gkKit || {});
  const sp = 1 - (sho - 10) * .025;
  const sc = {phase: 'aim', ax: 100, ay: 60, pow: 0, kx: 100, ky: 70, lean: 0, res: null, ballK: 0, t: 0};
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
    sc.phase = 'done';
    const {tx, ty} = sc, inX = tx > GOAL.l + 1 && tx < GOAL.r - 1, inY = ty > GOAL.top + 1;
    let res;
    if (!inX || !inY) res = (Math.abs(tx - GOAL.l) < 4 || Math.abs(tx - GOAL.r) < 4 || Math.abs(ty - GOAL.top) < 4) && ty < GOAL.line ? 'post' : ty <= GOAL.top ? 'over' : 'wide';
    else res = Math.hypot(sc.kx - tx, (sc.ky - 6) - ty) < sc.reach ? 'saved' : 'goal';
    sc.res = res;
    if (res === 'goal') { SND.roar(); } else { SND.ooh(); }
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
    }
  };
  sc.auto = () => R() < penChance(opts.taker || {a: {sho: 12}}, opts.gk);
  sc.draw = g => {
    drawGoalScene(g, sc.t, {spot: true, cheer: sc.res === 'goal', netShake: sc.res === 'goal'});
    drawKeeper(g, sc.kx, sc.ky + 12, gkKit, sc.lean);
    // the taker, from behind
    const kitT = opts.kit || {shirt: '#d8242c', shorts: '#fff'};
    const tk = sc.phase === 'fly' || sc.phase === 'done' ? 0 : 6;
    bigSprite(g, 112 + tk, 168, 4, kitT.shirt, kitT.shorts, sc.phase === 'fly' ? 1 : 0, {hair: '#2a1a0e'});
    if (sc.phase === 'fly' || sc.phase === 'done') {
      const k = sc.ballK, bx = lerp(100, sc.tx, k), by = lerp(150, sc.ty, k) - Math.sin(k * Math.PI) * 6;
      drawBall(g, bx, by, lerp(4, 2, k), sc.t / 40);
    } else drawBall(g, 100, 148, 4, 0);
    if (sc.phase === 'aim' || sc.phase === 'power') {
      const x = Math.round(sc.phase === 'aim' ? sc.ax : sc.tx), y = Math.round(sc.phase === 'aim' ? sc.ay : sc.ty);
      g.fillStyle = '#ffd23f'; g.fillRect(x - 4, y, 3, 1); g.fillRect(x + 2, y, 3, 1); g.fillRect(x, y - 4, 1, 3); g.fillRect(x, y + 2, 1, 3);
    }
    if (sc.phase === 'power') meter(g, 60, 160, 80, sc.pow, 'POWER', [.45, .86]);
    if (sc.res) bannerText(g, {goal: 'GOAL!', saved: 'SAVED!', wide: 'WIDE!', over: 'OVER!', post: 'POST!'}[sc.res], sc.res === 'goal' ? '#3ddc5a' : '#ff4b55', sc.t);
  };
  return runScene(ov, sc).then(r => { if (own) ov.close(); return r == null ? sc.auto() : r; });
}

// ---------- PENALTY: you're in goal. Tap where to dive. Early guess or quick reactions!
function penSave(opts, ov) {
  const own = !ov; ov = ov || miniOverlay('SAVE IT!', '');
  ov.hint(`${opts.taker ? pname(opts.taker) : 'They'} step${opts.taker ? 's' : ''} up... <b>tap where to dive!</b>`);
  const sho = opts.taker ? opts.taker.a.sho + (opts.taker.tr === 'deadball' ? 4 : 0) : 12, gkv = opts.gk ? opts.gk.a.gk : 10;
  const gkKit = Object.assign({shirt: '#33d17a', shorts: '#1a1a1a'}, opts.gkKit || {});
  const kitT = opts.kit || {shirt: '#1d3fbf', shorts: '#fff'};
  const sc = {phase: 'run', kx: 100, ky: 70, lean: 0, dive: null, res: null, t: 0, runT: 900 + R() * 500};
  // where the taker goes
  const corner = R() < .5 ? -1 : 1, centre = R() < .15;
  sc.tx = centre ? 100 + ri(-10, 10) : 100 + corner * (30 + R() * 22 + (sho - 10) * .8);
  sc.ty = R() < .5 ? ri(46, 60) : ri(62, 78);
  const missP = clamp(.1 - (sho - 10) * .01, .02, .15);
  if (R() < missP) { if (R() < .5) sc.ty = GOAL.top - ri(3, 12); else sc.tx = 100 + corner * ri(56, 66); }
  sc.dur = clamp(520 - sho * 9, 320, 520);
  sc.reach = 11 + gkv * .35 + (opts.gk && opts.gk.tr === 'cat' ? 3 : 0);
  sc.update = dt => {
    if (sc.phase === 'run' && sc.t >= sc.runT) { sc.phase = 'fly'; sc.k0 = sc.t; SND.kick(); }
    if (sc.dive) {
      const k = ease((sc.t - sc.dive.t0) / 300);
      sc.kx = lerp(sc.dive.fx, sc.dive.x, k); sc.ky = lerp(sc.dive.fy, sc.dive.y, k); sc.lean = (sc.kx - 100) / 60;
    }
    if (sc.phase === 'fly') {
      sc.ballK = clamp((sc.t - sc.k0) / sc.dur, 0, 1);
      if (sc.ballK >= 1) {
        sc.phase = 'done';
        const inX = sc.tx > GOAL.l + 1 && sc.tx < GOAL.r - 1, inY = sc.ty > GOAL.top + 1;
        sc.res = !inX || !inY ? 'miss' : Math.hypot(sc.kx - sc.tx, (sc.ky - 6) - sc.ty) < sc.reach ? 'saved' : 'goal';
        if (sc.res === 'goal') SND.ooh(); else SND.roar();
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
    drawGoalScene(g, sc.t, {spot: true, cheer: sc.res && sc.res !== 'goal', netShake: sc.res === 'goal'});
    drawKeeper(g, sc.kx, sc.ky + 12, gkKit, sc.lean);
    const runK = clamp(sc.t / sc.runT, 0, 1);
    bigSprite(g, sc.phase === 'run' ? lerp(128, 106, runK) : 106, sc.phase === 'run' ? lerp(175, 160, runK) : 160, 4, kitT.shirt, kitT.shorts, Math.floor(sc.t / 130) % 2, {});
    if (sc.phase === 'run') drawBall(g, 100, 148, 4, 0);
    else { const k = sc.ballK || 1; drawBall(g, lerp(100, sc.tx, k), lerp(150, sc.ty, k) - Math.sin(k * Math.PI) * 5, lerp(4, 2, k), sc.t / 40); }
    if (sc.res) bannerText(g, {goal: 'GOAL...', saved: 'SAVED!', miss: 'MISSED!'}[sc.res], sc.res === 'goal' ? '#ff4b55' : '#3ddc5a', sc.t);
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
  const side = R() < .5 ? -1 : 1, start = {x: 100 + ri(-20, 20), y: 162};
  const sc = {phase: 'aim', t: 0, curl: 0, pow: 0, wallX: 100 + side * 22 - 24 + ri(-4, 4), jump: R() < .35, kx: 100 - side * 16, ky: 70, lean: 0};
  const sp = 1 - (sho - 10) * .02;
  sc.update = dt => {
    const t = sc.t / 1000;
    if (sc.phase === 'aim') { sc.ax = 100 + 62 * Math.sin(t * 2.1 * sp); sc.ay = 60 + 22 * Math.sin(t * 3.1 * sp + .5); }
    if (sc.phase === 'curl') sc.curl = Math.sin((sc.t - sc.p0) / 1000 * 3.6 * sp);
    if (sc.phase === 'power') sc.pow = (Math.sin((sc.t - sc.p0) / 1000 * 4 * sp - Math.PI / 2) + 1) / 2;
    if (sc.phase === 'fly') {
      const k = clamp((sc.t - sc.k0) / sc.dur, 0, 1); sc.ballK = k;
      const b = bez(k); sc.bx = b.x; sc.by = b.y;
      // the wall
      if (!sc.blocked && sc.by <= 120 && sc.prevY > 120) {
        const inWall = sc.bx > sc.wallX - 2 && sc.bx < sc.wallX + 50;
        if (inWall && sc.pow < (sc.jump ? .6 : .52)) { sc.blocked = true; sc.res = 'wall'; SND.kick(); SND.ooh(); sc.phase = 'done'; sc.finish(false, 1500); }
      }
      sc.prevY = sc.by;
      // keeper reacts, later if the ball came over the wall
      const delay = sc.hidden ? 230 : 90;
      if (sc.t - sc.k0 > delay) { const v = (.075 + gkv * .004) * dt; const dx = sc.tx - sc.kx; sc.kx += clamp(dx, -v, v); sc.lean = clamp((sc.kx - 100) / 50, -1, 1) * Math.min(1, Math.abs(dx) / 20 + .3); }
      if (k >= 1 && !sc.blocked) {
        sc.phase = 'done';
        const inX = sc.tx > GOAL.l + 1 && sc.tx < GOAL.r - 1, inY = sc.ty > GOAL.top + 1;
        sc.res = !inX || !inY ? (sc.ty <= GOAL.top ? 'over' : 'wide') : Math.hypot(sc.kx - sc.tx, (sc.ky - 6) - sc.ty) < 9 + gkv * .3 ? 'saved' : 'goal';
        if (sc.res === 'goal') SND.roar(); else SND.ooh();
        sc.finish(sc.res === 'goal', 1500);
      }
    }
  };
  const bez = k => {
    const cx = (start.x + sc.tx) / 2 + sc.curl * 46, cy = (start.y + sc.ty) / 2;
    const x = (1 - k) * (1 - k) * start.x + 2 * (1 - k) * k * cx + k * k * sc.tx;
    const y = (1 - k) * (1 - k) * start.y + 2 * (1 - k) * k * cy + k * k * sc.ty;
    return {x, y: y - Math.sin(k * Math.PI) * sc.pow * 26};
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
    }
  };
  sc.auto = () => R() < clamp(.1 + (sho - 10) * .01, .04, .3);
  sc.draw = g => {
    drawGoalScene(g, sc.t, {cheer: sc.res === 'goal', netShake: sc.res === 'goal'});
    drawKeeper(g, sc.kx, sc.ky + 12, gkKit, sc.lean);
    const jumpY = sc.jump && sc.phase === 'fly' && sc.ballK > .2 && sc.ballK < .6 ? -5 : 0;
    for (let i = 0; i < 4; i++) bigSprite(g, sc.wallX + 6 + i * 12.5, 126 + jumpY, 3.5, wallKit.shirt, wallKit.shorts, 0, {skin: SKIN[i % 3], hair: HAIR[i % 4]});
    if (sc.phase === 'fly' || sc.phase === 'done') { const k = sc.ballK ?? 0; drawBall(g, sc.bx ?? start.x, sc.by ?? start.y, lerp(4, 2, k), sc.t / 40); }
    else drawBall(g, start.x, start.y - 2, 4, 0);
    if (sc.phase === 'aim' || sc.phase === 'curl' || sc.phase === 'power') {
      const x = Math.round(sc.phase === 'aim' ? sc.ax : sc.tx), y = Math.round(sc.phase === 'aim' ? sc.ay : sc.ty);
      g.fillStyle = '#ffd23f'; g.fillRect(x - 4, y, 3, 1); g.fillRect(x + 2, y, 3, 1); g.fillRect(x, y - 4, 1, 3); g.fillRect(x, y + 2, 1, 3);
    }
    if (sc.phase === 'curl') {
      g.fillStyle = '#000'; g.fillRect(59, 151, 82, 8); g.fillStyle = '#5fe3ff'; g.fillRect(99, 152, 2, 6);
      g.fillStyle = '#ffd23f'; g.fillRect(Math.round(100 + sc.curl * 39) - 1, 152, 3, 6);
      g.font = `5px ${FONT}`; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText('CURL', 60, 146);
      // preview of the bend
      g.fillStyle = 'rgba(255,210,63,.6)'; for (let k = .1; k < 1; k += .1) { const b = bez(k); g.fillRect(Math.round(b.x), Math.round(b.y + Math.sin(k * Math.PI) * sc.pow * 26), 1, 1); }
    }
    if (sc.phase === 'power') meter(g, 60, 152, 80, sc.pow, 'POWER', [sc.jump ? .6 : .52, .88]);
    if (sc.res) bannerText(g, {goal: 'GOAL!', saved: 'SAVED!', wide: 'WIDE!', over: 'OVER!', wall: 'THE WALL!'}[sc.res], sc.res === 'goal' ? '#3ddc5a' : '#ff4b55', sc.t);
  };
  return runScene(ov, sc).then(r => { if (own) ov.close(); return r == null ? sc.auto() : r; });
}

// ---------- KEEPY-UPPY: tap the ball to keep it up. Tap the side of it to steer.
function keepyUppy(opts) {
  opts = opts || {};
  const ov = miniOverlay('KEEPY-UPPY', 'Tap the ball to keep it up! Tap its left side to send it right.', {w: 160, h: 220, skip: true, skipTxt: 'Stop'});
  const kit = opts.kit || {shirt: '#d8242c', shorts: '#fff'};
  const sc = {t: 0, x: 80, y: 60, vx: 0, vy: 0, g: .00055, n: 0, started: false, px: 80, kickT: -999, over: false, best: opts.best || 0, pops: []};
  sc.update = dt => {
    if (!sc.started || sc.over) return;
    sc.vy += sc.g * dt; sc.x += sc.vx * dt; sc.y += sc.vy * dt;
    if (sc.x < 10) { sc.x = 10; sc.vx = Math.abs(sc.vx) * .8; } if (sc.x > 150) { sc.x = 150; sc.vx = -Math.abs(sc.vx) * .8; }
    if (sc.y < 8) { sc.y = 8; sc.vy = Math.abs(sc.vy) * .3; }
    sc.px += clamp(sc.x - sc.px, -.06 * dt, .06 * dt);
    if (sc.y > 196) { sc.y = 196; sc.over = true; SND.bad(); ov.hint(`<b>${sc.n}</b> touch${sc.n === 1 ? '' : 'es'}!${sc.n > sc.best ? ' New best!' : ''}`); sc.finish(sc.n, 1600); }
    sc.pops = sc.pops.filter(p => sc.t - p.t < 700);
  };
  sc.tap = (x, y) => {
    if (sc.over) return;
    if (!sc.started) { sc.started = true; sc.vy = -.05; return; }
    if (Math.hypot(x - sc.x, y - sc.y) > 26) return;
    sc.n++; sc.kickT = sc.t; SND.kick(); if (sc.n % 10 === 0) SND.good();
    sc.vy = -(.36 + R() * .04); sc.vx = clamp((sc.x - x) * .012 + (R() - .5) * .04, -.14, .14);
    sc.g = Math.min(.0011, .00055 * (1 + sc.n * .025));
    sc.pops.push({x: sc.x, y: sc.y, t: sc.t, n: sc.n});
  };
  sc.auto = () => sc.n;
  sc.draw = g => {
    g.fillStyle = '#7fc8ff'; g.fillRect(0, 0, 160, 120);
    g.fillStyle = '#a6dbff'; g.fillRect(0, 60, 160, 60);
    // clouds and the training-ground fence
    g.fillStyle = '#fff'; [[20, 20], [100, 34], [60, 12]].forEach(([x, y]) => { const xx = (x + sc.t / 200) % 190 - 20; g.fillRect(xx, y, 18, 4); g.fillRect(xx + 4, y - 3, 10, 3); });
    g.fillStyle = '#6b4a2a'; for (let x = 0; x < 160; x += 10) g.fillRect(x, 120, 2, 22); g.fillRect(0, 124, 160, 2); g.fillRect(0, 134, 160, 2);
    g.fillStyle = '#2f9a3a'; g.fillRect(0, 140, 160, 80); g.fillStyle = '#2a8c34'; for (let x = 0; x < 160; x += 20) g.fillRect(x, 140, 10, 80);
    const kicking = sc.t - sc.kickT < 150;
    bigSprite(g, sc.px, 208, 4, kit.shirt, kit.shorts, kicking ? 1 : Math.floor(sc.t / 300) % 2 && 0, {});
    if (kicking) { g.fillStyle = '#f1c7a0'; g.fillRect(Math.round(sc.px) + 6, 196, 4, 4); }
    drawBall(g, sc.x, sc.y, 5, sc.t / 50 * (sc.vx > 0 ? 1 : -1));
    g.font = `16px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillStyle = '#000'; g.fillText(sc.n, 81, 9); g.fillStyle = '#ffd23f'; g.fillText(sc.n, 80, 8);
    g.font = `6px ${FONT}`; g.fillStyle = '#123'; g.fillText(`BEST ${Math.max(sc.best, sc.n)}`, 80, 30);
    sc.pops.forEach(p => { g.fillStyle = '#fff'; g.font = `6px ${FONT}`; g.fillText('+1', p.x + 8, p.y - 10 - (sc.t - p.t) / 30); });
    if (!sc.started) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 90, 160, 26); g.fillStyle = '#fff'; g.font = `8px ${FONT}`; g.fillText('TAP TO START', 80, 99); }
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
        const cv = ov.cv; ov.el.querySelector('.mskip').onclick = () => { auto = true; };
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
