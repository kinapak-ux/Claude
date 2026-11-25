// PIXTEXT: what this version changes about Pixel Gaffer's rules, and the week-by-week flow.
// The match engine, players, clubs and dilemmas come unchanged from ../pixel-gaffer/
// (data.js, engine.js, scenarios.js). This file loads after them and replaces a few pieces.
'use strict';

// ---------- no midweek cups, no Europe: stand-ins for ../pixel-gaffer/comps.js, which isn't loaded
function setupComps() { W.ko = {}; }
function koFixtures() { return []; }
function progressComps() {}
function koPrize() { return 0; }
function userComp() { return null; }
function addForeignClubs() {}
function topUpForeign() {}

// ---------- a 28-week season: 22 league rounds and six Old Tin Cup rounds
const TX_CUP_WEEKS = [3, 7, 12, 16, 21, 25];
const TX_WEEKS = 28;
function calendar() {
  const cal = []; let l = 0, c = 0;
  for (let w = 0; w < TX_WEEKS; w++) cal.push(TX_CUP_WEEKS.includes(w) ? {t: 'C', r: c++} : {t: 'L', r: l++});
  return cal;
}
// the 28 Saturdays are spread from mid-August to May
function dateOf(season, week) {
  const d = new Date(Date.UTC(START_YEAR + season, 7, 17 + Math.round(week * 38 / (TX_WEEKS - 1)) * 7));
  return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
}
// engine.js asks this when you change jobs at the end of a season
const UI = {screen: ''};

