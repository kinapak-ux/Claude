// Pixel Gaffer '96: pixel art (badges, sprites, the pitch) and chip-style sounds.
'use strict';
const FONT = "'Press Start 2P', monospace";
const SKIN = ['#f1c7a0', '#e0a77e', '#b97a4f', '#8a5634', '#5e3a22'];
const HAIR = ['#2a1a0e', '#5a3a1a', '#d9b45a', '#1a1a1a', '#8a3a1a'];

// ---------- club badges: a little pixel shield
const badgeCache = {};
function badge(c) {
  const key = c.id + c.c1 + c.c2 + c.pat;
  if (badgeCache[key]) return badgeCache[key];
  const cv = document.createElement('canvas'); cv.width = 12; cv.height = 14;
  const g = cv.getContext('2d');
  const inside = (x, y) => y < 9 ? x >= 1 && x <= 10 : x >= 1 + (y - 8) && x <= 10 - (y - 8);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 12; x++) {
    const edge = !inside(x, y) ? null : (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1) || y === 0);
    if (edge === null) continue;
    let col = c.c1;
    if (edge) col = '#0b0b14';
    else if (y === 1 || y === 2) col = c.c2;
    else switch (c.pat) {
      case 1: col = x < 6 ? c.c1 : c.c2; break;
      case 2: col = x % 3 === 0 ? c.c2 : c.c1; break;
      case 3: col = y >= 6 && y <= 7 ? c.c2 : c.c1; break;
      case 4: col = Math.abs((x - 1) - (y - 2)) <= 1 ? c.c2 : c.c1; break;
    }
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  // a tiny ball in the top band
  g.fillStyle = '#fff'; g.fillRect(5, 4, 2, 2);
  return badgeCache[key] = cv.toDataURL();
}
const badgeImg = (c, size) => `<img class="badge" src="${badge(c)}" width="${size || 24}" height="${Math.round((size || 24) * 14 / 12)}" alt="">`;

// ---------- a 4x7 footballer
function sprite(g, x, y, shirt, shorts, frame, opts) {
  opts = opts || {};
  x = Math.round(x - 2); y = Math.round(y - 6);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + 6, 4, 1);
  g.fillStyle = opts.hair || '#2a1a0e'; g.fillRect(x + 1, y, 2, 1);
  g.fillStyle = opts.skin || '#f1c7a0'; g.fillRect(x + 1, y + 1, 2, 1);
  g.fillStyle = shirt; g.fillRect(x, y + 2, 4, 2);
  if (opts.num) { g.fillStyle = shorts; g.fillRect(x + 1, y + 2, 2, 1); }
  g.fillStyle = shorts; g.fillRect(x + 1, y + 4, 2, 1);
  g.fillStyle = opts.skin || '#f1c7a0';
  if (frame % 2) { g.fillRect(x, y + 5, 1, 1); g.fillRect(x + 3, y + 5, 1, 1); } else { g.fillRect(x + 1, y + 5, 1, 1); g.fillRect(x + 2, y + 5, 1, 1); }
  if (opts.hi) { g.fillStyle = '#fff'; g.fillRect(x + 1, y - 2, 2, 1); }
}

