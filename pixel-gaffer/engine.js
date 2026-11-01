// Pixel Gaffer '96: match engine, season, transfers and the weekly cycle.
'use strict';
let W = null;   // the saved world
const P = id => W.players[id];
const C = id => W.clubs[id];
const me = () => W.clubs[W.clubId];
const CUP_WEEKS = [3, 7, 11, 15, 19, 24];
const SEASON_WEEKS = 28;
const TV = [90000, 35000, 12000, 5000];
const PRIZE = [250000, 90000, 35000, 12000];
const BASE_TICKET = [18, 12, 9, 7];
const CUP_PRIZE = [10000, 25000, 50000, 100000, 250000, 500000];

// ---------- fixtures
function roundRobin(ids) {
  const n = ids.length, t = ids.slice(), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const rnd = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; rnd.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(rnd);
    t.splice(1, 0, t.pop());
  }
  return rounds.concat(rounds.map(rd => rd.map(([a, b]) => [b, a])));
}
function calendar() {
  const cal = []; let l = 0, c = 0;
  for (let w = 0; w < SEASON_WEEKS; w++) cal.push(CUP_WEEKS.includes(w) ? {t: 'C', r: c++} : {t: 'L', r: l++});
  return cal;
}
function startSeason() {
  W.cal = calendar();
  W.fix = [0, 1, 2, 3].map(d => roundRobin(shuffle(W.clubs.filter(c => c.div === d).map(c => c.id))));
  W.res = [];
  W.week = 0;
  // cup: the 16 strongest get a bye to round two
  const order = W.clubs.slice().sort((a, b) => a.div - b.div || b.rep - a.rep).map(c => c.id);
  W.cup = {r: 0, byes: order.slice(0, 16), alive: order.slice(16), ties: [], log: [], winner: null};
  W.cup.ties = drawTies(W.cup.alive);
  W.clubs.forEach(c => { c.formStr = ''; });
  Object.values(W.players).forEach(p => { p.s = {ap: 0, gl: 0, as: 0, rt: 0}; p.yc = 0; });
  setTarget();
}
function drawTies(ids) { const s = shuffle(ids.slice()), t = []; for (let i = 0; i < s.length; i += 2) t.push([s[i], s[i + 1]]); return t; }

// ---------- tables
function table(div) {
  const rows = {};
  W.clubs.filter(c => c.div === div).forEach(c => rows[c.id] = {id: c.id, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0, form: ''});
  W.res.filter(r => r.d === div).forEach(r => {
    const h = rows[r.h], a = rows[r.a]; if (!h || !a) return;
    h.p++; a.p++; h.f += r.hg; h.a += r.ag; a.f += r.ag; a.a += r.hg;
    if (r.hg > r.ag) { h.w++; a.l++; h.pts += 3; h.form += 'W'; a.form += 'L'; }
    else if (r.hg < r.ag) { a.w++; h.l++; a.pts += 3; h.form += 'L'; a.form += 'W'; }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form += 'D'; a.form += 'D'; }
  });
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.f - y.a) - (x.f - x.a) || y.f - x.f || C(x.id).name.localeCompare(C(y.id).name));
}
const posIn = id => table(C(id).div).findIndex(r => r.id === id) + 1;

// ---------- picking teams
function cond(p) { return p.inj || p.sus ? 0 : 1; }
function slotScore(p, pos) {
  const fitPen = p.pos === pos ? 1 : (p.pos === 'GK' || pos === 'GK') ? .2 : .8;
  return ovrOf(p, pos) * fitPen * (.6 + .4 * p.fit / 100) * (1 + p.form * .02);
}
function autoPick(club) {
  const slots = formSlots(club.formation);
  const avail = club.squad.map(P).filter(p => p && !p.inj && !p.sus);
  const xi = Array(11).fill(null), used = new Set();
  const order = [0].concat([...Array(10).keys()].map(i => i + 1).sort((a, b) => 'FWDFMF'.indexOf(slots[a]) - 'FWDFMF'.indexOf(slots[b])));
  order.forEach(i => {
    let best = null, bs = -1;
    avail.forEach(p => { if (used.has(p.id)) return; const s = slotScore(p, slots[i]); if (s > bs) { bs = s; best = p; } });
    if (best) { xi[i] = best.id; used.add(best.id); }
  });
  const rest = avail.filter(p => !used.has(p.id)).sort((a, b) => ovrOf(b) - ovrOf(a));
  const bench = [];
  const gk = rest.find(p => p.pos === 'GK'); if (gk) bench.push(gk.id);
  ['DF', 'MF', 'FW'].forEach(pos => { const p = rest.find(q => q.pos === pos && !bench.includes(q.id)); if (p) bench.push(p.id); });
  rest.forEach(p => { if (bench.length < 5 && !bench.includes(p.id)) bench.push(p.id); });
  club.xi = xi; club.bench = bench.slice(0, 5);
}
// Make sure a picked team is still valid (injuries etc.); returns names of players swapped out.
function fixTeam(club) {
  if (!club.xi || club.xi.length !== 11) { autoPick(club); return []; }
  const out = [];
  const bad = id => id == null || !P(id) || P(id).club !== club.id || P(id).inj || P(id).sus;
  club.bench = (club.bench || []).filter(id => !bad(id) && !club.xi.includes(id));
  if (club.xi.some(bad)) {
    const slots = formSlots(club.formation);
    club.xi.forEach((id, i) => {
      if (!bad(id)) return;
      if (id != null && P(id)) out.push(pname(P(id)));
      const pool = club.squad.map(P).filter(p => !bad(p.id) && !club.xi.includes(p.id));
      pool.sort((a, b) => slotScore(b, slots[i]) - slotScore(a, slots[i]));
      club.xi[i] = pool[0] ? pool[0].id : null;
      club.bench = club.bench.filter(b => b !== club.xi[i]);
    });
  }
  const pool = club.squad.filter(id => !bad(id) && !club.xi.includes(id) && !club.bench.includes(id)).map(P).sort((a, b) => ovrOf(b) - ovrOf(a));
  while (club.bench.length < 5 && pool.length) club.bench.push(pool.shift().id);
  return out;
}

