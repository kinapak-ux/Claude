// Pixel Gaffer '96: achievements, music, the guided tour, highlights, trophy celebrations,
// save slots and backups, scouting, player comparison, loans UI and pixel menu icons.
'use strict';

// ---------- save slots
const SLOT_KEYS = ['pixelgaffer-save', 'pixelgaffer-save-2', 'pixelgaffer-save-3'];
const slotKey = n => SLOT_KEYS[(n || 1) - 1];
function slotInfo(n) {
  try {
    const raw = localStorage.getItem(slotKey(n)); if (!raw) return null;
    const w = JSON.parse(raw); if (!w || !w.clubs) return null;
    const c = w.clubs[w.clubId];
    return {n, name: w.name, club: c, div: c.div, season: w.season, week: w.week, pts: w.career ? w.career.pts : 0};
  } catch (e) { return null; }
}
function slotsHTML(mode) {
  return `<h3>${mode === 'new' ? 'Where shall we save your new career?' : 'Saved careers'}</h3>
  ${[1, 2, 3].map(n => {
    const s = slotInfo(n);
    return `<div class="slotrow">${s ? `${badgeImg(s.club, 28)}<div class="sl"><b>${esc(s.club.name)}</b><small>${esc(s.name)} · ${seasonLabel(s.season)} · ${DIVS[s.div]} · ${s.pts} pts</small></div>` : `<div class="sl"><b class="c-d">Slot ${n}: empty</b></div>`}
      <div class="slb">${mode === 'new' ? `<button class="btn small ${s ? 'bad' : 'go'}" data-a="slotNew" data-n="${n}">${s ? 'Overwrite' : 'Use'}</button>`
        : `${s ? `<button class="btn small go" data-a="slotLoad" data-n="${n}">Load</button><button class="btn small bad" data-a="slotDel" data-n="${n}">✕</button>` : `<button class="btn small" data-a="slotNew" data-n="${n}">New</button>`}
        <label class="btn small ghost">Restore<input type="file" accept=".json,application/json" data-a="slotRestore" data-n="${n}" hidden></label>`}</div></div>`;
  }).join('')}
  <p class="note">"Restore" loads a backup file you saved from CLUB › Settings.</p>
  <button class="btn ghost small" data-a="close">Close</button>`;
}
function exportSave() {
  save();
  const blob = new Blob([JSON.stringify(W)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pixel-gaffer-${me().short.toLowerCase()}-${seasonLabel(W.season).replace('/', '-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup saved to your downloads.');
}
function restoreSave(n, file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const w = JSON.parse(r.result);
      if (!w || !w.clubs || w.clubId == null || !w.players) throw new Error('bad');
      if (slotInfo(n) && !confirm(`Replace the career in slot ${n} with this backup?`)) return;
      localStorage.setItem(slotKey(n), JSON.stringify(w));
      toast('Backup restored!'); modal(slotsHTML('load'));
    } catch (e) { toast("That file isn't a Pixel Gaffer backup."); }
  };
  r.readAsText(file);
}

// ---------- achievements (kept on this phone, across every career)
const ACH_KEY = 'pixelgaffer-ach', STATS_KEY = 'pixelgaffer-stats';
const ACHS = [
  ['first_win', '🥇', 'Off the mark', 'Win your first match'],
  ['clean', '🧤', 'Shut-out', 'Keep a clean sheet'],
  ['thrash', '💥', 'Thrashing', 'Win by five goals or more'],
  ['hattrick', '🎩', 'Hat-trick hero', 'One of your players scores three in a game'],
  ['unbeaten10', '🛡️', 'Unbeatable', 'Go ten games unbeaten'],
  ['sellout', '🏟️', 'Full house', 'Sell out your ground'],
  ['promo', '⬆️', 'Going up!', 'Win promotion'],
  ['champ', '🏆', 'Champions', 'Win a league title'],
  ['prem', '👑', 'Top of the pile', 'Win the Premier Division'],
  ['cup', '🥤', 'Cup kings', `Win the ${CUP_NAME}`],
  ['cup_d3', '🪄', 'Giant-killers', `Win the ${CUP_NAME} with a Division Three club`],
  ['pen_score', '⚽', 'Cool as you like', 'Score a penalty yourself in a match'],
  ['pen_save', '🦸', 'Penalty saver', 'Save a penalty yourself in a match'],
  ['fk_goal', '🎯', 'Bend it', 'Score a free kick yourself in a match'],
  ['shootout', '🥅', 'Nerves of steel', 'Win a penalty shoot-out'],
  ['keepy50', '🦶', 'Keepy-uppy king', '50 keepy-uppies'],
  ['keepy100', '🌟', 'Keepy-uppy legend', '100 keepy-uppies'],
  ['fk8', '🌀', 'Dead-ball wizard', 'Score 8 out of 10 in the free-kick challenge'],
  ['scen20', '📰', 'Media darling', 'Answer 20 club dilemmas'],
  ['gambler', '🎲', 'Lucky gaffer', 'Win five gambles'],
  ['wonderkid', '💎', 'Wonderkid', 'Have a player aged 20 or under rated 70+'],
  ['bigspend', '💸', 'Big spender', 'Pay £1M or more for one player'],
  ['rich', '💰', 'Rolling in it', 'Have £10M in the bank'],
  ['veteran', '🧓', 'Old hand', 'Manage five seasons'],
  ['sacked', '🥾', 'P45', 'Get the sack (it happens to the best)'],
];
const achGot = () => lget(ACH_KEY, {});
function ach(id) {
  const got = achGot(); if (got[id]) return;
  const a = ACHS.find(x => x[0] === id); if (!a) return;
  got[id] = Date.now(); lset(ACH_KEY, got);
  setTimeout(() => {
    const el = document.createElement('div'); el.className = 'achtoast';
    el.innerHTML = `<span class="ai">${a[1]}</span><div><small>ACHIEVEMENT UNLOCKED</small><b>${esc(a[2])}</b><span>${esc(a[3])}</span></div>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 3600);
    SND.good();
  }, 400);
  if (window.FamilyScores) FamilyScores.submit('pixelgaffer', 'achievements', Object.keys(got).length, {fallbackName: W && W.name});
}
function bumpStat(k, n) { const s = lget(STATS_KEY, {}); s[k] = (s[k] || 0) + (n || 1); lset(STATS_KEY, s); return s[k]; }
function achHTML() {
  const got = achGot(), n = ACHS.filter(a => got[a[0]]).length;
  return `<div class="achgrid">${ACHS.map(a => `<div class="achb ${got[a[0]] ? 'on' : ''}"><span class="ai">${got[a[0]] ? a[1] : '🔒'}</span><b>${esc(a[2])}</b><small>${esc(a[3])}</small></div>`).join('')}</div>
    <p class="note">${n} of ${ACHS.length} unlocked. Achievements count across every career on this phone.</p>`;
}
// checks after each of your matches
function achAfterMatch(rep) {
  const r = rep.user; if (!r) return;
  const c = me(), home = r.h === c.id, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg, side = home ? 0 : 1;
  const won = r.win != null ? r.win === c.id : gf > ga, lost = r.win != null ? r.win !== c.id : gf < ga;
  if (won) ach('first_win');
  if (ga === 0) ach('clean');
  if (won && gf - ga >= 5) ach('thrash');
  const counts = {}; (r.sc || []).filter(s => s[1] === side).forEach(s => { counts[s[2]] = (counts[s[2]] || 0) + 1; });
  if (Object.values(counts).some(n => n >= 3)) ach('hattrick');
  W.unbeaten = lost ? 0 : (W.unbeaten || 0) + 1;
  if (W.unbeaten >= 10) ach('unbeaten10');
  if (home && r.att >= C(r.h).cap) ach('sellout');
  if (r.cup && W.cup.winner === c.id) { ach('cup'); if (c.div === 3) ach('cup_d3'); }
  if (c.cash >= 1e7) ach('rich');
  if (c.squad.map(P).some(p => p.age <= 20 && ovr(p) >= 70)) ach('wonderkid');
}
function achAfterSeason(S) {
  const u = S.user;
  if (u.sacked) ach('sacked');
  if (u.pos === 1) { ach('champ'); if (u.div === 0) ach('prem'); }
  if (u.pos <= 2 && u.div > 0) ach('promo');
  if (W.career.seasons >= 5) ach('veteran');
}

// ---------- chiptune music (an original tune, synthesised live)
const NOTE = n => { const m = /^([A-G])(#?)(\d)$/.exec(n); const i = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (i + (+m[3] + 1) * 12 - 69) / 12); };
const SONGS = {
  title: {bpm: 136,
    lead: 'E5 - G5 E5 C5 - D5 E5 F5 - A5 F5 D5 - E5 F5 G5 - C6 B5 A5 G5 F5 E5 D5 E5 F5 D5 C5 - - - E5 - G5 E5 C6 - B5 A5 G5 - E5 G5 A5 - G5 F5 E5 - D5 E5 F5 A5 G5 F5 E5 D5 C5 D5 C5 - - -'.split(' '),
    bass: 'C3 G2 C3 G2 F2 C3 F2 C3 C3 G2 A2 E2 G2 D3 G2 G2 C3 G2 C3 G2 F2 C3 F2 C3 A2 E2 F2 G2 C3 G2 C3 C3'.split(' ')},
  anthem: {bpm: 100,
    lead: 'G4 - B4 D5 G5 - F#5 E5 D5 - B4 G4 A4 - - - C5 - E5 G5 A5 - G5 F#5 G5 - D5 B4 G4 - - - B4 - D5 G5 B5 - A5 G5 F#5 - A5 F#5 D5 - - - E5 - G5 E5 D5 - B4 A4 G4 - A4 B4 G4 - - -'.split(' '),
    bass: 'G2 D3 G2 D3 C3 G2 D3 D3 C3 G2 E2 B2 D3 A2 G2 G2 G2 D3 G2 D3 D3 A2 D3 F#2 C3 G2 D3 D3 G2 D3 G2 G2'.split(' ')},
};
const MUSIC = {
  track: null, timer: null, master: null, noiseBuf: null,
  get on() { return lget('pixelgaffer-music', true); },
  set on(v) { lset('pixelgaffer-music', !!v); if (!v) this.stop(); else if (this.track) { const t = this.track; this.track = null; this.want(t); } },
  want(name) {
    if (name === this.track && (this.timer || !name)) return;
    this.stop(); this.track = name;
    if (name && this.on) this.start();
  },
  start() {
    const c = SND.init(); if (!c || !this.track) return;
    if (c.state === 'suspended') {
      const go = () => { document.removeEventListener('pointerdown', go, true); c.resume().then(() => { if (this.track && this.on && !this.timer) this.start(); }); };
      document.addEventListener('pointerdown', go, true); return;
    }
    const song = SONGS[this.track]; if (!song) return;
    this.master = c.createGain(); this.master.gain.value = .55; this.master.connect(c.destination);
    if (!this.noiseBuf) { const len = c.sampleRate * .2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b; }
    const dur = 60 / song.bpm / 2; let step = 0, t = c.currentTime + .08;
    const play = (s, at) => {
      const n = song.lead[s % song.lead.length];
      if (n && n !== '-') this.tone(c, NOTE(n), at, dur * .9, 'square', .035);
      if (s % 2 === 0) { const b = song.bass[(s >> 1) % song.bass.length]; if (b) this.tone(c, NOTE(b), at, dur * 1.8, 'triangle', .09); }
      const beat = s % 8;
      if (beat === 0 || beat === 4) this.kick(c, at);
      if (beat === 2 || beat === 6) this.hit(c, at, .07, 1800, .12);
      if (s % 2 === 1) this.hit(c, at, .02, 7000, .03);
    };
    this.timer = setInterval(() => { while (t < c.currentTime + .2) { play(step, t); t += dur; step++; } }, 40);
  },
  tone(c, f, at, d, type, vol) { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.0001, at + d); o.connect(g).connect(this.master); o.start(at); o.stop(at + d + .02); },
  kick(c, at) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, at); o.frequency.exponentialRampToValueAtTime(45, at + .12); g.gain.setValueAtTime(.18, at); g.gain.exponentialRampToValueAtTime(.0001, at + .14); o.connect(g).connect(this.master); o.start(at); o.stop(at + .15); },
  hit(c, at, d, freq, vol) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; f.type = 'highpass'; f.frequency.value = freq; g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.0001, at + d); s.connect(f).connect(g).connect(this.master); s.start(at); s.stop(at + d + .02); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; if (this.master) { try { this.master.gain.value = 0; this.master.disconnect(); } catch (e) {} } this.master = null; },
};

// ---------- pixel icons for the bottom menu
const NAV_ICONS = {
  home: ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', '..X.....X..', '..X.XXX.X..', '..X.X.X.X..', '..X.X.X.X..', '..XXX.XXX..'],
  squad: ['..XX...XX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXX.XXX.XXX', '.X..XXX..X.', '...XXXXX...', '...XX.XX...', '...XXXXX...', '...XXXXX...', '...XXXXX...'],
  tactics: ['XXXXXXXXXXX', 'X.........X', 'X.X.X...X.X', 'X..X...X.XX', 'X.X.X...X.X', 'X....XX...X', 'X......X..X', 'X.....XXX.X', 'X.........X', 'XXXXXXXXXXX'],
  league: ['XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.XXXXXXX.X', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....', '....XXX....', '..XXXXXXX..'],
  club: ['X....X....X', 'XX..XXX..XX', 'XXXXXXXXXXX', 'X.X.X.X.X.X', 'XXXXXXXXXXX', 'X.X.X.X.X.X', 'XXXXXXXXXXX', 'XX.XXXXX.XX', 'XX.XX.XX.XX', 'XXXXX.XXXXX'],
};
const navIconCache = {};
function navIcon(k, col) {
  const key = k + col; if (navIconCache[key]) return navIconCache[key];
  const rows = NAV_ICONS[k], cv = document.createElement('canvas'); cv.width = 11; cv.height = 10;
  const g = cv.getContext('2d'); g.fillStyle = col;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') g.fillRect(x, y, 1, 1); }));
  return navIconCache[key] = cv.toDataURL();
}

// ---------- scouting: other clubs' players show as a rough range until your scout has seen them
const known = p => !p || p.club === W.clubId || p.loanFrom === W.clubId || !!(W.scouted && W.scouted[p.id]);
function ratingRange(p, pos) { const o = ovr(p, pos), lo = clamp(o - ((p.id * 7) % 9) - 1, 1, 90); return [lo, lo + 10]; }
function ovrHTML(p, pos) {
  if (known(p)) { const o = ovr(p, pos); return `<span class="${ovrCol(o)}">${o}</span>`; }
  const [lo, hi] = ratingRange(p, pos); return `<span class="${ovrCol(lo + 5)} rng">${lo}-${hi}</span>`;
}
const estOvr = p => known(p) ? ovrOf(p) : (ratingRange(p)[0] + 5) / 5;
const scoutCost = () => [25000, 8000, 2500, 800][me().div];
function scoutPlayers(ids) {
  W.scouted = W.scouted || {};
  ids.forEach(id => { W.scouted[id] = 1; });
}

// ---------- comparing a target with your own best player in that position
function compareHTML(p) {
  const mine = me().squad.map(P).filter(q => q.pos === p.pos).sort((a, b) => ovrOf(b) - ovrOf(a))[0];
  if (!mine) return '';
  const keys = p.pos === 'GK' ? [['gk', 'Goalkeeping'], ['pas', 'Kicking'], ['pac', 'Agility']] : [['pac', 'Pace'], ['tkl', 'Tackling'], ['pas', 'Passing'], ['sho', 'Shooting']];
  const k = known(p);
  const cell = (a, b, hide) => hide ? '<td class="c-d">?</td>' : `<td class="${a > b + .4 ? 'c-g' : a < b - .4 ? 'c-r' : ''}">${Math.round(a)}</td>`;
  return `<h3 class="divh">Compared with your best ${POS_NAME[p.pos].toLowerCase()}</h3>
  <table class="tbl cmpt"><thead><tr><th></th><th>${esc(pname(mine))}</th><th>${esc(pname(p))}</th></tr></thead><tbody>
    <tr><td>Rating</td><td>${ovr(mine)}</td><td>${ovrHTML(p)}</td></tr>
    <tr><td>Age</td><td>${mine.age}</td><td>${p.age}</td></tr>
    ${keys.map(([key, n]) => `<tr><td>${n}</td>${cell(mine.a[key], p.a[key], false)}${cell(p.a[key], mine.a[key], !k)}</tr>`).join('')}
    <tr><td>Wage</td><td>${money(mine.wage)}</td><td>${money(p.club < 0 ? wageDemand(p, me().div) : p.wage)}</td></tr>
  </tbody></table>${k ? '' : '<p class="note">Scout him to see his real numbers.</p>'}`;
}

// ---------- the guided first week
const TOUR = [
  {sel: '.hdr [data-a=go]', txt: "This is your big button. It always shows what's next. Tap it when you're ready to play."},
  {sel: '.nextfx', txt: 'Your next opponent: where they are in the league and their recent form.'},
  {sel: '.nav [data-t=tactics]', txt: "TACTICS: pick your team, formation and playing style. Styles beat other styles, so check who you're playing!"},
  {sel: '.nav [data-t=squad]', txt: 'SQUAD: your players. The TRANSFER MARKET is in here too, for buying, selling and loans.'},
  {sel: '.nav [data-t=league]', txt: 'TABLES: the league table, your fixtures calendar and the cup.'},
  {sel: '.nav [data-t=club]', txt: 'CLUB: training, money, the board, achievements and settings. Run a drill each week for a training bonus!'},
  {sel: '.hdr [data-a=go]', txt: "That's it, gaffer. Swipe left and right to move between screens. Good luck!"},
];
function startTour() { UI.tab = 'home'; UI.screen = 'game'; render(); UI.tour = 0; showTour(); }
function showTour() {
  document.querySelectorAll('.tour').forEach(e => e.remove());
  const st = TOUR[UI.tour]; if (!st) return endTour();
  const target = document.querySelector(st.sel);
  if (!target) { UI.tour++; return showTour(); }
  target.scrollIntoView({block: 'center'});
  const r = target.getBoundingClientRect(), pad = 6;
  const el = document.createElement('div'); el.className = 'tour';
  const below = r.top < innerHeight / 2;
  el.innerHTML = `<div class="tspot" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>
    <div class="tbub" style="${below ? `top:${r.bottom + 14}px` : `bottom:${innerHeight - r.top + 14}px`}"><small>${UI.tour + 1} of ${TOUR.length}</small><p>${esc(st.txt)}</p>
    <div class="acts"><button class="btn go small" data-a="tourNext">${UI.tour === TOUR.length - 1 ? "Let's go!" : 'Next ▶'}</button>${UI.tour < TOUR.length - 1 ? '<button class="btn ghost small" data-a="tourEnd">Skip tour</button>' : ''}</div></div>`;
  document.body.appendChild(el);
}
function endTour() { document.querySelectorAll('.tour').forEach(e => e.remove()); UI.tour = null; if (W) { W.tourDone = true; save(); } }

// ---------- match highlights: every goal again, on the pixel pitch
async function showHighlights(m) {
  const goals = m.log.filter(e => e.t === 'goal'); if (!goals.length) return;
  const S = m.sides;
  const el = document.createElement('div'); el.className = 'mini hl';
  el.innerHTML = `<div class="mhead"><button class="mback">◀ Back</button><span class="mt">HIGHLIGHTS</span><span class="ms" id="hlscore"></span></div>
    <div class="mwrap"><canvas></canvas></div><div class="mhint" id="hlcap"></div>`;
  document.body.appendChild(el);
  let closed = false;
  el.querySelector('.mback').onclick = () => { closed = true; el.remove(); };
  const pitch = new Pitch(el.querySelector('canvas'), S[0].c, S[1].c, [S[0].form, S[1].form], true);
  let last = performance.now();
  const loop = now => { if (closed) return; const dt = Math.min(50, now - last); last = now; pitch.update(dt); pitch.draw(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const sc = [0, 0], cap = el.querySelector('#hlcap'), board = () => { el.querySelector('#hlscore').textContent = `${S[0].c.short} ${sc[0]}-${sc[1]} ${S[1].c.short}`; };
  board();
  for (const e of goals) {
    if (closed) return;
    cap.innerHTML = `<b>${e.m}'</b> ${esc(S[e.s].c.name)} on the attack...`;
    pitch.ball.x = 120; pitch.ball.y = 75; pitch.ball.t1 = pitch.ball.t0; pitch.carrier = null; pitch.poss = e.s;
    pitch.playMinute({poss: e.s, shot: null}, 1500); await wait(1500); if (closed) return;
    pitch.playMinute({poss: e.s, shot: 'goal', shotSide: e.s}, 750); await wait(1050); if (closed) return;
    sc[e.s]++; board(); SND.roar();
    pitch.banner('GOAL!', e.s === m.userSide ? '#3ddc5a' : '#ff4b55', 1500); pitch.celebrate(e.s, 1800);
    cap.innerHTML = `<b>${e.m}'</b> GOAL! ${esc(pname(P(e.pid)))}${e.kind === 'pen' ? ' (penalty)' : e.kind === 'fk' ? ' (free kick)' : ''} for ${esc(S[e.s].c.name)}`;
    await wait(2300);
  }
  if (closed) return;
  pitch.banner('FULL TIME', '#ffd23f', 3000);
  cap.innerHTML = `Full time: <b>${esc(S[0].c.short)} ${S[0].g}-${S[1].g} ${esc(S[1].c.short)}</b>${m.pens ? ` (${m.pens[0]}-${m.pens[1]} on penalties)` : ''}`;
  const btn = document.createElement('button'); btn.className = 'btn go'; btn.textContent = 'Done'; btn.onclick = () => { closed = true; el.remove(); };
  el.appendChild(btn);
}

// ---------- trophy lift: the lads on a podium, confetti and fireworks
const TROPHY = ['Y..YYYYYY..Y', 'YY.YwwYYY.YY', 'Y.YYwYYYYY.Y', 'Y..YYYYYY..Y', '.Y.YYYYYY.Y.', '..YYYYYYYY..', '...YYYYYY...', '....YYYY....', '.....YY.....', '.....YY.....', '....YYYY....', '...bbbbbb...', '...bbbbbb...'];
function trophyScene(cv, kit, title) {
  if (!cv) return;
  cv.width = 200; cv.height = 120;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const pals = [0, 1, 2, 3, 4, 5, 6].map(i => palette(kit, lookOf(i * 5 + 1)));
  const cup = spr(TROPHY, {Y: '#ffd23f', w: '#fff6c0', b: '#6a4320'});
  const crowd = []; for (let i = 0; i < 180; i++) crowd.push([ri(0, 199), ri(30, 70), pick(['#d8242c', '#ffffff', '#ffd23f', kit.shirt, kit.shirt, kit.shorts])]);
  const sc = {parts: [], fw: [], t: 0};
  let last = performance.now();
  const loop = now => {
    if (!document.body.contains(cv)) return;
    const dt = Math.min(50, now - last); last = now; sc.t += dt;
    if (R() < .04) sc.fw.push({x: ri(20, 180), y: ri(8, 40), t: 0, c: pick(CONFETTI)});
    if (R() < .5) burst(sc, ri(0, 199), -2, 1, CONFETTI, {sp: .03, up: -.02, g: .00004, life: 3000});
    stepParts(sc, dt);
    g.fillStyle = '#0a0d24'; g.fillRect(0, 0, 200, 120);
    sc.fw = sc.fw.filter(f => (f.t += dt) < 1200);
    sc.fw.forEach(f => { const r = f.t / 40, a = 1 - f.t / 1200; g.fillStyle = f.c; g.globalAlpha = a; for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283; g.fillRect(Math.round(f.x + Math.cos(an) * r), Math.round(f.y + Math.sin(an) * r), 1, 1); } g.globalAlpha = 1; });
    g.fillStyle = '#1d2138'; g.fillRect(0, 28, 200, 46);
    crowd.forEach(([x, y, c], i) => { g.fillStyle = c; g.fillRect(x, y - ((Math.floor(sc.t / 140) + i) % 3 === 0 ? 1 : 0), 1, 2); });
    g.fillStyle = '#2f9a3a'; g.fillRect(0, 74, 200, 46);
    g.fillStyle = '#3b2a5a'; g.fillRect(30, 96, 140, 24); g.fillStyle = '#5a4a8a'; g.fillRect(30, 96, 140, 2);
    for (let i = 0; i < 7; i++) {
      if (i === 3) continue;
      const x = 42 + i * 20, j = (Math.floor(sc.t / 180) + i) % 2 ? -3 : 0;
      blit(g, spr(MAPS.front, pals[i]), x, 98 + j, 2);
    }
    // the captain lifts the trophy
    const lift = Math.round((Math.sin(sc.t / 300) + 1) * 3);
    blit(g, spr(MAPS.front, pals[3]), 102, 98, 2);
    g.fillStyle = pals[3].k; g.fillRect(93, 66 - lift, 2, 10 + lift); g.fillRect(109, 66 - lift, 2, 10 + lift);
    blit(g, cup, 102, 68 - lift, 2);
    if (Math.floor(sc.t / 200) % 3 === 0) { g.fillStyle = '#ffffff'; g.fillRect(96, 44 - lift, 1, 1); g.fillRect(110, 50 - lift, 1, 1); }
    drawParts(g, sc);
    outlineText(g, title, 100, 14, Math.floor(sc.t / 300) % 2 ? '#ffd23f' : '#ffffff', 12);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---------- loans
const loanFee = p => Math.max(2000, Math.round(valueOf(p) * .08 / 1000) * 1000);
const loansIn = () => me().squad.map(P).filter(p => p && p.loanFrom != null).length;
function canLoanIn(p) {
  if (!p || p.club < 0 || p.club === W.clubId || p.loanFrom != null) return false;
  const c = C(p.club), rank = c.squad.map(P).sort((a, b) => ovrOf(b) - ovrOf(a)).findIndex(q => q.id === p.id);
  return c.div <= me().div && c.div >= me().div - 1 && rank >= 3 && c.squad.length > 16;
}
function loanInPlayer(p) {
  const c = me(), fee = loanFee(p);
  if (loansIn() >= 3) return toast('You can only have three players on loan at once.');
  if (c.squad.length >= 26) return toast('Your squad is full.');
  if (c.cash < fee) return toast("You can't afford the loan fee.");
  const from = C(p.club);
  from.squad = from.squad.filter(x => x !== p.id); if (from.xi) from.xi = from.xi.map(x => x === p.id ? null : x); if (from.bench) from.bench = from.bench.filter(x => x !== p.id);
  c.squad.push(p.id); p.club = c.id; p.loanFrom = from.id; p.listed = false; c.cash -= fee; from.cash += fee;
  news(`${pname(p).toUpperCase()} JOINS ${c.name.toUpperCase()} ON LOAN FROM ${from.short}`);
  toast(`<b>${esc(pname(p))}</b> joins on loan until the end of the season.`);
}
function loanOutPlayer(p) {
  const c = me();
  if (c.squad.length <= 15) return toast('You need more than 15 players to send one out on loan.');
  const to = W.clubs.filter(x => x.id !== c.id && x.div >= c.div && x.squad.length < 24).sort((a, b) => b.div - a.div || a.squad.length - b.squad.length)[0];
  if (!to) return toast('Nobody can take him right now.');
  c.squad = c.squad.filter(x => x !== p.id); c.xi = c.xi.map(x => x === p.id ? null : x); c.bench = c.bench.filter(x => x !== p.id);
  to.squad.push(p.id); p.club = to.id; p.loanFrom = c.id; p.listed = false;
  fixTeam(c);
  news(`${pname(p).toUpperCase()} JOINS ${to.name.toUpperCase()} ON LOAN`);
  toast(`<b>${esc(pname(p))}</b> goes to ${esc(to.name)} on loan. Regular football will help him grow.`);
}