// ---------- the top-down pitch used during matches
class Pitch {
  constructor(canvas, home, away, forms, zoom) {
    this.cv = canvas; this.W = 240; this.H = 150; this.zoom = !!zoom;
    this.off = document.createElement('canvas'); this.off.width = this.W; this.off.height = this.H; this.g = this.off.getContext('2d');
    this.VW = zoom ? 150 : this.W; this.VH = zoom ? 126 : this.H; this.cam = {x: 45, y: 12};
    canvas.width = this.VW; canvas.height = this.VH; this.vg = canvas.getContext('2d');
    this.kits = [home, away].map((c, i) => ({shirt: c.c1, shorts: c.c2, gk: i ? '#e6e62e' : '#33d17a'}));
    if (sameish(home.c1, away.c1)) this.kits[1] = {shirt: away.c2 === '#ffffff' ? '#ffffff' : away.c2, shorts: away.c1, gk: '#e6e62e'};
    if (sameish(this.kits[0].shirt, this.kits[1].shirt)) this.kits[1] = {shirt: '#ffffff', shorts: '#1a1a1a', gk: '#e6e62e'};
    this.forms = forms; this.men = [[], []];
    this.ball = {x: 120, y: 75, h: 0, tx: 120, ty: 75, t0: 0, t1: 0, sx: 120, sy: 75, arc: 0};
    this.poss = 0; this.carrier = null; this.flash = null; this.t = 0; this.queue = []; this.paused = false;
    for (let s = 0; s < 2; s++) for (let k = 0; k < 11; k++) { const [x, y] = this.spot(s, k, 0); this.men[s].push({x, y, tx: x, ty: y, on: true, frame: 0, skin: pick(SKIN), hair: pick(HAIR)}); }
  }
  spot(s, k, push) {
    const f = FORMS[this.forms[s]] || FORMS['4-4-2'];
    let [x, y] = f[k] || [.5, .5];
    x = clamp(x + push, .03, .92);
    const px = s === 0 ? 8 + x * 224 : 232 - x * 224;
    return [px, 10 + y * 130];
  }
  setForms(forms, on) { this.forms = forms; if (on) on.forEach((list, s) => list.forEach((id, k) => { if (this.men[s][k]) this.men[s][k].on = id != null; })); }
  // positions for this moment: the attacking side pushes up and everyone drifts towards the ball
  // a goal celebration: the scorer heads for the corner flag and the team piles in
  celebrate(side, ms) {
    const men = this.men[side].map((m, k) => ({m, k})).filter(o => o.m.on && o.k);
    const scorer = men.sort((a, b) => side === 0 ? b.m.x - a.m.x : a.m.x - b.m.x)[0];
    this.celeb = {side, k: scorer ? scorer.k : 9, until: this.t + (ms || 1700), y: this.ball.y < 75 ? 12 : 138};
  }
  layout() {
    const b = this.ball, cel = this.celeb && this.t < this.celeb.until ? this.celeb : null;
    if (cel) {
      const cx = cel.side === 0 ? 228 : 12, dir = cel.side === 0 ? -1 : 1, dy = cel.y < 75 ? 1 : -1;
      this.men.forEach((side, s) => side.forEach((m, k) => {
        if (s === cel.side && k) {
          if (k === cel.k) { m.tx = cx; m.ty = cel.y; }
          else { const i = (k + 11 - cel.k) % 11; m.tx = cx + dir * (6 + (i % 4) * 6); m.ty = cel.y + dy * (3 + Math.floor(i / 4) * 6); }
        } else { const [x, y] = this.spot(s, k, -.08); m.tx = x; m.ty = y; }
      }));
      return;
    }
    for (let s = 0; s < 2; s++) {
      const att = s === this.poss, push = att ? .14 : -.04;
      this.men[s].forEach((m, k) => {
        let [x, y] = this.spot(s, k, k === 0 ? 0 : push);
        if (k) { x += (b.x - x) * (att ? .18 : .3); y += (b.y - y) * .25; }
        m.tx = x + Math.sin(this.t / 700 + k * 1.7 + s) * 3; m.ty = y + Math.cos(this.t / 900 + k) * 3;
      });
    }
  }
  kick(tx, ty, dur, arc) { const b = this.ball; b.sx = b.x; b.sy = b.y; b.tx = tx; b.ty = ty; b.t0 = this.t; b.t1 = this.t + dur; b.arc = arc || 0; }
  nearest(s, x, y, not) { let best = null, bd = 1e9; this.men[s].forEach((m, k) => { if (!m.on || k === not) return; const d = (m.x - x) ** 2 + (m.y - y) ** 2; if (d < bd) { bd = d; best = k; } }); return best; }
  // one minute of play: some passes, maybe a shot
  playMinute(ev, ms) {
    this.queue = [];
    const s = ev.poss;
    if (s !== this.poss) { this.poss = s; this.carrier = this.nearest(s, this.ball.x, this.ball.y); }
    const passes = ev.shot ? 2 : 3;
    for (let i = 0; i < passes; i++) this.queue.push({type: 'pass'});
    if (ev.shot) this.queue.push({type: 'shot', res: ev.shot, side: ev.shotSide});
    this.stepMs = Math.max(120, ms / this.queue.length);
    this.next = this.t;
  }
  update(dt) {
    this.t += dt;
    const b = this.ball;
    if (this.queue.length && this.t >= this.next) {
      const q = this.queue.shift();
      if (q.type === 'pass') {
        const s = this.poss, dir = s === 0 ? 1 : -1;
        const cands = this.men[s].map((m, k) => ({m, k})).filter(o => o.m.on && o.k !== this.carrier && o.k !== 0);
        const fwd = cands.filter(o => (o.m.x - b.x) * dir > -10);
        const o = pick(fwd.length ? fwd : cands);
        if (o) { this.carrier = o.k; this.kick(o.m.tx, o.m.ty, this.stepMs * .8, R() < .3 ? 8 : 0); }
      } else if (q.type === 'shot') {
        const s = q.side, gx = s === 0 ? 234 : 6, gy = 75;
        const res = q.res;
        const ty = res === 'miss' ? gy + (R() < .5 ? -1 : 1) * ri(16, 26) : res === 'post' ? gy + (R() < .5 ? -10 : 10) : gy + ri(-8, 8);
        this.kick(res === 'save' ? gx - (s === 0 ? 4 : -4) : res === 'miss' ? gx + (s === 0 ? 6 : -6) : gx + (s === 0 ? 3 : -3), ty, 420, res === 'miss' ? 10 : 4);
        this.shotRes = {res, side: s, at: this.t + 420};
      }
      this.next = this.t + this.stepMs;
    }
    // ball flight
    if (b.t1 > b.t0) {
      const k = clamp((this.t - b.t0) / (b.t1 - b.t0), 0, 1);
      b.x = b.sx + (b.tx - b.sx) * k; b.y = b.sy + (b.ty - b.sy) * k; b.h = Math.sin(k * Math.PI) * b.arc;
    } else if (this.carrier != null) {
      const m = this.men[this.poss][this.carrier]; if (m) { b.x += (m.x + (this.poss ? -2 : 2) - b.x) * .2; b.y += (m.y + 1 - b.y) * .2; }
    }
    if (this.shotRes && this.t >= this.shotRes.at) {
      const r = this.shotRes; this.shotRes = null;
      if (r.res === 'goal') { this.net = {side: r.side, until: this.t + 900}; }
      // keeper gathers or it goes out: restart with the other side's keeper
      setTimeout(() => { const s2 = 1 - r.side; this.poss = s2; this.carrier = 0; if (r.res === 'goal') { b.x = 120; b.y = 75; this.carrier = null; } }, r.res === 'goal' ? 900 : 300);
    }
    this.layout();
    this.men.forEach(side => side.forEach(m => {
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy), sp = .045 * dt * (this.celeb && this.t < this.celeb.until ? 1.7 : 1);
      if (d > .3) { m.x += dx / d * Math.min(d, sp); m.y += dy / d * Math.min(d, sp); m.run = (m.run || 0) + dt; m.frame = Math.floor(m.run / 120) % 2; } else m.frame = 0;
    }));
  }
  draw() {
    const g = this.g, Wd = this.W, H = this.H;
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#2f9a3a' : '#2a8c34'; g.fillRect(i * 20, 0, 20, H); }
    g.fillStyle = 'rgba(255,255,255,.85)';
    const line = (x, y, w, h) => g.fillRect(x, y, w, h);
    line(6, 6, Wd - 12, 1); line(6, H - 7, Wd - 12, 1); line(6, 6, 1, H - 12); line(Wd - 7, 6, 1, H - 12); line(Wd / 2, 6, 1, H - 12);
    // centre circle
    for (let a = 0; a < 64; a++) g.fillRect(Math.round(Wd / 2 + Math.cos(a / 64 * 6.283) * 18), Math.round(H / 2 + Math.sin(a / 64 * 6.283) * 18), 1, 1);
    [[6, 1], [Wd - 7, -1]].forEach(([x, d]) => {
      const bx = d > 0 ? x : x - 32; line(bx, 40, 33, 1); line(bx, H - 41, 33, 1); line(d > 0 ? x + 32 : x - 32, 40, 1, H - 80);
      const sx = d > 0 ? x : x - 12; line(sx, 58, 13, 1); line(sx, H - 59, 13, 1); line(d > 0 ? x + 12 : x - 12, 58, 1, H - 116);
      g.fillRect(d > 0 ? x + 22 : x - 22, H / 2, 1, 1);
    });
    // goals with nets
    [[0, 0], [Wd - 6, 1]].forEach(([x, s]) => {
      const shake = this.net && this.net.side !== s && this.t < this.net.until ? Math.sin(this.t / 30) : 0;
      g.fillStyle = 'rgba(255,255,255,.35)';
      for (let yy = 64; yy <= 86; yy += 2) g.fillRect(x + (s ? 1 : 0) + shake, yy, 5, 1);
      g.fillStyle = '#fff'; g.fillRect(s ? x : x + 5, 63, 1, 25); g.fillRect(x, 63, 6, 1); g.fillRect(x, 87, 6, 1);
    });
    // players, back to front
    const all = [];
    this.men.forEach((side, s) => side.forEach((m, k) => { if (m.on) all.push({m, s, k}); }));
    all.sort((a, b) => a.m.y - b.m.y);
    const cel = this.celeb && this.t < this.celeb.until ? this.celeb : null;
    all.forEach(({m, s, k}) => {
      const kit = this.kits[s], jump = cel && s === cel.side && k && Math.hypot(m.tx - m.x, m.ty - m.y) < 4 ? ((Math.floor(this.t / 130) + k) % 2 ? 2 : 0) : 0;
      sprite(g, m.x, m.y - jump, k === 0 ? kit.gk : kit.shirt, kit.shorts, m.frame, {skin: m.skin, hair: m.hair, hi: !cel && s === this.poss && k === this.carrier});
      if (jump && k === cel.k) { g.fillStyle = m.skin; g.fillRect(Math.round(m.x) - 3, Math.round(m.y - jump) - 8, 1, 3); g.fillRect(Math.round(m.x) + 2, Math.round(m.y - jump) - 8, 1, 3); }
    });
    // ball and shadow
    const b = this.ball;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(Math.round(b.x - 1), Math.round(b.y), 2, 1);
    g.fillStyle = '#fff'; g.fillRect(Math.round(b.x - 1), Math.round(b.y - 1 - b.h), 2, 2);
    g.fillStyle = '#222'; g.fillRect(Math.round(b.x), Math.round(b.y - 1 - b.h), 1, 1);
    // camera: follow the ball (Sensi style), with a little radar in the corner
    const v = this.vg, VW = this.VW, VH = this.VH;
    if (this.zoom) {
      const tx = clamp(b.x - VW / 2, 0, Wd - VW), ty = clamp(b.y - VH / 2, 0, H - VH);
      this.cam.x += (tx - this.cam.x) * .08; this.cam.y += (ty - this.cam.y) * .08;
      v.drawImage(this.off, Math.round(this.cam.x), Math.round(this.cam.y), VW, VH, 0, 0, VW, VH);
      const rx = VW - 42, ry = 3, sc = 40 / Wd;
      v.fillStyle = 'rgba(0,0,0,.55)'; v.fillRect(rx - 1, ry - 1, 42, 27);
      v.strokeStyle = 'rgba(255,255,255,.5)'; v.lineWidth = 1; v.strokeRect(rx + .5, ry + .5, 39, 24);
      v.strokeRect(rx + .5 + this.cam.x * sc, ry + .5 + this.cam.y * sc, VW * sc, VH * sc);
      this.men.forEach((side, s) => side.forEach(m => { if (!m.on) return; v.fillStyle = this.kits[s].shirt; v.fillRect(rx + Math.round(m.x * sc), ry + Math.round(m.y * sc), 1, 1); }));
      v.fillStyle = '#fff'; v.fillRect(rx + Math.round(b.x * sc), ry + Math.round(b.y * sc) , 1, 1);
    } else v.drawImage(this.off, 0, 0);
    if (this.flash && this.t < this.flash.until) {
      const on = Math.floor(this.t / 160) % 2;
      v.fillStyle = 'rgba(0,0,0,.45)'; v.fillRect(0, VH / 2 - 16, VW, 32);
      v.font = `16px ${FONT}`; v.textAlign = 'center'; v.textBaseline = 'middle';
      v.fillStyle = '#000'; v.fillText(this.flash.txt, VW / 2 + 2, VH / 2 + 2);
      v.fillStyle = on ? this.flash.col : '#fff'; v.fillText(this.flash.txt, VW / 2, VH / 2);
    }
  }
  banner(txt, col, ms) { this.flash = {txt, col: col || '#ffd23f', until: this.t + (ms || 1500)}; }
}
function sameish(a, b) {
  const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const x = h(a), y = h(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 140;
}

// ---------- sound: tiny synthesised effects
const SND = {
  ctx: null, crowd: null,
  get on() { return !W || W.settings.sound !== false; },
  init() { if (this.ctx) return this.ctx; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return this.ctx; },
  tone(f, d, type, vol, slide) {
    if (!this.on) return; const c = this.init(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type || 'square'; o.frequency.value = f;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + d);
    g.gain.setValueAtTime(vol || .08, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + d);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + d);
  },
  noise(d, vol, freq, q) {
    if (!this.on) return; const c = this.init(); if (!c) return;
    const len = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 800; f.Q.value = q || .7;
    g.gain.setValueAtTime(.0001, c.currentTime); g.gain.linearRampToValueAtTime(vol || .2, c.currentTime + d * .15); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + d);
    src.connect(f).connect(g).connect(c.destination); src.start();
  },
  whistle(n) { for (let i = 0; i < (n || 1); i++) setTimeout(() => { this.tone(2350, .22, 'sine', .07); this.tone(2500, .22, 'sine', .04); }, i * 300); },
  kick() { this.noise(.06, .25, 300, 1.5); },
  roar() { this.noise(2.2, .28, 700, .5); this.noise(1.6, .12, 1500, .8); },
  ooh() { this.noise(1.1, .14, 500, .9); },
  click() { this.tone(660, .05, 'square', .04); },
  good() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, .12, 'square', .05), i * 80)); },
  bad() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, .16, 'square', .05), i * 110)); },
};