// ---------- the match engine
const TALK = {
  goal: ['GOAL! {p} smashes it home!', 'GOAL! {p} slots it past the keeper!', 'GOAL! A header from {p}!', 'GOAL! {p} curls one into the top corner!', 'GOAL! {p} pokes it in from close range!', 'GOAL! What a strike from {p}!'],
  save: ['Great save by {k}!', '{k} gets down well to save.', '{k} tips it round the post!', 'Straight at {k}.'],
  miss: ['{p} drags it wide.', '{p} blazes it over the bar!', 'Wide from {p}.', '{p} skies it into the stand!'],
  post: ['OFF THE POST! {p} so close!', '{p} rattles the crossbar!'],
  build: ['{p} picks out {q}.', '{p} knocks it about.', '{p} sprays it wide to {q}.', '{p} wins the ball back.', 'Nice touch from {p}.', '{p} looks for {q}...', '{p} goes on a run!'],
};
const say = (t, o) => pick(TALK[t]).replace('{p}', o.p || '').replace('{q}', o.q || '').replace('{k}', o.k || '');

class Match {
  constructor(hId, aId, opts) {
    opts = opts || {};
    this.cup = !!opts.cup; this.neutral = !!opts.neutral; this.live = !!opts.live; this.userSide = opts.userSide ?? -1;
    this.minute = 0; this.end = 90; this.done = false; this.log = []; this.pending = null; this.pens = null; this.half = 0;
    this.sides = [hId, aId].map(id => {
      const c = C(id); fixTeam(c);
      return {id, c, on: c.xi.slice(), bench: c.bench.slice(), subsLeft: 3, style: c.style, form: c.formation, g: 0, sh: 0, sot: 0, poss: 0, rc: 0,
        yc: {}, rt: {}, gl: {}, as: {}, fit: {}, played: new Set(c.xi.filter(x => x != null))};
    });
    this.sides.forEach(s => s.on.forEach(id => { if (id != null) { s.rt[id] = 6; s.fit[id] = P(id).fit; } }));
  }
  slots(s) { return formSlots(s.form); }
  // player strength in a slot, with fitness, form and morale
  eff(s, id, pos) {
    const p = P(id); if (!p) return null;
    const fp = p.pos === pos ? 1 : (p.pos === 'GK' || pos === 'GK') ? .3 : .78;
    const f = s.fit[id] ?? p.fit;
    return fp * (.55 + .45 * f / 100) * (1 + p.form * .03) * (.9 + .2 * p.mor / 100);
  }
  power(i) {
    const s = this.sides[i], o = this.sides[1 - i], slots = this.slots(s), st = STYLES[s.style];
    let def = 0, mid = 0, att = 0, gk = 3, n = 0, maestro = 1, wall = 1;
    s.on.forEach((id, k) => {
      if (id == null) return; const p = P(id), m = this.eff(s, id, slots[k]), a = p.a; n++;
      if (p.tr === 'maestro') maestro = 1.05; if (p.tr === 'wall') wall = 1.05;
      switch (slots[k]) {
        case 'GK': gk = a.gk * m; def += a.gk * 1.6 * m; break;
        case 'DF': def += (a.tkl * .65 + a.pac * .35) * m; mid += a.pas * .2 * m; att += a.sho * .05 * m; break;
        case 'MF': def += a.tkl * .25 * m; mid += (a.pas * .55 + a.tkl * .2 + a.pac * .25) * m; att += a.sho * .3 * m; break;
        case 'FW': mid += a.pas * .25 * m; att += (a.sho * .65 + a.pac * .35) * m; break;
      }
    });
    const edge = BEATS[s.style].includes(o.style) ? 1.06 : 1;
    const home = (!this.neutral && i === 0) ? 1.08 : 1;
    return {def: def * st.def * wall, mid: mid * st.mid * edge * home * maestro, att: att * st.att * edge * home, gk, n};
  }
  pickShooter(s) {
    const slots = this.slots(s);
    const cand = s.on.map((id, k) => ({id, pos: slots[k]})).filter(x => x.id != null && x.pos !== 'GK');
    return wpick(cand, x => { const p = P(x.id); return p.a.sho * ({FW: 3.2, MF: 1.2, DF: .3}[x.pos]) * (p.tr === 'poacher' ? 1.8 : 1); }).id;
  }
  pickOther(s, not) {
    const cand = s.on.filter(id => id != null && id !== not && P(id).pos !== 'GK');
    return cand.length ? wpick(cand, id => P(id).a.pas) : null;
  }
  keeper(s) { const slots = this.slots(s); return s.on.find((id, k) => id != null && slots[k] === 'GK') ?? s.on.find(id => id != null); }
  bestTaker(s) { return s.on.filter(id => id != null).map(P).sort((a, b) => (b.a.sho + (b.tr === 'deadball' ? 6 : 0)) - (a.a.sho + (a.tr === 'deadball' ? 6 : 0)))[0].id; }
  ev(e) { e.m = this.minute; this.log.push(e); return e; }
  // One minute of football. Returns the events of that minute.
  step() {
    if (this.done || this.pending) return [];
    const out = [];
    this.minute++;
    const S = this.sides, pw = [this.power(0), this.power(1)];
    const m3 = pw.map(x => Math.pow(Math.max(1, x.mid), 1.7)), pHome = m3[0] / (m3[0] + m3[1]);
    const at = R() < pHome ? 0 : 1, df = 1 - at, A = S[at], D = S[df];
    A.poss++;
    this.ball = at;
    const tempo = (STYLES[A.style].tempo + STYLES[D.style].tempo) / 2;
    // tiredness
    S.forEach(s => s.on.forEach(id => { if (id == null) return; const p = P(id); s.fit[id] = Math.max(5, s.fit[id] - .2 * STYLES[s.style].fat * (p.tr === 'engine' ? .5 : 1) * (.7 + R() * .6) * (p.age > 31 ? 1.2 : 1)); }));
    if (R() < .5 * tempo) {
      const r = pw[at].att / (pw[at].att + pw[df].def * .52);
      if (R() < clamp(.36 + (r - .5) * .9, .1, .7)) {
        const x = R();
        if (x < .028) out.push(this.setPiece(at, 'pen'));
        else if (x < .075) out.push(this.setPiece(at, 'fk'));
        else out.push(this.shot(at, r));
      } else if (R() < .25) {
        const p = this.pickOther(A), q = this.pickOther(A, p);
        if (p && q) out.push(this.ev({t: 'build', s: at, pid: p, txt: say('build', {p: pname(P(p)), q: pname(P(q))})}));
      }
    }
    // cards and knocks
    S.forEach((s, i) => {
      const hot = s.on.some(id => id != null && P(id).tr === 'hothead') ? 1.6 : 1;
      if (R() < .019 * hot * (s.style === 'press' ? 1.3 : 1)) {
        const id = wpick(s.on.filter(x => x != null), x => (P(x).tr === 'hothead' ? 3 : 1) * (P(x).pos === 'DF' ? 1.6 : P(x).pos === 'GK' ? .2 : 1));
        s.yc[id] = (s.yc[id] || 0) + 1; s.rt[id] -= .3;
        if (s.yc[id] >= 2) out.push(this.sendOff(i, id, true));
        else out.push(this.ev({t: 'yc', s: i, pid: id, txt: `${pname(P(id))} goes into the book.`}));
      } else if (R() < .0007 * hot) out.push(this.sendOff(i, wpick(s.on.filter(x => x != null), x => P(x).pos === 'GK' ? .1 : 1), false));
      if (R() < .0013) {
        const id = wpick(s.on.filter(x => x != null), x => (P(x).tr === 'glass' ? 3 : 1) * (1.5 - s.fit[x] / 100));
        if (id != null) {
          s.injured = s.injured || {}; s.injured[id] = pick([1, 1, 1, 2, 2, 3, 4, 6]);
          out.push(this.ev({t: 'inj', s: i, pid: id, txt: `${pname(P(id))} is down injured...`}));
          if (!this.live || i !== this.userSide || W.settings.autoSubs !== false) this.autoSub(i, id, true, out);
        }
      }
    });
    // computer manager subs
    S.forEach((s, i) => { if (i !== this.userSide && this.minute >= 58 && s.subsLeft > 0 && R() < .12) this.aiSub(i, out); });
    if (this.minute === 45 && !this.half) { this.half = 1; out.push(this.ev({t: 'ht', txt: `HALF TIME: ${S[0].c.short} ${S[0].g}-${S[1].g} ${S[1].c.short}`})); }
    if (this.minute >= this.end && !this.pending) this.finishTime(out);
    return out;
  }
  finishTime(out) {
    const S = this.sides;
    if (this.cup && S[0].g === S[1].g && this.end === 90) { this.end = 120; out.push(this.ev({t: 'et', txt: 'Level after 90 minutes. EXTRA TIME!'})); return; }
    if (this.cup && S[0].g === S[1].g) {
      if (this.live && this.userSide >= 0 && W.settings.mini) { this.pending = {type: 'shootout'}; out.push(this.ev({t: 'shootout', txt: 'It goes to PENALTIES!'})); return; }
      this.pens = this.autoShootout();
      out.push(this.ev({t: 'pens', txt: `Penalties: ${S[0].c.short} ${this.pens[0]}-${this.pens[1]} ${S[1].c.short}`}));
    }
    this.done = true;
    out.push(this.ev({t: 'ft', txt: `FULL TIME: ${S[0].c.short} ${S[0].g}-${S[1].g} ${S[1].c.short}`}));
  }
  autoShootout() {
    const sc = [0, 0], takers = this.sides.map(s => s.on.filter(id => id != null).map(P).sort((a, b) => b.a.sho - a.a.sho));
    for (let k = 0; k < 30; k++) {
      for (let i = 0; i < 2; i++) {
        const t = takers[i][k % takers[i].length], gk = P(this.keeper(this.sides[1 - i]));
        if (R() < penChance(t, gk)) sc[i]++;
      }
      if (k >= 4 && sc[0] !== sc[1]) break;
    }
    if (sc[0] === sc[1]) sc[R() < .5 ? 0 : 1]++;
    return sc;
  }
  sendOff(i, id, second) {
    const s = this.sides[i]; s.on[s.on.indexOf(id)] = null; s.rc++; s.rt[id] -= 1.5;
    s.reds = s.reds || {}; s.reds[id] = second ? 1 : ri(2, 3);
    // a sent-off keeper gets replaced by an outfield player (or a sub)
    return this.ev({t: 'rc', s: i, pid: id, txt: second ? `Second yellow! ${pname(P(id))} is OFF!` : `RED CARD! ${pname(P(id))} is sent off!`});
  }
  shot(at, r, forced) {
    const A = this.sides[at], D = this.sides[1 - at], sh = forced || this.pickShooter(A), p = P(sh);
    const gkId = this.keeper(D), gk = gkId != null ? P(gkId) : null;
    const gkv = gk ? gk.a.gk * this.eff(D, gkId, 'GK') : 2;
    const shv = p.a.sho * this.eff(A, sh, p.pos === 'GK' ? 'GK' : 'FW');
    A.sh++;
    const onT = clamp(.38 + (shv - 10) * .015 + (r - .5) * .3, .15, .7);
    if (R() < onT) {
      A.sot++;
      const gp = clamp(.3 + (shv - gkv) * .018 + (r - .5) * .35 + (p.tr === 'poacher' ? .05 : 0) + (gk && gk.tr === 'cat' ? -.04 : 0), .08, .8);
      if (R() < gp) return this.goal(at, sh, this.pickOther(A, sh), say('goal', {p: pname(p)}));
      if (gkId != null) D.rt[gkId] += .25;
      return this.ev({t: 'save', s: at, pid: sh, gk: gkId, txt: say('save', {k: gk ? pname(gk) : 'the defender'})});
    }
    if (R() < .08) return this.ev({t: 'post', s: at, pid: sh, txt: say('post', {p: pname(p)})});
    return this.ev({t: 'miss', s: at, pid: sh, txt: say('miss', {p: pname(p)})});
  }
  goal(at, sh, ast, txt, kind) {
    const A = this.sides[at], D = this.sides[1 - at];
    A.g++; A.gl[sh] = (A.gl[sh] || 0) + 1; A.rt[sh] += 1;
    if (ast != null && R() < .7) { A.as[ast] = (A.as[ast] || 0) + 1; A.rt[ast] += .5; } else ast = null;
    D.on.forEach(id => { if (id != null && P(id).pos !== 'FW' && P(id).pos !== 'MF') D.rt[id] -= .25; });
    return this.ev({t: 'goal', s: at, pid: sh, ast, kind, txt: txt + (A.g + D.g > 0 ? ` (${this.sides[0].g}-${this.sides[1].g})` : '')});
  }
  setPiece(at, type) {
    const A = this.sides[at], D = this.sides[1 - at], taker = this.bestTaker(A), gkId = this.keeper(D);
    const pre = this.ev({t: type, s: at, pid: taker, txt: type === 'pen' ? `PENALTY to ${A.c.short}! ${pname(P(taker))} steps up...` : `Free kick on the edge of the box for ${A.c.short}. ${pname(P(taker))} lines it up...`});
    if (this.live && W.settings.mini && (at === this.userSide || (type === 'pen' && 1 - at === this.userSide))) {
      this.pending = {type: type === 'pen' ? (at === this.userSide ? 'pen-shoot' : 'pen-save') : 'fk', at, taker, gk: gkId};
      return pre;
    }
    const gk = gkId != null ? P(gkId) : null;
    A.sh++;
    const ok = type === 'pen' ? R() < penChance(P(taker), gk) : R() < clamp(.07 + (P(taker).a.sho - 10) * .008 + (P(taker).tr === 'deadball' ? .1 : 0), .03, .25);
    this.resolve(ok, true);
    return pre;
  }
  // a set piece outcome (from the mini-game or the dice)
  resolve(goal, quiet) {
    const pd = this.pending || {type: 'auto'};
    const lastSp = this.log.slice().reverse().find(e => e.t === 'pen' || e.t === 'fk');
    const at = pd.at ?? lastSp.s, A = this.sides[at], D = this.sides[1 - at], taker = pd.taker ?? lastSp.pid, kind = lastSp ? lastSp.t : 'pen';
    this.pending = null;
    if (!quiet) A.sh++;
    let e;
    if (goal) { A.sot++; e = this.goal(at, taker, null, kind === 'pen' ? `GOAL! ${pname(P(taker))} buries the penalty!` : `GOAL! ${pname(P(taker))} curls it over the wall!`, kind); }
    else e = this.ev({t: kind === 'pen' ? 'save' : 'miss', s: at, pid: taker, txt: kind === 'pen' ? `SAVED! The penalty is kept out!` : `The free kick comes to nothing.`});
    if (this.minute >= this.end && !this.done) { const out = []; this.finishTime(out); }
    return e;
  }
  resolveShootout(sc) {
    this.pending = null; this.pens = sc; this.done = true;
    this.ev({t: 'pens', txt: `Penalties: ${this.sides[0].c.short} ${sc[0]}-${sc[1]} ${this.sides[1].c.short}`});
    this.ev({t: 'ft', txt: 'FULL TIME'});
  }
  autoSub(i, outId, injured, out) {
    const s = this.sides[i], k = s.on.indexOf(outId); if (k < 0) return false;
    if (s.subsLeft <= 0) { if (injured) { s.on[k] = null; out && out.push(this.ev({t: 'info', s: i, txt: `${s.c.short} are down to ${s.on.filter(x => x != null).length} men.`})); } return false; }
    const pos = this.slots(s)[k];
    const cand = s.bench.map(P).filter(Boolean).sort((a, b) => slotScore(b, pos) - slotScore(a, pos));
    if (!cand.length) { if (injured) s.on[k] = null; return false; }
    return this.sub(i, outId, cand[0].id, out);
  }
  sub(i, outId, inId, out) {
    const s = this.sides[i], k = s.on.indexOf(outId); if (k < 0 || s.subsLeft <= 0) return false;
    s.on[k] = inId; s.bench = s.bench.filter(x => x !== inId); s.subsLeft--; s.played.add(inId);
    s.rt[inId] = 6; s.fit[inId] = P(inId).fit; s.subbed = s.subbed || []; s.subbed.push(outId);
    const e = this.ev({t: 'sub', s: i, pid: inId, pid2: outId, txt: `SUB ${s.c.short}: ${pname(P(inId))} on for ${pname(P(outId))}`});
    out && out.push(e);
    return true;
  }
  aiSub(i, out) {
    const s = this.sides[i];
    const tired = s.on.filter(id => id != null && P(id).pos !== 'GK').sort((a, b) => s.fit[a] - s.fit[b])[0];
    if (tired != null && s.fit[tired] < 78) this.autoSub(i, tired, false, out);
    // chasing the game late on: go for it
    const me = s.g, them = this.sides[1 - i].g;
    if (this.minute > 70 && me < them && s.style !== 'attack' && R() < .3) s.style = 'attack';
    if (this.minute > 80 && me > them && R() < .2) s.style = 'bus';
  }
  sim() { let guard = 0; while (!this.done && guard++ < 300) { this.step(); if (this.pending) { if (this.pending.type === 'shootout') { this.resolveShootout(this.autoShootout()); } else { const pd = this.pending; this.resolve(pd.type === 'fk' ? R() < .12 : R() < penChance(P(pd.taker), pd.gk != null ? P(pd.gk) : null)); } } } return this; }
  winner() { const S = this.sides; if (S[0].g !== S[1].g) return S[0].g > S[1].g ? 0 : 1; if (this.pens) return this.pens[0] > this.pens[1] ? 0 : 1; return -1; }
}
function penChance(t, gk) { return clamp(.72 + (t.a.sho - 10) * .012 + (t.tr === 'deadball' ? .08 : 0) - (gk ? (gk.a.gk - 10) * .01 + (gk.tr === 'cat' ? .08 : 0) : -.2), .45, .95); }

