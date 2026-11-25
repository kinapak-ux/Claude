// PIXTEXT: the teletext screen and the remote control.
// The screen is 40 columns by 25 rows: row 0 is the header, rows 1-23 are the page,
// row 24 is the four coloured "fastext" buttons.
//
// Pages are written as rows of text with colour codes in square brackets:
//   [r] [g] [y] [b] [m] [c] [w] [k]   text colour (red, green, yellow, blue, magenta, cyan, white, black)
//   [R] [G] [Y] [B] [M] [C] [W] [K]   background colour (fills to the end of the row)
//   [*] flashing text   [/] back to white on black
//   [@300] ... [@]      a link to page 300 (tap it to go there)
// A row can also be an object: {t: text, a: action, dh: true (double height), gfx: [...] (mosaic blocks)}.
// An action is a page number or a function.
'use strict';
const COLS = 40, ROWS = 25, PAGE_ROWS = 23;
const TTX = {k: '#000', r: '#ff2020', g: '#20ff20', y: '#ffff20', b: '#4a5cff', m: '#ff20ff', c: '#20ffff', w: '#ffffff'};
const $ = s => document.querySelector(s);

// What's on screen right now
const G = {page: 100, sub: 0, buf: '', hist: [], cur: -1, kbd: false, note: null, confirm: null, rows: [], fast: [], subs: 1};