// ---------- saving: one career, kept separately from Pixel Gaffer's own saves
const SAVE_KEY = 'pixtext-save';
function save() { if (!W) return; W.nextId = NEXT_ID; try { localStorage.setItem(SAVE_KEY, JSON.stringify(W)); } catch (e) {} }
function loadCareer() {
  let w = null; try { w = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
  if (!w || !w.clubs || w.clubId == null) return false;
  W = w; NEXT_ID = W.nextId || NEXT_ID;
  W.settings.mini = false; W.ko = {};
  if (!W.training) W.training = {focus: 'balanced', int: 1};
  cleanSquads();
  UI.screen = W.pendingSeason ? 'season' : '';
  return true;
}
function newCareer(name, clubId) {
  startCareer(name, clubId);
  W.settings.mini = false;   // set pieces and shoot-outs are always simulated here
  W.inbox = W.inbox.filter(m => m.subj !== 'How it all works');
  inbox('Your Assistant', 'How it all works', 'Press the RED button to play the next game. I pick the team until you change it on page 210. Check page 110 before each game: some styles beat others. Train the lads on 510, buy players on 400 and keep an eye on the tables on 301 to 304. Good luck, gaffer!');
  save();
}

const seasonDone = () => !!W && !W.pendingSeason && W.week >= W.cal.length;
const nextFx = () => W && !W.pendingSeason && W.week < W.cal.length ? userFixture() : null;
const oppOf = fx => C(fx.h === W.clubId ? fx.a : fx.h);

// ---------- RED BUTTON: carry on to whatever is next
let LM = null;   // the live match, while one is being played
function play() {
  if (!W) return goto(800);
  if (W.pendingSeason) return goto(600);
  if (seasonDone()) return endOfSeason();
  if (LM) return goto(LM.m.done ? 113 : 111);
  if (G.ftm) return goto(113);
  if (G.scen && !G.scenOut) return goto(102);
  cleanSquads();
  W.inbox.forEach(m => { if (m.act && m.act.type === 'bid' && !m.act.done && (m.s !== W.season || W.week - m.act.w > 2)) m.act.done = 'The offer expired.'; });
  const fx = nextFx();
  if (!fx) return afterWeek(finishWeek(null), null);
  const c = me();
  if (W.settings.autoPick) autoPick(c);
  else { const out = fixTeam(c); if (out.length) inbox('Your Assistant', 'Team changes', `${out.join(', ')} can't play, so I've changed the team.`); }
  if (c.xi.filter(x => x != null).length < 11) autoPick(c);
  const key = W.season * 100 + W.week;
  if (W.scenWeek !== key && W.week >= 1 && W.week - (W.lastScen ?? -9) >= 2 && R() < .45) {
    W.scenWeek = key; W.lastScen = W.week; G.scen = pickScenario(); G.scenOut = null; save(); return goto(102);
  }
  W.scenWeek = key;
  goto(110);
}

// ---------- dilemmas (page 102)
function answerScen(i) {
  const sc = G.scen, a = sc.s.a[i];
  let eff = a[1], txt = a[2], gamble = null;
  if (eff.chance != null) { gamble = R() < eff.chance; [eff, txt] = gamble ? eff.win : eff.lose; }
  W.scenSeen = (W.scenSeen || []).concat(sc.s.id).slice(-60);
  G.scenOut = {txt: scenText(txt, sc), out: applyScenario(eff, sc), gamble};
  save();
}
function scenDone() { G.scen = null; G.scenOut = null; play(); }

// ---------- the match
const SPEEDS = [1000, 500, 170];
function kickOff(live) {
  const fx = nextFx(); if (!fx) return play();
  const c = me(), home = fx.h === c.id;
  const m = new Match(fx.h, fx.a, {cup: fx.cup, neutral: fx.neutral, live, userSide: home ? 0 : 1});
  if (!live) { m.sim(); return toFullTime(m); }
  LM = {m, fx, lines: [{t: 'ko', m: 0, txt: `KICK OFF! ${C(fx.h).name} v ${C(fx.a).name}`}], next: Date.now() + 1200, hold: null, talked: false, goalAt: 0};
  goto(111);
}
function matchTick() {
  const m = LM.m, before = m.log.length;
  m.step();
  let pause = SPEEDS[(W.settings.speed || 2) - 1];
  m.log.slice(before).forEach(e => {
    LM.lines.push(e);
    if (e.t === 'goal') { pause = Math.max(pause, 2600); LM.goalAt = Date.now(); LM.goalSide = e.s; if (e.s === m.userSide) { beep(880, .12); setTimeout(() => beep(1175, .2), 150); } else beep(220, .3); }
    if (e.t === 'rc' || e.t === 'save' || e.t === 'post') pause = Math.max(pause, 1400);
    if (e.t === 'ht') { LM.hold = 'ht'; setTimeout(() => { if (LM && G.page === 111) goto(112); }, 1200); }
  });
  LM.lines = LM.lines.slice(-40);
  if (m.done) { LM.hold = 'ft'; setTimeout(() => { if (LM && LM.m === m) toFullTime(m); }, 2000); }
  LM.next = Date.now() + pause;
  if (G.page === 111) render();
}
function skipMatch() { if (!LM) return; const m = LM.m; m.sim(); toFullTime(m); }
function teamTalk(k) {
  const m = LM.m, us = m.sides[m.userSide], diff = us.g - m.sides[1 - m.userSide].g;
  const eff = {praise: diff > 0 ? 8 : diff === 0 ? 2 : -6, calm: 3, hair: diff < 0 ? 10 : diff === 0 ? 3 : -8}[k];
  us.on.forEach(id => { if (id != null) P(id).mor = clamp(P(id).mor + eff, 5, 100); });
  LM.talked = true;
  G.note = eff >= 8 ? 'The players look fired up!' : eff > 0 ? 'The players nod along.' : 'The players look fed up with you...';
}
function resume() { if (!LM) return goto(100); if (LM.hold === 'ht') LM.hold = null; LM.next = Date.now() + 600; goto(111); }
function toFullTime(m) { LM = null; G.ftm = m; goto(113); }

// after the final whistle: play the rest of the week and move on
function ftContinue() {
  const m = G.ftm; if (!m) return goto(100);
  let rep;
  try { rep = finishWeek(m); }
  catch (e) { console.error(e); cleanSquads(); fixTeam(me()); rep = finishWeek(m); }
  afterWeek(rep, m);
}
function afterWeek(rep, m) {
  G.ftm = null;
  const c = me();
  W.lastWeek = {cup: rep.cup, label: rep.cup && rep.results[0] ? rep.results[0].label : null, w: W.week - 1, results: rep.results.map(r => ({h: r.h, a: r.a, hg: r.hg, ag: r.ag, pens: r.pens, d: r.d}))};
  W.lastMoney = {gate: rep.gate || 0, att: rep.user ? rep.user.att : 0, wages: rep.wages || 0, tv: rep.tv || 0, home: !!(rep.user && rep.user.h === c.id)};
  // the assistant sums up anything worth knowing in one message
  const notes = rep.msgs.slice();
  c.squad.map(P).filter(p => p && p.grew && p.grewShown !== p.grew).forEach(p => { p.grewShown = p.grew; notes.push(`${pname(p)} has improved in training. Now rated ${ovr(p)}.`); });
  if (m) {
    const s = m.sides[m.userSide];
    Object.keys(s.injured || {}).map(P).filter(p => p && p.inj).forEach(p => notes.push(`${pname(p)} was injured and will be out for ${p.inj} week${p.inj > 1 ? 's' : ''}.`));
    Object.keys(s.reds || {}).map(P).filter(p => p && p.sus).forEach(p => notes.push(`${pname(p)} is suspended for ${p.sus} game${p.sus > 1 ? 's' : ''}.`));
  }
  if (notes.length) inbox('Your Assistant', 'This week at the club', notes.join(' '));
  save();
  goto(300);
}

// ---------- end of the season (pages 600 to 603)
function endOfSeason() {
  const S = endSeason();
  const great = S.user.pos <= 2 || S.user.cupRound === 6;
  let offers = S.user.sacked ? jobOffers(true) : great && R() < .7 ? jobOffers(false).slice(0, 2) : [];
  if (S.user.sacked && !offers.length) offers = [pick(W.clubs.filter(x => x.div === 3 && x.id !== W.clubId)).id];
  W.pendingSeason = S; W.pendingOffers = offers;
  W.renew = Object.fromEntries((S.user.expired || []).map(id => [id, P(id) ? P(id).age < 33 : false]));
  UI.screen = 'season';
  save(); goto(600);
}
function applyRenewals() {
  const S = W.pendingSeason; if (!S || S.user.sacked) return;
  const c = me();
  (S.user.expired || []).forEach(id => {
    const p = P(id); if (!p || p.club !== c.id) return;
    if (W.renew && W.renew[id]) { p.wage = wageDemand(Object.assign({}, p, {club: c.id}), c.div); p.con = 3; }
    else { c.squad = c.squad.filter(x => x !== id); p.club = -1; p.con = 1; }
  });
}
function startNextSeason(jobId) {
  applyRenewals();
  if (jobId != null) takeJob(jobId);
  delete W.pendingSeason; delete W.pendingOffers; delete W.renew;
  UI.screen = '';
  newSeason();
  inbox('The Chairman', `Season ${seasonLabel(W.season)}`, `A new season, ${W.name}. The board's target: ${W.board.txt.toUpperCase()}. You have ${money(me().cash)} to spend.`);
  save(); G.hist = []; goto(100);
}
const seasonLabel = s => `${START_YEAR + s}/${String(START_YEAR + s + 1).slice(2)}`;

// ---------- transfers (page 410): one offer at a time, and the chairman's patience runs out
const talks = {};
function talkFor(p) {
  if (!talks[p.id]) { const ask = askingPrice(p); talks[p.id] = {ask, secret: ask * (.9 + R() * .14), patience: 3, said: pick(['He is not for sale... but everyone has a price.', 'Make me an offer, son.', "He's the heartbeat of this club.", 'You will have to pay up for him.'])}; }
  return talks[p.id];
}
function signPlayer(p, fee) {
  const c = me(), wage = wageDemand(p, c.div), from = p.club >= 0 ? C(p.club) : null;
  moveP(p, c, fee); p.wage = wage; p.con = 3;
  news(`${pname(p).toUpperCase()} SIGNS FOR ${c.name.toUpperCase()} ${from ? 'FOR ' + money(fee) : 'ON A FREE'}`);
  if (!W.settings.autoPick) fixTeam(c);
  save();
}
function makeOffer(p, f) {
  const t = talkFor(p), c = me(), step = t.ask > 1e6 ? 50000 : t.ask > 1e5 ? 5000 : 1000;
  const offer = Math.max(step, Math.round(t.ask * f / step) * step);
  if (offer > c.cash) { G.note = "You haven't got that much in the bank."; return; }
  if (offer >= t.secret) { signPlayer(p, offer); t.done = `Deal done for ${money(offer)}! He has signed a 3-year contract.`; beep(988, .15); return; }
  t.patience -= f < .75 ? 2 : 1;
  const counter = Math.round(Math.max(t.secret * 1.04, (offer + t.ask * 1.1) / 2) / step) * step;
  if (t.patience <= 0) { t.dead = true; t.said = 'Get out of my office. We are done talking.'; beep(150, .3); return; }
  t.said = f < .75 ? `Is that a joke? ${money(counter)} or nothing.` : `Not enough. I want ${money(counter)}.`;
}
function answerBid(m, yes) {
  const p = P(m.act.pid), buyer = C(m.act.club), c = me();
  if (!p || p.club !== c.id) { m.act.done = 'He is no longer at the club.'; return; }
  if (yes) {
    if (c.squad.length <= 14) { G.note = 'You need at least 14 players. Sign someone first.'; return; }
    moveP(p, buyer, m.act.amt); fixTeam(c);
    m.act.done = `Sold to ${buyer.name} for ${money(m.act.amt)}.`;
    news(`${pname(p).toUpperCase()} JOINS ${buyer.name.toUpperCase()} FROM ${c.short} FOR ${money(m.act.amt)}`);
  } else {
    m.act.done = 'You turned it down.';
    if (R() < .35 && buyer.cash > m.act.amt * 1.2) { const amt = Math.round(m.act.amt * 1.18 / 1000) * 1000; inbox(buyer.name, `Improved bid for ${pname(p)}`, `${buyer.name} have come back with ${money(amt)} for ${p.fn} ${p.ln}.`, {type: 'bid', pid: p.id, club: buyer.id, amt, w: W.week}); }
    else p.mor = clamp(p.mor + (p.listed ? -5 : 3), 5, 100);
  }
  save();
}

// ---------- team selection (pages 210 and 211)
function choosePlayer(k, id) {
  const c = me(), isBench = String(k)[0] === 'b';
  W.settings.autoPick = false;
  const inXi = c.xi.indexOf(id), inB = c.bench.indexOf(id);
  if (isBench) {
    const b = +String(k).slice(1), cur = c.bench[b];
    if (inXi >= 0) { if (cur == null) { G.note = 'Pick someone to take his place in the team first.'; return false; } c.xi[inXi] = cur; }
    if (inB >= 0) c.bench[inB] = cur;
    c.bench[b] = id;
    c.bench = c.bench.filter(x => x != null);
  } else {
    const cur = c.xi[k];
    if (inXi >= 0) c.xi[inXi] = cur;
    else if (inB >= 0) { if (cur != null) c.bench[inB] = cur; else c.bench.splice(inB, 1); }
    c.xi[k] = id;
  }
  save(); return true;
}
const cycle = (list, cur, d) => list[(list.indexOf(cur) + (d || 1) + list.length) % list.length];

// ---------- starting up
function boot() {
  measure(); fit();
  loadCareer();
  G.page = 100; render();
  if (document.fonts) document.fonts.ready.then(() => { measure(); fit(); render(); });
  // the clock in the header ticks, and a live match moves on a minute at a time
  setInterval(() => { if (!LM || G.page !== 111) render(); }, 1000);
  setInterval(() => { if (LM && G.page === 111 && !LM.hold && Date.now() >= LM.next) matchTick(); }, 100);
  addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}