// After the final whistle: stats, fitness, cards, morale.
function applyMatch(m, info) {
  const r = {h: m.sides[0].id, a: m.sides[1].id, hg: m.sides[0].g, ag: m.sides[1].g, pens: m.pens, sc: m.log.filter(e => e.t === 'goal').map(e => [e.m, e.s, e.pid, e.kind === 'pen' ? 1 : 0]), cup: !!info.cup, d: info.div, w: W.week};
  m.sides.forEach((s, i) => {
    const res = s.g > m.sides[1 - i].g ? 'W' : s.g < m.sides[1 - i].g ? 'L' : (m.pens ? (m.winner() === i ? 'W' : 'L') : 'D');
    s.c.formStr = ((s.c.formStr || '') + res).slice(-6);
    const conceded = m.sides[1 - i].g;
    s.played.forEach(id => {
      const p = P(id); if (!p) return;
      let rt = s.rt[id] + (res === 'W' ? .4 : res === 'L' ? -.4 : 0) + (R() - .5) * .8;
      if ((p.pos === 'DF' || p.pos === 'GK') && conceded === 0) rt += .6;
      if (p.pos === 'GK') rt -= conceded * .25;
      rt = clamp(Math.round(rt * 10) / 10, 3, 10);
      p.s.ap++; p.s.gl += s.gl[id] || 0; p.s.as += s.as[id] || 0; p.s.rt += rt; p.last = rt;
      p.form = clamp(p.form * .6 + (rt - 6.6) * 1.1, -3, 3);
      p.fit = Math.round(s.fit[id] ?? p.fit);
      if (s.yc[id] === 1) { p.yc++; if (p.yc >= 5) { p.yc = 0; p.sus = Math.max(p.sus, 1); p.susNew = 1; } }
    });
    Object.entries(s.reds || {}).forEach(([id, n]) => { P(id).sus = Math.max(P(id).sus, n); P(id).susNew = 1; });
    Object.entries(s.injured || {}).forEach(([id, n]) => { const p = P(id); p.inj = Math.max(p.inj, n * (p.tr === 'glass' ? 2 : 1)); p.injNew = 1; });
    s.c.squad.forEach(id => { const p = P(id); if (!p) return; p.mor = clamp(p.mor + (res === 'W' ? 6 : res === 'L' ? -6 : 0) + (s.played.has(id) ? 1 : -1) + (p.tr === 'leader' && res === 'L' ? 4 : 0), 5, 100); });
    s.c.squad.forEach(id => { const p = P(id); if (p && p.sus && !p.susNew) p.sus--; if (p) delete p.susNew; });
  });
  return r;
}