// ---------- turning "[y]HELLO [@100]100[@]" into coloured pieces
function parseRow(str) {
  const segs = []; let fg = 'w', bg = 'k', flash = false, link = null, buf = '';
  const push = () => { if (buf) segs.push({fg, bg, flash, link, text: buf}); buf = ''; };
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '[') {
      const m = /^\[(@\d*|[rgybmcwkRGYBMCWK/*])\]/.exec(str.slice(i, i + 7));
      if (m) {
        push(); const c = m[1];
        if (c[0] === '@') link = c.length > 1 ? +c.slice(1) : null;
        else if (c === '/') { fg = 'w'; bg = 'k'; flash = false; }
        else if (c === '*') flash = true;
        else if (c === c.toUpperCase()) bg = c.toLowerCase();
        else fg = c;
        i += m[0].length - 1; continue;
      }
    }
    buf += str[i];
  }
  push();
  return segs;
}
const htmlEsc = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
// visible length of a row (without the colour codes)
const vlen = s => parseRow(s).reduce((n, x) => n + x.text.length, 0);
function rowHTML(str) {
  let n = 0, out = '', lastBg = 'k';
  for (const s of parseRow(str)) {
    if (n >= COLS) break;
    const t = s.text.slice(0, COLS - n); n += t.length; lastBg = s.bg;
    out += `<span class="${s.flash ? 'fl' : ''}" style="color:${TTX[s.fg]};background:${TTX[s.bg]}"${s.link ? ` data-link="${s.link}"` : ''}>${htmlEsc(t)}</span>`;
  }
  if (n < COLS) out += `<span style="background:${TTX[lastBg]}">${' '.repeat(COLS - n)}</span>`;
  return out;
}
// mosaic graphics: two lines of pixels per text row ('#' = on), drawn as half-cells
function gfxHTML(top, bottom, on, off) {
  let out = '';
  for (let x = 0; x < COLS; x++) {
    const a = TTX[(top[x] || ' ') === '#' ? on : off], b = TTX[(bottom[x] || ' ') === '#' ? on : off];
    out += `<span style="background:linear-gradient(${a} 50%,${b} 50%)"> </span>`;
  }
  return out;
}
// big blocky letters for the index page
const MOSAIC_FONT = {
  P: ['###', '#.#', '###', '#..', '#..'], I: ['###', '.#.', '.#.', '.#.', '###'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'], E: ['###', '#..', '##.', '#..', '###'], G: ['###', '#..', '#.#', '#.#', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'], A: ['###', '#.#', '###', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'], ' ': ['...', '...', '...', '...', '...'],
};
function mosaicWord(word, on, off) {
  const px = ['', '', '', '', '', ''];
  [...word].forEach(ch => { const f = MOSAIC_FONT[ch] || MOSAIC_FONT[' ']; for (let y = 0; y < 5; y++) px[y] += f[y].replace(/\./g, ' ') + ' '; });
  const w = px[0].length, left = Math.max(0, Math.floor((COLS - w) / 2));
  const line = y => ' '.repeat(left) + (px[y] || '');
  return [0, 2, 4].map(y => ({gfx: [line(y), line(y + 1)], on, off}));
}

// ---------- drawing a page
// A page function returns {head: [], body: [], foot: [], fast: [[label, action] x4], focus}
// The body is split into sub-pages (1/2, 2/2...) if it doesn't fit.
const rowH = r => r && typeof r === 'object' && r.dh ? 2 : 1;
function layout(pg) {
  const head = pg.head || [], foot = (G.note ? [`[y]${G.note}`] : []).concat(pg.foot || []), body = pg.body || [];
  const room = PAGE_ROWS - head.reduce((n, r) => n + rowH(r), 0) - foot.reduce((n, r) => n + rowH(r), 0);
  const total = body.reduce((n, r) => n + rowH(r), 0);
  const chunks = [];
  if (total <= room) chunks.push(body);
  else {
    const per = Math.max(1, room - 1); let cur = [], used = 0;
    body.forEach(r => { if (used + rowH(r) > per) { chunks.push(cur); cur = []; used = 0; } cur.push(r); used += rowH(r); });
    if (cur.length) chunks.push(cur);
  }
  if (G.focusNext != null && pg.focus != null) {
    let seen = 0; chunks.forEach((ch, i) => { if (pg.focus >= seen && pg.focus < seen + ch.length) G.sub = i; seen += ch.length; });
  }
  G.focusNext = null;
  G.subs = chunks.length; G.sub = clamp(G.sub, 0, chunks.length - 1);
  const mid = chunks[G.sub].slice();
  let used = mid.reduce((n, r) => n + rowH(r), 0);
  if (chunks.length > 1) { while (used < room - 1) { mid.push(''); used++; } mid.push(`[c]   < >  turn the page    [w]${G.sub + 1}/${chunks.length}`); used++; }
  const rows = head.concat(mid);
  used = rows.reduce((n, r) => n + rowH(r), 0);
  while (used < PAGE_ROWS - foot.reduce((n, r) => n + rowH(r), 0)) { rows.push(''); used++; }
  return rows.concat(foot);
}
function header() {
  const shown = G.buf ? (G.buf + '---').slice(0, 3) : String(G.page);
  const d = new Date(), clock = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  const day = W && W.cal ? dateOf(W.season, Math.min(W.week, W.cal.length - 1)).replace(/(\d{2})(\d{2})$/, '$2') : d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
  return `[w]P${shown} [B][y] PIXTEXT [/] [w]${pad(day, 11)} [y]${clock}`;
}
function render() {
  let pg;
  try { pg = pageFor(G.page); }
  catch (e) { console.error(e); pg = {body: ['[r]Sorry, this page has a fault.', '', `[w]${clean(e.message).slice(0, 38)}`, '', '[@100][c]100[w] Back to the index[@]'], fast: [['INDEX', 100]]}; }
  if (!pg) pg = notFound();
  const rows = layout(pg);
  G.rows = []; G.fast = (pg.fast || []).concat([null, null, null, null]).slice(0, 4);
  let html = `<div class="row">${rowHTML(header())}</div>`, line = 1;
  const acts = [];
  rows.forEach(r => {
    if (line > PAGE_ROWS) return;
    const o = typeof r === 'object' && r ? r : {t: r || ''};
    const i = G.rows.length; G.rows.push(o);
    if (o.a != null) acts.push(i);
    const cur = G.kbd && acts.length - 1 === G.cur && o.a != null;
    if (o.gfx) html += `<div class="row">${gfxHTML(o.gfx[0], o.gfx[1], o.on || 'y', o.off || 'k')}</div>`;
    else if (o.dh && line < PAGE_ROWS) html += `<div class="row dh${o.a != null ? ' act' : ''}${cur ? ' cur' : ''}" data-i="${i}"><span class="dhi">${rowHTML(o.t)}</span></div>`;
    else html += `<div class="row${o.a != null ? ' act' : ''}${cur ? ' cur' : ''}" data-i="${i}">${rowHTML(o.t)}</div>`;
    line += o.dh ? 2 : 1;
  });
  G.acts = acts;
  const fcol = ['r', 'g', 'y', 'c'];
  html += `<div class="row fastrow">${G.fast.map((f, k) => `<span class="fk" data-f="${k}" style="color:${TTX[fcol[k]]}">${htmlEsc(pad(f ? f[0].toUpperCase().slice(0, 9) : '', 10))}</span>`).join('')}</div>`;
  $('#tv').innerHTML = html;
  // the coloured buttons on the remote show what they do on this page
  document.querySelectorAll('#remote .fb').forEach((b, k) => { b.textContent = G.fast[k] ? G.fast[k][0] : ''; b.disabled = !G.fast[k]; });
}
function notFound() {
  return {head: [{t: `[y]PAGE ${G.page} NOT FOUND`, dh: true}], body: ['', '[w]There is nothing on this page.', '', '[@100][c]100[w] Go to the index[@]', '[@700][c]700[w] How to use PIXTEXT[@]'], fast: [['INDEX', 100], null, null, ['HELP', 700]]};
}

// ---------- moving around
function goto(n) {
  if (n !== G.page) { G.hist.push(G.page); G.hist = G.hist.slice(-30); }
  G.page = n; G.sub = 0; G.cur = -1; G.note = null; G.confirm = null; G.focusNext = true;
  render();
}
function back() { if (G.hist.length) { G.page = G.hist.pop(); G.sub = 0; G.cur = -1; G.note = null; G.confirm = null; G.focusNext = true; render(); } }
function act(a) {
  if (a == null) return;
  if (typeof a === 'number') return goto(a);
  beep(660, .03);
  a(); render();
}
let bufTimer = null;
function digit(d) {
  if (!G.buf && (d === '0' || d === '9')) return;   // pages run from 100 to 899
  G.buf += d; clearTimeout(bufTimer);
  if (G.buf.length === 3) { const n = +G.buf; G.buf = ''; beep(880, .02); goto(n); return; }
  bufTimer = setTimeout(() => { G.buf = ''; render(); }, 4000);
  render();
}
function subpage(d) { if (G.subs > 1) { G.sub = (G.sub + d + G.subs) % G.subs; G.cur = -1; render(); } }
function moveCur(d) { G.kbd = true; const n = (G.acts || []).length; if (!n) return; G.cur = G.cur < 0 ? (d > 0 ? 0 : n - 1) : (G.cur + d + n) % n; render(); }
function press(k) {
  if (/^\d$/.test(k)) return digit(k);
  if (k === 'prev') return subpage(-1);
  if (k === 'next') return subpage(1);
  if (k === 'back') return back();
  if (k === 'index') return goto(100);
  if (k[0] === 'f') { const f = G.fast[+k[1]]; if (f) act(f[1]); }
}

// ---------- tapping and typing
document.addEventListener('click', e => {
  const t = e.target;
  const link = t.closest('[data-link]'); if (link) { goto(+link.dataset.link); return; }
  const fk = t.closest('[data-f]'); if (fk) { press('f' + fk.dataset.f); return; }
  const row = t.closest('#tv .row[data-i]');
  if (row) { const o = G.rows[+row.dataset.i]; if (o && o.a != null) { G.kbd = false; act(o.a); } return; }
  const key = t.closest('#remote [data-k]'); if (key) { G.kbd = false; press(key.dataset.k); }
});
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (/^\d$/.test(k)) press(k);
  else if (k === 'ArrowLeft') press('prev');
  else if (k === 'ArrowRight') press('next');
  else if (k === 'ArrowUp') moveCur(-1);
  else if (k === 'ArrowDown') moveCur(1);
  else if (k === 'Enter' || k === ' ') { const i = (G.acts || [])[G.cur]; if (G.kbd && i != null) act(G.rows[i].a); else return; }
  else if (k === 'Backspace' || k === 'Escape') press('back');
  else if (k === 'Home' || k === 'i') press('index');
  else if ('rgyb'.includes(k.toLowerCase()) && k.length === 1) press('f' + 'rgyb'.indexOf(k.toLowerCase()));
  else return;
  e.preventDefault();
});

// ---------- fitting 40 x 25 characters to any screen
let RATIO = .4;
function measure() { const c = document.createElement('canvas').getContext('2d'); c.font = "100px 'VT323', monospace"; RATIO = c.measureText('MMMMMMMMMM').width / 1000 || .4; }
function fit() {
  const wide = innerWidth >= 760 && innerWidth > innerHeight * 1.15;
  document.body.classList.toggle('wide', wide);
  const rem = $('#remote');
  const aw = Math.min(innerWidth - 20 - (wide ? rem.offsetWidth + 24 : 0), 1000);
  const ah = innerHeight - 20 - (wide ? 0 : rem.offsetHeight + 12);
  // rows are about 1.6 times taller than a character is wide; on tall phones they can stretch a little
  let cw = aw / COLS, lh = Math.min(cw * 2, ah / ROWS);
  if (lh < cw * 1.55) { lh = ah / ROWS; cw = Math.min(cw, lh / 1.55); }
  const fs = lh * 1.08, sx = cw / (RATIO * fs);
  const st = document.documentElement.style;
  st.setProperty('--lh', lh + 'px'); st.setProperty('--fs', fs + 'px'); st.setProperty('--sx', sx);
  st.setProperty('--tvw', cw * COLS + 'px'); st.setProperty('--tvh', lh * ROWS + 'px');
}
addEventListener('resize', fit);

// ---------- one little beep (teletext tellies weren't known for their sound)
let actx = null;
function beep(f, d) {
  if (W && W.settings && W.settings.sound === false) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(.04, actx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + d + .02);
  } catch (e) {}
}

// ---------- text helpers used by the pages
const pad = (s, n) => { s = String(s ?? ''); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
const lpad = (s, n) => { s = String(s ?? ''); return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s; };
// names and messages are shown as plain text: no square brackets, so they can't look like colour codes
const clean = s => String(s ?? '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/[^\x20-\x7e£]/g, '');
function wrap(txt, w) {
  w = w || COLS; const out = []; let line = '';
  clean(txt).split(/\s+/).filter(Boolean).forEach(word => {
    if ((line + ' ' + word).trim().length > w) { if (line) out.push(line); line = word.slice(0, w); } else line = (line + ' ' + word).trim();
  });
  if (line) out.push(line);
  return out;
}