// ---------- the week
function weekFixtures() {
  const e = W.cal[W.week];
  if (e.t === 'L') return [0, 1, 2, 3].flatMap(d => W.fix[d][e.r].map(([h, a]) => ({h, a, d, cup: false})));
  return W.cup.ties.map(([h, a]) => ({h, a, d: -1, cup: true, neutral: W.cup.r === 5}));
}
function userFixture() { return weekFixtures().find(f => f.h === W.clubId || f.a === W.clubId) || null; }
function cupRoundName(r) { return CUP_ROUNDS[r ?? W.cup.r]; }

// Plays every other game of the week, then runs the club's week. Returns a report.
function finishWeek(userMatch) {
  const e = W.cal[W.week], report = {results: [], cup: e.t === 'C', msgs: []};
  const fx = weekFixtures();
  const played = new Set();
  fx.forEach(f => {
    let m;
    if (userMatch && (f.h === W.clubId || f.a === W.clubId)) m = userMatch;
    else { [f.h, f.a].forEach(id => { if (id !== W.clubId) autoPick(C(id)); }); m = new Match(f.h, f.a, {cup: f.cup, neutral: f.neutral}).sim(); }
    const r = applyMatch(m, {cup: f.cup, div: f.d});
    played.add(f.h); played.add(f.a);
    report.results.push(r);
    if (!f.cup) W.res.push(r);
    // money on the gate
    const home = C(f.h), away = C(f.a);
    const att = attendance(home, away, f.cup);
    r.att = att;
    const gate = att * home.ticket;
    if (f.cup) { home.cash += gate / 2; away.cash += gate / 2; } else home.cash += gate;
    if (f.h === W.clubId || f.a === W.clubId) { report.gate = f.cup ? gate / 2 : f.h === W.clubId ? gate : 0; report.user = r; }
    if (f.cup) { const wnr = m.winner() === 0 ? f.h : f.a; C(wnr).cash += CUP_PRIZE[W.cup.r]; r.win = wnr; }
  });
  // board and morale reaction to the user's game
  if (report.user) boardReact(report.user, e);
  // cup progress
  if (e.t === 'C') {
    W.cup.log.push(report.results.map(r => ({h: r.h, a: r.a, hg: r.hg, ag: r.ag, pens: r.pens, win: r.win})));
    const winners = report.results.map(r => r.win);
    if (W.cup.r === 5) { W.cup.winner = winners[0]; W.cup.r = 6; W.cup.ties = []; }
    else {
      W.cup.r++;
      W.cup.alive = (W.cup.r === 1 ? W.cup.byes : []).concat(winners);
      W.cup.ties = drawTies(W.cup.alive);
    }
  }
  weeklyClub(report, played);
  aiTransfers(report);
  W.week++;
  report.seasonOver = W.week >= SEASON_WEEKS;
  return report;
}
function attendance(home, away, cup) {
  const pos = home.div >= 0 && W.res.length ? posIn(home.id) : 6;
  const f = .42 + home.rep / 260 + (12 - pos) * .015 + (home.formStr || '').split('').filter(x => x === 'W').length * .02 + (cup ? .1 + W.cup.r * .05 : 0) + (away.rep - home.rep) / 400;
  const fanF = home.id === W.clubId ? .8 + (W.fans ?? 60) / 250 : 1;
  return Math.round(home.cap * clamp((f + (R() - .5) * .08) * Math.pow(BASE_TICKET[home.div] / home.ticket, .7) * fanF, .15, 1));
}

function boardReact(r, e) {
  const home = r.h === W.clubId, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg;
  const won = r.cup ? r.win === W.clubId : gf > ga, lost = r.cup ? r.win !== W.clubId : gf < ga;
  const b = W.board;
  b.conf = clamp(b.conf + (won ? 2.5 : lost ? -3 : 0) + (r.cup && won ? 1 : 0), 0, 100);
  W.fans = clamp((W.fans ?? 60) + (won ? 1.5 : lost ? -1.5 : 0), 0, 100);
  if (e.t === 'L' && W.week > 5) { const pos = posIn(W.clubId); b.conf = clamp(b.conf + clamp((b.target - pos) * .35, -2, 2), 0, 100); }
}

function weeklyClub(report, played) {
  const club = me(), t = W.training;
  // money
  W.clubs.forEach(c => {
    const wages = c.squad.reduce((s, id) => s + (P(id) ? P(id).wage : 0), 0);
    c.cash += TV[c.div] - wages;
    if (c.id === W.clubId) { report.wages = wages; report.tv = TV[c.div]; }
  });
  if (club.cash < 0) { W.board.conf = clamp(W.board.conf - 2.5, 0, 100); if (W.week % 4 === 0) inbox('The Board', 'We are in the red', `The club is ${money(club.cash)} overdrawn. Get the wage bill down or sell someone, or we'll have to talk about your future.`); }
  // recovery, injuries, training
  const intensity = t.int, focus = TRAINING[t.focus];
  const drill = W.drill || 0; W.drill = 0;
  Object.values(W.players).forEach(p => {
    if (p.club < 0) return;
    const mine = p.club === W.clubId;
    const rec = 24 + (mine ? (t.focus === 'fitness' ? 8 : t.focus === 'rest' ? 25 : 0) - (intensity === 2 ? 6 : intensity === 0 ? -6 : 0) : 0);
    p.fit = clamp(p.fit + rec, 0, 100);
    if (p.inj && !p.injNew) { p.inj--; if (!p.inj && mine) report.msgs.push(`${pname(p)} is back from injury.`); }
    delete p.injNew;
    if (mine) {
      if (t.focus === 'rest') p.mor = clamp(p.mor + 3, 5, 100);
      if (!p.inj && R() < .004 * [.4, 1, 2.2][intensity] * (p.tr === 'glass' ? 2 : 1)) { p.inj = ri(1, 4); report.msgs.push(`${pname(p)} was hurt in training (${p.inj} wk).`); }
      if (!focus.a.length || p.inj) return;
      const ageF = p.age <= 19 ? 1.25 : p.age <= 21 ? 1 : p.age <= 24 ? .65 : p.age <= 28 ? .3 : .12;
      p.xp += ageF * [.6, 1, 1.45][intensity] * (played.has(club.id) && p.s.ap ? 1.1 : 1) * (p.tr === 'wonder' ? 1.7 : 1) * (1 + drill);
      while (p.xp >= 4) {
        p.xp -= 4;
        if (ovrOf(p) < p.pot || R() < .15) {
          let k = pick(focus.a); if (p.pos === 'GK' && R() < .6) k = 'gk'; if (p.pos !== 'GK' && k === 'gk') k = 'tkl';
          p.a[k] = clamp(Math.round((p.a[k] + .5) * 10) / 10, 1, 20);
          p.grew = (p.grew || 0) + 1;
        }
      }
    }
  });
  // weekly morale drift for players not getting games
  club.squad.map(P).forEach(p => { if (!p.s.ap && W.week > 6 && ovrOf(p) > 11 && R() < .1) p.mor = clamp(p.mor - 4, 5, 100); });
  // value refresh
  if (W.week % 4 === 0) Object.values(W.players).forEach(p => { if (p.club >= 0) p.val = valueOf(p); });
}

// ---------- messages
function inbox(from, subj, body, act) { W.inbox.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), w: W.week, s: W.season, from, subj, body, act, read: false}); W.inbox = W.inbox.slice(0, 60); }
function news(txt) { W.news.unshift({s: W.season, w: W.week, txt}); W.news = W.news.slice(0, 40); }

// ---------- transfers
function askingPrice(p) {
  if (p.club < 0) return 0;
  const c = C(p.club), rank = c.squad.map(P).sort((a, b) => ovrOf(b) - ovrOf(a)).findIndex(q => q.id === p.id);
  return Math.round(valueOf(p) * (p.listed ? .8 : rank < 3 ? 1.6 : rank < 11 ? 1.2 : 1) * (p.con <= 1 ? .8 : 1) / 1000) * 1000;
}
function wageDemand(p, div) { return Math.round(wageFor(p, div) * (1.1 + Math.max(0, div - (p.club >= 0 ? C(p.club).div : 3)) * .25) / 10) * 10; }
function willingToJoin(p) {
  if (p.club < 0) return true;
  const from = C(p.club), to = me();
  return to.div <= from.div + 1 || p.age >= 31 || p.mor < 40;
}
// AI clubs buy and sell among themselves, and bid for your players
function aiTransfers(report) {
  const club = me();
  if (R() < .45) {
    const buyer = pick(W.clubs.filter(c => c.id !== W.clubId && c.squad.length < 22));
    const pos = pick(POS);
    const mine = buyer.squad.map(P).filter(p => p.pos === pos).sort((a, b) => ovrOf(a) - ovrOf(b));
    const target = Object.values(W.players).filter(p => p.pos === pos && p.club !== buyer.id && p.club !== W.clubId && p.loanFrom == null && (p.club < 0 || C(p.club).squad.length > 16) && ovrOf(p) > (mine[0] ? ovrOf(mine[0]) + 1 : 0) && ovrOf(p) < ovrOf(mine[mine.length - 1] || p) + 2).sort(() => R() - .5)[0];
    if (target) {
      const fee = askingPrice(target);
      if (buyer.cash > fee * 1.5) {
        const from = target.club >= 0 ? C(target.club) : null;
        moveP(target, buyer, fee);
        news(`${pname(target).toUpperCase()} JOINS ${buyer.name.toUpperCase()} ${from ? `FROM ${from.short} FOR ${money(fee)}` : 'ON A FREE'}`);
      }
    }
  }
  // bids for the user's players
  const listed = club.squad.map(P).filter(p => p.listed);
  const chance = .08 + listed.length * .1 + club.squad.map(P).filter(p => p.s.ap > 3 && p.s.rt / p.s.ap > 7.2).length * .03;
  if (R() < chance && club.squad.length > 15) {
    const p = listed.length && R() < .7 ? pick(listed) : wpick(club.squad.map(P).filter(q => q.loanFrom == null), q => Math.pow(ovrOf(q), 2) * (q.s.ap ? q.s.rt / q.s.ap - 5.5 : .5));
    const bidders = W.clubs.filter(c => c.id !== W.clubId && c.cash > valueOf(p) * .9 && c.div <= club.div + 1);
    if (p && bidders.length) {
      const b = pick(bidders), amt = Math.round(valueOf(p) * (p.listed ? .75 + R() * .35 : .9 + R() * .45) / 1000) * 1000;
      inbox(b.name, `Bid for ${pname(p)}`, `${b.name} have offered ${money(amt)} for ${p.fn} ${p.ln} (${POS_NAME[p.pos]}, ${ovr(p)}). Valued at ${money(valueOf(p))}.`, {type: 'bid', pid: p.id, club: b.id, amt, w: W.week});
    }
  }
}
function moveP(p, to, fee) {
  if (p.club >= 0) { const from = C(p.club); from.squad = from.squad.filter(x => x !== p.id); from.cash += fee; if (from.xi) from.xi = from.xi.map(x => x === p.id ? null : x); if (from.bench) from.bench = from.bench.filter(x => x !== p.id); }
  to.cash -= fee; to.squad.push(p.id); p.club = to.id; p.listed = false; p.con = ri(2, 4); p.wage = wageDemand(p, to.div); p.mor = clamp(p.mor + 10, 5, 100);
  if (to.xi) fixTeam(to);
}
function releaseCost(p) { return Math.round(p.wage * 10 * Math.max(1, p.con) / 100) * 100; }

// ---------- board
function squadStrength(c) { const t = c.squad.map(P).map(p => ovrOf(p)).sort((a, b) => b - a).slice(0, 14); return t.reduce((s, x) => s + x, 0) / Math.max(1, t.length); }
function setTarget() {
  const c = me(), rivals = W.clubs.filter(x => x.div === c.div).sort((a, b) => squadStrength(b) - squadStrength(a));
  const k = rivals.findIndex(x => x.id === c.id) + 1;
  let target, txt;
  if (c.div === 0) { if (k <= 2) { target = 1; txt = 'Win the league'; } else if (k <= 6) { target = 5; txt = 'A top-five finish'; } else { target = 10; txt = 'Stay up'; } }
  else if (k <= 3) { target = 2; txt = 'Win promotion'; } else if (k <= 7) { target = 6; txt = 'Top half'; } else { target = 10; txt = c.div === 3 ? 'Avoid finishing bottom' : 'Avoid relegation'; }
  W.board = Object.assign(W.board || {conf: 60}, {target, txt, rank: k});
}

// ---------- end of season
function endSeason() {
  NEXT_ID = W.nextId;
  const S = {season: W.season, tables: [], promoted: [], relegated: [], awards: [], user: {}};
  const tabs = [0, 1, 2, 3].map(table);
  S.tables = tabs.map(t => t.map(r => ({id: r.id, pts: r.pts, gd: r.f - r.a})));
  const champs = tabs.map(t => t[0].id);
  tabs.forEach((t, d) => {
    t.forEach((r, i) => { C(r.id).cash += (12 - i) * PRIZE[d]; });
    if (d > 0) t.slice(0, 2).forEach(r => S.promoted.push([r.id, d]));
    if (d < 3) t.slice(-2).forEach(r => S.relegated.push([r.id, d]));
  });
  // awards
  tabs.forEach((t, d) => {
    const ps = Object.values(W.players).filter(p => p.club >= 0 && C(p.club).div === d);
    const top = ps.sort((a, b) => b.s.gl - a.s.gl)[0];
    S.awards.push({d, champ: t[0].id, scorer: top ? [top.id, top.s.gl, top.club] : null});
  });
  // the user's season
  const c = me(), pos = tabs[c.div].findIndex(r => r.id === c.id) + 1, pts = tabs[c.div][pos - 1].pts;
  const cupRound = W.cup.winner === c.id ? 6 : W.cup.log.findIndex(rd => rd.some(t => (t.h === c.id || t.a === c.id) && t.win !== c.id));
  const tro = [];
  if (pos === 1) tro.push(`${DIVS[c.div]} champions`);
  else if (pos <= 2 && c.div > 0) tro.push(`Promoted from ${DIVS[c.div]}`);
  if (W.cup.winner === c.id) tro.push(`${CUP_NAME} winners`);
  let career = pts + (4 - c.div) * 10 + (pos === 1 ? 100 : 0) + (pos <= 2 && c.div > 0 ? 60 : 0) + (W.cup.winner === c.id ? 80 : 0) + (cupRound >= 4 ? 15 : 0);
  if (pos > 10 && c.div < 3) career = Math.max(0, career - 30);
  W.career.pts += career; W.career.seasons++;
  tro.forEach(t => W.career.trophies.push(`${t} ${START_YEAR + W.season}/${String(START_YEAR + W.season + 1).slice(2)}`));
  const best = c.squad.map(P).filter(p => p.s.ap >= 5).sort((a, b) => b.s.rt / b.s.ap - a.s.rt / a.s.ap)[0];
  const topS = c.squad.map(P).sort((a, b) => b.s.gl - a.s.gl)[0];
  // board verdict
  let verdict, sacked = false;
  const diff = W.board.target - pos;
  if (pos === 1 || (c.div > 0 && pos <= 2) || diff >= 0) { verdict = diff >= 3 || pos === 1 || (pos <= 2 && W.board.target > 2) ? 'Outstanding. The board are delighted.' : 'Target met. Well done, gaffer.'; W.board.conf = clamp(W.board.conf + 15 + diff * 3, 0, 100); }
  else if (diff >= -3) { verdict = 'Short of the target, but the board are patient.'; W.board.conf = clamp(W.board.conf - 12, 0, 100); }
  else { verdict = 'A poor season. The board are not happy.'; W.board.conf = clamp(W.board.conf - 22, 0, 100); }
  if (W.board.conf < 10) { sacked = true; verdict = 'The board have lost patience.'; }
  S.user = {club: c.id, div: c.div, pos, pts, cupRound, trophies: tro, careerAdd: career, best: best && best.id, top: topS && topS.s.gl ? [topS.id, topS.s.gl] : null, verdict, sacked};
  W.history.push({s: W.season, club: c.id, div: c.div, pos, pts, cup: cupRound, tro});
  // move clubs between divisions
  S.promoted.forEach(([id, d]) => { C(id).div = d - 1; });
  S.relegated.forEach(([id, d]) => { C(id).div = d + 1; });
  const oldDiv = {}; S.promoted.concat(S.relegated).forEach(([id]) => oldDiv[id] = 1);
  W.clubs.forEach(cl => { cl.rep = clamp(Math.round(cl.rep * .8 + (95 - cl.div * 20) * .2), 5, 99); if (oldDiv[cl.id] || cl.id !== W.clubId) cl.ticket = BASE_TICKET[cl.div]; });
  returnLoans();
  // players age, grow and retire
  const retired = [], expired = [], youth = [];
  Object.values(W.players).forEach(p => {
    p.age++;
    const mine = p.club === W.clubId;
    if (!mine && p.age <= 24 && ovrOf(p) < p.pot) grow(p, (p.age <= 21 ? 1 : .5) * (.6 + R() * .8));
    if (p.age >= 31) grow(p, -(p.age - 29) * .25 * (.5 + R()));
    if (p.club >= 0) p.con--;
    if ((p.age >= 34 && R() < (p.age - 33) * .3) || p.age >= 37) retired.push(p);
  });
  retired.forEach(p => { if (p.club === W.clubId) S.user.retired = (S.user.retired || []).concat(`${p.fn} ${p.ln}`); dropPlayer(p); });
  W.clubs.forEach(cl => {
    cl.squad.map(P).forEach(p => {
      if (p.con > 0) return;
      if (cl.id === W.clubId) expired.push(p.id);
      else if (R() < .8) { p.con = ri(1, 3); p.wage = wageFor(p, cl.div); }
      else { cl.squad = cl.squad.filter(x => x !== p.id); p.club = -1; }
    });
    // top up computer squads
    if (cl.id !== W.clubId) {
      const level = [14.2, 11.6, 9.4, 7.4][cl.div] - .5;
      POS.forEach(pos => { const need = {GK: 2, DF: 6, MF: 6, FW: 4}[pos]; while (cl.squad.map(P).filter(p => p.pos === pos).length < need) { const p = makePlayer(pos, level + (R() - .5) * 2, ri(17, 22), {div: cl.div}); p.club = cl.id; W.players[p.id] = p; cl.squad.push(p.id); } });
      cl.squad.map(P).forEach(p => { p.wage = Math.max(p.wage, wageFor(p, cl.div) * .8 | 0); });
      autoPick(cl);
    }
  });
  // youth intake for the user
  const n = ri(2, 3);
  for (let i = 0; i < n; i++) {
    const p = makePlayer(pick(['DF', 'MF', 'FW', 'MF', 'GK']), [10, 8.5, 7, 6][c.div] - 1 + R() * 2, ri(16, 17), {div: c.div, pot: [16, 14.5, 13, 12][c.div] + R() * 3});
    p.wage = Math.round(wageFor(p, c.div) * .6 / 10) * 10; p.con = 3; p.club = c.id; W.players[p.id] = p; c.squad.push(p.id); youth.push(p.id);
  }
  // free agents pool stays stocked
  const free = Object.values(W.players).filter(p => p.club < 0);
  free.filter(p => p.age > 33).forEach(dropPlayer);
  for (let i = free.length; i < 24; i++) { const p = makePlayer(pick(POS), ri(5, 11), ri(19, 33), {div: 3}); p.club = -1; W.players[p.id] = p; }
  W.nextId = NEXT_ID;
  S.user.expired = expired; S.user.youth = youth;
  S.cupWinner = W.cup.winner;
  return S;
}
function grow(p, amt) {
  const keys = p.pos === 'GK' ? ['gk', 'gk', 'gk', 'pas', 'pac'] : ['pac', 'tkl', 'pas', 'sho'];
  for (let i = 0; i < 4; i++) { const k = pick(keys); p.a[k] = clamp(Math.round((p.a[k] + amt * (k === 'pac' && amt < 0 ? 1.5 : 1)) * 10) / 10, 1, 20); }
}
function dropPlayer(p) {
  if (p.club >= 0) { const c = C(p.club); c.squad = c.squad.filter(x => x !== p.id); if (c.xi) c.xi = c.xi.map(x => x === p.id ? null : x); if (c.bench) c.bench = c.bench.filter(x => x !== p.id); }
  delete W.players[p.id];
}
function newSeason() {
  W.season++;
  W.board.conf = clamp(W.board.conf, 25, 100);
  W.fans = Math.round(clamp((W.fans ?? 60) * .7 + 18, 0, 100));
  startSeason();
  Object.values(W.players).forEach(p => { p.fit = 100; p.inj = 0; p.sus = 0; p.mor = clamp(p.mor * .5 + 35, 5, 100); p.val = valueOf(p); p.grew = 0; });
  W.clubs.forEach(c => { if (c.id !== W.clubId) autoPick(c); });
  fixTeam(me());
}
// job offers after a good season, or after the sack
function jobOffers(sacked) {
  const c = me();
  const pool = W.clubs.filter(x => x.id !== c.id && (sacked ? x.div >= c.div && x.div <= c.div + 1 : x.div < c.div || (x.div === c.div && x.rep > c.rep + 5)));
  return shuffle(pool).slice(0, 3).map(x => x.id);
}
function takeJob(id) {
  const old = me(); autoPick(old);
  W.clubId = id; W.career.clubs.push(id);
  const c = me(); c.squad.map(P).forEach(p => p.listed = false);
  W.board = {conf: 60}; setTarget(); fixTeam(c);
  W.tactics = null;
}
function startCareer(name, clubId) {
  W = newWorld(name);
  W.clubId = clubId; W.career.clubs = [clubId];
  W.training = {focus: 'balanced', int: 1};
  W.fans = 60;
  Object.values(W.players).forEach(p => p.val = valueOf(p));
  W.clubs.forEach(c => autoPick(c));
  startSeason();
  const c = me();
  inbox('The Chairman', `Welcome to ${c.name}!`, `Welcome aboard, ${name}. You've got ${money(c.cash)} in the bank. The board's target for this season: ${W.board.txt.toUpperCase()}. Don't let us down.`);
  inbox('Your Assistant', 'How it all works', `Hit CONTINUE to get to the next game. I'll pick the team for you until you change it in TACTICS. Try a different STYLE against teams whose style yours beats (the pre-match report tells you). Train the lads every week in CLUB, and play a drill for a bonus. Buy players in TRANSFERS. Good luck, gaffer!`);
}

// loans end with the season: everyone goes home (young players come back better for the games)
function returnLoans() {
  Object.values(W.players).forEach(p => {
    if (p.loanFrom == null) return;
    const cur = p.club >= 0 ? C(p.club) : null, home = C(p.loanFrom);
    if (cur) { cur.squad = cur.squad.filter(x => x !== p.id); if (cur.xi) cur.xi = cur.xi.map(x => x === p.id ? null : x); if (cur.bench) cur.bench = cur.bench.filter(x => x !== p.id); }
    if (home.id === W.clubId && cur && cur.id !== W.clubId) grow(p, p.age <= 21 ? .9 : .5);
    home.squad.push(p.id); p.club = home.id; delete p.loanFrom;
  });
}
