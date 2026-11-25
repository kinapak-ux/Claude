// PIXTEXT: every page. Each one does one job; the page number is the menu.
//
// 100 Index                       300 Latest scores (vidiprinter)
// 101 Inbox   102 Dilemma         301-304 League tables, one division each
// 110 Match day                   310 Your fixtures   320 Old Tin Cup   330 Top scorers
// 111 Live match                  400 Transfer market   401 Free agents   410 Make an offer
// 112 Touchline (team talk, subs) 500 Finances   510 Training   520 The board and your career
// 113 Full time                   600-603 End of season
// 200 Squad   230-255 One player  700 How to use PIXTEXT
// 210 Pick the team  211 Choose   800 New career   801-804 Pick a club
'use strict';

// ---------- little helpers
const T = (t, a) => ({t, a});                       // a row you can tap
const DH = (t, a) => ({t, dh: true, a});            // a double-height row
const title = (txt, col) => DH(`[${col || 'y'}]${txt}`);
const band = txt => `[B][y] ${txt}`;
const link = (n, label, w) => `[@${n}][c]${n}[w] ${pad(label, (w || 20) - 4)}[@]`;
const choice = (txt, col) => `[${col || 'y'}]> [w]${txt}`;
const yesNo = v => v ? '[g]ON ' : '[r]OFF';
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const nm = p => clean(p ? pname(p) : '?');
const clubN = (id, w) => pad(clean(C(id).name), w || 17);
const ratCol = o => o >= 80 ? 'c' : o >= 65 ? 'g' : o >= 50 ? 'y' : o >= 35 ? 'm' : 'r';
const rat = (p, pos) => { const o = ovr(p, pos); return `[${ratCol(o)}]${lpad(o, 3)}`; };
const posCol = {GK: 'y', DF: 'c', MF: 'g', FW: 'm'};
const posT = pos => `[${posCol[pos]}]${pos}`;
const fitT = f => `[${f >= 85 ? 'g' : f >= 65 ? 'y' : 'r'}]${lpad(Math.round(f), 3)}%`;
const statusT = p => p.inj ? `[r]INJ${p.inj}w` : p.sus ? `[m]SUS${p.sus}` : p.listed ? '[c]LIST' : '';
const bar = (v, max, n, col) => { const f = clamp(Math.round(v / max * n), 0, n); return `[${(col || 'g').toUpperCase()}]${' '.repeat(f)}[K][b]${'.'.repeat(n - f)}[w]`; };
const moraleWord = m => m >= 85 ? 'Superb' : m >= 65 ? 'Good' : m >= 45 ? 'OK' : m >= 25 ? 'Low' : 'Angry';
const fansWord = f => f >= 80 ? 'Singing your name' : f >= 60 ? 'Right behind you' : f >= 40 ? 'Restless' : f >= 20 ? 'Grumbling' : 'Calling for your head';
const confWord = c => c >= 80 ? 'Delighted' : c >= 60 ? 'Happy' : c >= 40 ? 'Watching closely' : c >= 20 ? 'Worried' : 'Your job is on the line';
const formT = f => (f || '').slice(-5).split('').map(x => `[${x === 'W' ? 'g' : x === 'L' ? 'r' : 'y'}]${x}`).join('') + '[w]';
const shortDate = (s, w) => dateOf(s, w).replace(/ \d{4}$/, '');
const sqList = () => me().squad.map(P).filter(Boolean).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || ovrOf(b) - ovrOf(a));
const PLAYER_PAGE = 230;
const playLabel = () => !W ? 'NEW GAME' : W.pendingSeason || seasonDone() ? 'SEASON END' : LM ? 'THE MATCH' : G.ftm ? 'FULL TIME' : nextFx() ? 'PLAY' : 'NEXT WEEK';
const playAct = () => play();
const PLAY = () => [playLabel(), playAct];
const INDEX = ['INDEX', 100];
const needCareer = () => ({head: [title('NO CAREER YET')], body: ['', '[w]Start a career first.', '', link(800, 'Start a new career', 30)], fast: [['NEW CAREER', 800], null, null, ['HELP', 700]]});

function pageFor(n) {
  if (n === 100) return W ? indexPage() : welcomePage();
  if (n === 700) return helpPage();
  if (n === 800) return newCareerPage();
  if (n >= 801 && n <= 804) return clubPickPage(n - 801);
  if (!W) return needCareer();
  if (PAGES[n]) return PAGES[n]();
  if (n >= 301 && n <= 304) return tablePage(n - 301);
  if (n >= PLAYER_PAGE && n < PLAYER_PAGE + 26) return playerPage(n - PLAYER_PAGE);
  return null;
}

// ---------- 100: the index
function welcomePage() {
  return {head: mosaicWord('PIXTEXT', 'y', 'b'),
    body: ['', DH('[c]   FOOTBALL MANAGEMENT ON TELETEXT'), '', '[w] 48 clubs. Four divisions. One cup.', '[w] Every screen is a page with a number:', '[w] type it on the keypad to go there.', '', ' ' + link(800, 'Start a new career', 30), ' ' + link(700, 'How to use PIXTEXT', 30)],
    fast: [['NEW CAREER', 800], ['HELP', 700], null, null]};
}
function indexPage() {
  const c = me(), fx = nextFx(), unread = W.inbox.filter(m => !m.read).length, toAnswer = W.inbox.filter(m => m.act && !m.act.done).length;
  const out = c.squad.map(P).filter(p => p && (p.inj || p.sus)).length;
  const body = [band(`${pad(clean(c.name), 21)} ${lpad(DIVS[c.div], 16)}`), `[w]${pad(dateOf(W.season, Math.min(W.week, W.cal.length - 1)), 14)} [${c.cash < 0 ? 'r' : 'g'}]${lpad(money(c.cash), 8)}[w] in the bank`, ''];
  if (W.pendingSeason || seasonDone()) body.push('[y]THE SEASON IS OVER.', '[w]Press RED for the season review.');
  else if (LM) body.push('[*][g]YOU HAVE A MATCH ON![/]', '[w]Press RED to go back to it.');
  else if (fx) {
    const opp = oppOf(fx), home = fx.h === c.id, e = W.cal[W.week];
    body.push(`[c]NEXT [w]${clean(opp.name)} [y]${fx.neutral ? '(N)' : home ? '(H)' : '(A)'}`, `[w]     ${fx.cup ? clean(fx.label) : `League round ${e.r + 1}`}${opp.div === c.div ? `, they're ${ordinal(posIn(opp.id))}` : ''}`);
    const t = BEATS[c.style].includes(opp.style) ? `[g]Your ${STYLES[c.style].n} beats their ${STYLES[opp.style].n}` : BEATS[opp.style].includes(c.style) ? `[r]Their ${STYLES[opp.style].n} beats your ${STYLES[c.style].n}!` : `[w]Your styles cancel out`;
    body.push(`     ${t}`);
    if (isDerby(fx.h, fx.a)) body.push('[*][r]     DERBY DAY!');
  } else body.push(`[c]NEXT [w]No game for you this week.`);
  body.push('');
  if (toAnswer) body.push(T(`[r]  ${toAnswer} message${toAnswer > 1 ? 's' : ''} waiting for an answer: 101`, 101));
  if (out) body.push(T(`[m]  ${out} player${out > 1 ? 's' : ''} injured or suspended: 200`, 200));
  const L = [[101, `Inbox${unread ? ` (${unread})` : ''}`], [110, 'Match day'], [200, 'Squad'], [210, 'Pick the team'], [400, 'Transfers'], [500, 'Finances'], [510, 'Training'], [520, 'The board']];
  const Rt = [[300, 'Latest scores'], [301 + c.div, 'League table'], [310, 'Fixtures'], [320, 'Old Tin Cup'], [330, 'Top scorers'], [401, 'Free agents'], [700, 'How to use'], [800, 'New career']];
  while (body.length < 20 - L.length) body.push('');
  L.forEach((l, i) => body.push(` ${link(l[0], l[1], 20)}${link(Rt[i][0], Rt[i][1], 19)}`));
  return {head: mosaicWord('PIXTEXT', 'y', 'b'), body, fast: [PLAY(), ['INBOX', 101], ['TABLE', 301 + c.div], ['SQUAD', 200]]};
}

// ---------- 101: inbox, 102: dilemmas
function inboxPage() {
  const m = G.msg && W.inbox.find(x => x.id === G.msg);
  if (m) {
    m.read = true;
    const body = [`[c]From [w]${clean(m.from)}`, `[c]Date [w]${dateOf(m.s, m.w)}`, `[y]${clean(m.subj)}`, ''].concat(wrap(m.body).map(l => '[w]' + l));
    if (m.act && m.act.type === 'bid') {
      body.push('');
      if (m.act.done) body.push('[g]' + clean(m.act.done));
      else body.push(T(choice(`Accept ${money(m.act.amt)}`, 'g'), () => answerBid(m, true)), T(choice('Reject the bid', 'r'), () => answerBid(m, false)), T(choice(`Look at ${nm(P(m.act.pid))} first`), () => { const i = sqList().findIndex(p => p.id === m.act.pid); if (i >= 0) goto(PLAYER_PAGE + i); }));
    }
    return {head: [title('INBOX')], body, fast: [['ALL MAIL', () => { G.msg = null; }], null, null, INDEX]};
  }
  const body = [];
  W.inbox.forEach(x => {
    const open = () => { G.msg = x.id; save(); };
    body.push(T(`${x.read ? '[w] ' : '[y]*'}${pad(clean(x.from), 25)} [c]${lpad(shortDate(x.s, x.w), 12)}`, open));
    body.push(T(`  ${x.act && !x.act.done ? '[r]' : x.read ? '[w]' : '[y]'}${clean(x.subj)}`, open));
  });
  if (!body.length) body.push('[w]No messages.');
  return {head: [title('INBOX'), '[c]Tap a message to read it. [y]*[c] = new'], body, fast: [PLAY(), ['MARK READ', () => { W.inbox.forEach(x => x.read = true); save(); }], null, INDEX]};
}
function scenPage() {
  const sc = G.scen;
  if (!sc) return {head: [title('DILEMMA')], body: ['', '[w]Nothing needs deciding right now.'], fast: [PLAY(), null, null, INDEX]};
  const p = sc.pid != null ? P(sc.pid) : null;
  const body = [`[c]From [w]${clean(scenText(sc.s.from, sc))}`, ''].concat(wrap('"' + scenText(sc.s.q, sc) + '"').map(l => '[y]' + l), ['']);
  if (G.scenOut) {
    const o = G.scenOut;
    body.push(o.gamble == null ? '[c]You decided...' : o.gamble ? '[g]It paid off!' : '[r]It backfired!');
    wrap(o.txt).forEach(l => body.push('[w]' + l));
    body.push('');
    o.out.forEach(([n, v]) => body.push(n === '£' ? `[${v > 0 ? 'g' : 'r'}]  ${v > 0 ? '+' : '-'}${money(Math.abs(v))}` : typeof v === 'boolean' ? `[${v ? 'g' : 'r'}]  ${clean(n)}` : `[${v > 0 ? 'g' : 'r'}]  ${clean(n)} ${v > 0 ? 'up' : 'down'}`));
    if (!o.out.length) body.push('[w]  No real change.');
    return {head: [title('DILEMMA')], body, fast: [['CONTINUE', scenDone], null, null, INDEX]};
  }
  sc.s.a.forEach((a, i) => {
    const lines = wrap(scenText(a[0], sc) + (a[1].chance ? ' (gamble)' : ''), 36);
    lines.forEach((l, k) => body.push(T(k ? `    [w]${l}` : `[y]${i + 1}> [w]${l}`, () => answerScen(i))));
  });
  if (p) body.push('', `[c]${nm(p)}: ${POS_NAME[p.pos]}, ${ovr(p)}`);
  return {head: [title('A WORD, GAFFER')], body, fast: [null, null, null, null]};
}

// ---------- 110: match day
function matchDayPage() {
  const c = me(), fx = nextFx();
  if (!fx) return {head: [title('MATCH DAY')], body: ['', W.pendingSeason || seasonDone() ? '[w]The season is over.' : LM ? '[w]Your match is on: press RED.' : "[w]You don't have a game this week.", '', '[w]Press RED to move on.'], fast: [PLAY(), null, null, INDEX]};
  const home = fx.h === c.id, opp = oppOf(fx); autoPick(opp);
  const mm = new Match(fx.h, fx.a, {}), us = mm.power(home ? 0 : 1), them = mm.power(home ? 1 : 0);
  const cmp = (n, a, b) => `[w]${pad(n, 9)}${bar(a, a + b, 16, 'c')} ${a > b * 1.08 ? '[g]STRONGER' : b > a * 1.08 ? '[r]WEAKER' : '[y]EVEN'}`;
  const key = opp.xi.map(P).filter(Boolean).sort((a, b) => ovrOf(b) - ovrOf(a))[0];
  const tp = id => { const cl = C(id); return cl.div === c.div ? `${ordinal(posIn(id))} ` : ''; };
  const body = [`[c]${fx.cup ? clean(fx.label) : `${DIVS[c.div]}, round ${W.cal[W.week].r + 1}`}`, `[w]${dateOf(W.season, W.week)}${fx.neutral ? ', neutral ground' : ''}`, '',
    `[y]${clubN(fx.h, 18)} [w]v [y]${clubN(fx.a, 18)}`, `[w]${pad(tp(fx.h), 6)}${formT(C(fx.h).formStr)}${' '.repeat(8)}  ${pad(tp(fx.a), 6)}${formT(C(fx.a).formStr)}`];
  if (isDerby(fx.h, fx.a)) { const d = derbyRec(); body.push(`[*][r]DERBY DAY![/] [w]All-time: W${d.w} D${d.d} L${d.l}`); }
  body.push('', `[c]SCOUT REPORT: [w]${opp.formation}, ${STYLES[opp.style].n}`, `[w]Danger man: ${nm(key)} (${key ? ovr(key) : '-'})`, cmp('Defence', us.def, them.def), cmp('Midfield', us.mid, them.mid), cmp('Attack', us.att, them.att), '');
  if (BEATS[c.style].includes(opp.style)) body.push(`[g]Your ${STYLES[c.style].n} beats their ${STYLES[opp.style].n}.`);
  else {
    body.push(BEATS[opp.style].includes(c.style) ? `[r]Their ${STYLES[opp.style].n} beats your ${STYLES[c.style].n}!` : `[w]Your ${STYLES[c.style].n}: no edge either way.`);
    Object.keys(STYLES).filter(s => BEATS[s].includes(opp.style)).forEach(s => body.push(T(choice(`Switch to ${STYLES[s].n}`), () => { c.style = s; save(); })));
  }
  body.push(T(`[c]YOUR TEAM [w]${c.formation}, ${STYLES[c.style].n} [y]> 210`, 210));
  return {head: [title('MATCH DAY')], body, fast: [['KICK OFF', () => kickOff(true)], ['QUICK RES', () => kickOff(false)], ['TEAM', 210], INDEX]};
}

// ---------- 111: the live match, 112: the touchline, 113: full time
const EV_COL = {goal: 'g', rc: 'r', yc: 'y', save: 'c', post: 'c', ht: 'm', ft: 'm', pen: 'y', fk: 'y', sub: 'c', inj: 'r', et: 'm', pens: 'm', ko: 'm', shootout: 'y'};
function scoreRow(m, extra) {
  const S = m.sides;
  return DH(`[B][w] ${pad(S[0].c.short, 3)} [y]${S[0].g}-${S[1].g}[w] ${pad(S[1].c.short, 3)}  ${extra || ''}`);
}
function livePage() {
  if (!LM) return {head: [title('LIVE MATCH')], body: ['', '[w]No match on right now.'], fast: [PLAY(), null, null, INDEX]};
  const m = LM.m, S = m.sides, pos = Math.round(S[0].poss / Math.max(1, S[0].poss + S[1].poss) * 100);
  const head = [scoreRow(m, `[c]${lpad(m.minute + "'", 4)}${LM.hold === 'ht' ? ' [y]HT' : LM.hold === 'ft' ? ' [y]FT' : ''}`),
    `[c]Possession [w]${pos}%-${100 - pos}%  [c]Shots [w]${S[0].sh}(${S[0].sot})-${S[1].sh}(${S[1].sot})`];
  head.push(Date.now() - LM.goalAt < 2600 ? `[*][${LM.goalSide === m.userSide ? 'g' : 'r'}]${' '.repeat(14)}G O A L !` : '');
  const lines = [];
  LM.lines.forEach(e => wrap((e.m != null && e.t !== 'ko' ? e.m + "' " : '') + e.txt, 39).forEach((l, k) => lines.push(`[${EV_COL[e.t] || 'w'}]${k ? '    ' : ''}${l}`)));
  const room = PAGE_ROWS - 4 - 1;
  return {head, body: lines.slice(-room), fast: [[`SPEED:${['SLOW', 'NORM', 'FAST'][(W.settings.speed || 2) - 1]}`, () => { W.settings.speed = (W.settings.speed || 2) % 3 + 1; LM.next = Math.min(LM.next, Date.now() + SPEEDS[W.settings.speed - 1]); save(); }], ['TOUCHLINE', 112], ['SKIP TO FT', skipMatch], INDEX]};
}
function touchlinePage() {
  if (!LM) return {head: [title('TOUCHLINE')], body: ['', '[w]No match on right now.'], fast: [PLAY(), null, null, INDEX]};
  const m = LM.m, s = m.sides[m.userSide], slots = formSlots(s.form), ht = LM.hold === 'ht' && !LM.talked;
  const body = [
    ht ? '[y]HALF TIME. What do you tell them?' : `[c]${m.minute}' [w]${s.subsLeft} sub${s.subsLeft === 1 ? '' : 's'} left. Tap who comes off.`,
    T(`[c]STYLE     [w]${pad(STYLES[s.style].n, 15)}[y]> change`, () => { s.style = cycle(Object.keys(STYLES), s.style); }),
    T(`[c]FORMATION [w]${pad(s.form, 15)}[y]> change`, () => { s.form = cycle(Object.keys(FORMS), s.form); })];
  s.on.forEach((id, k) => {
    if (id == null) { body.push(`[r]${slots[k]} (sent off)`); return; }
    const p = P(id), sel = G.subOff === id;
    body.push(T(`${sel ? '[C][k]' : ''}${posT(slots[k])} ${sel ? '[k]' : '[w]'}${pad(nm(p), 14)}${rat(p, slots[k])} ${fitT(s.fit[id] ?? p.fit)}${s.yc[id] ? ' [y]YC' : ''}${s.injured && s.injured[id] ? ' [r]INJ' : ''}`,
      () => { G.subOff = G.subOff === id ? null : id; }));
  });
  body.push('[c]BENCH' + (G.subOff ? ' [y]tap who comes on' : ''));
  s.bench.forEach(id => { const p = P(id); body.push(T(`[w]${posT(p.pos)} [w]${pad(nm(p), 14)}${rat(p)} ${fitT(p.fit)}`, () => {
    if (G.subOff == null) { G.note = 'First tap the player to take off.'; return; }
    if (s.subsLeft <= 0) { G.note = 'No subs left.'; return; }
    const e = []; if (m.sub(m.userSide, G.subOff, id, e)) LM.lines.push(...e); G.subOff = null;
  })); });
  const fast = ht ? [['PRAISE', () => teamTalk('praise')], ['STAY CALM', () => teamTalk('calm')], ['HAIRDRYER', () => teamTalk('hair')], ['BACK', resume]] : [['BACK TO GAME', resume], null, null, ['BACK', resume]];
  return {head: [scoreRow(m, `[c]${m.minute}'`)], body, fast};
}
function fullTimePage() {
  const m = G.ftm;
  if (!m) return {head: [title('FULL TIME')], body: ['', '[w]No result to show.'], fast: [PLAY(), null, null, INDEX]};
  const S = m.sides, us = m.userSide, mine = S[us], w = m.winner();
  const goals = side => { const by = {}; m.log.filter(e => e.t === 'goal' && e.s === side).forEach(e => { (by[e.pid] = by[e.pid] || []).push(e.m + (e.kind === 'pen' ? 'p' : '')); }); return Object.entries(by).map(([pid, ms]) => `${P(pid) ? clean(P(pid).ln) : '?'} ${ms.join(' ')}`); };
  const g0 = goals(0), g1 = goals(1), body = [];
  for (let i = 0; i < Math.max(g0.length, g1.length); i++) body.push(`[w]${pad(g0[i] || '', 20)}${pad(g1[i] || '', 20)}`);
  const pos = Math.round(S[0].poss / Math.max(1, S[0].poss + S[1].poss) * 100);
  body.push(`[c]Possession [w]${pos}-${100 - pos}  [c]Shots [w]${S[0].sh}-${S[1].sh}  [c]On target [w]${S[0].sot}-${S[1].sot}`, '', '[c]YOUR PLAYER RATINGS');
  const rated = [...mine.played].filter(id => P(id)).map(id => ({p: P(id), r: clamp(Math.round(mine.rt[id] * 10) / 10, 3, 10)})).sort((a, b) => b.r - a.r);
  for (let i = 0; i < rated.length; i += 2) body.push(rated.slice(i, i + 2).map((x, k) => `${posT(x.p.pos)} [w]${pad(clean(x.p.ln) + (i + k === 0 ? '*' : ''), 11)}[${x.r >= 7.5 ? 'g' : x.r < 6 ? 'r' : 'y'}]${x.r.toFixed(1)}   `).join(''));
  return {head: [title('FULL TIME', w === us ? 'g' : w === 1 - us ? 'r' : 'y'), scoreRow(m, w === us ? '[g]WON' : w === 1 - us ? '[r]LOST' : '[y]DRAW'), m.pens ? `[y]${m.pens[0]}-${m.pens[1]} on penalties` : ''], body, fast: [['CONTINUE', ftContinue], null, null, null]};
}

// ---------- 200: squad, 230+: one player
function squadPage() {
  const c = me(), list = sqList(), wages = list.reduce((s, p) => s + p.wage, 0);
  const body = list.map((p, i) => T(`[c]${PLAYER_PAGE + i} ${posT(p.pos)} ${c.xi && c.xi.includes(p.id) ? '[w]' : '[b]'}${pad(nm(p), 13)} [w]${lpad(p.age, 2)}${rat(p)} ${fitT(p.fit)} ${statusT(p)}`, PLAYER_PAGE + i));
  return {head: [title(`SQUAD (${list.length})`), '[c]PAGE   NAME          AGE RAT  FIT'],
    body, foot: [`[w]Wages ${money(wages)}/wk. TV pays ${Math.round(TV[c.div] / Math.max(1, wages) * 100)}% of it.`, '[w]White = in the team. Tap a player.'],
    fast: [PLAY(), ['TEAM', 210], ['TRANSFERS', 400], INDEX]};
}
function playerPage(i) {
  const list = sqList(), p = list[i];
  if (!p) return null;
  const a = p.a, keys = p.pos === 'GK' ? [['gk', 'Goalkeeping'], ['pas', 'Kicking'], ['pac', 'Agility']] : [['pac', 'Pace'], ['tkl', 'Tackling'], ['pas', 'Passing'], ['sho', 'Shooting']];
  const grow = clamp(1 + Math.round((p.pot - ovrOf(p)) / 1.4), 1, 5), c = me();
  const body = [`[w]${POS_NAME[p.pos]}, age ${p.age}`, `[c]RATING ${rat(p)}   [c]ROOM TO GROW [y]${'*'.repeat(grow)}[b]${'.'.repeat(5 - grow)}`, ''];
  keys.forEach(([k, n]) => body.push(`[w]${pad(n, 12)}${bar(a[k], 20, 20, a[k] >= 15 ? 'c' : a[k] >= 11 ? 'g' : a[k] >= 7 ? 'y' : 'r')} ${lpad(Math.round(a[k]), 2)}`));
  body.push('', `[c]FITNESS ${fitT(p.fit)} [c]MORALE [w]${moraleWord(p.mor)} [c]FORM [w]${p.form >= 1.2 ? 'Hot' : p.form <= -1.2 ? 'Poor' : 'Steady'}`,
    `[c]VALUE [w]${money(valueOf(p))} [c]WAGE [w]${money(p.wage)}/wk [c]DEAL [w]${p.con <= 0 ? 'ends' : p.con + 'yr'}`,
    `[c]SEASON [w]${p.s.ap} apps, ${p.s.gl} goals, ${p.s.as} assists${p.s.ap ? `, ${(p.s.rt / p.s.ap).toFixed(1)}` : ''}`);
  if (p.tr) wrap(`${TRAITS[p.tr].n}: ${TRAITS[p.tr].d}`, 38).forEach((l, k) => body.push((k ? '[m]  ' : '[m]* ') + l));
  if (p.inj) body.push(`[r]Injured: out for ${p.inj} week${p.inj > 1 ? 's' : ''}.`);
  if (p.sus) body.push(`[m]Suspended for ${p.sus} game${p.sus > 1 ? 's' : ''}.`);
  body.push('');
  body.push(T(choice(p.listed ? 'Take him off the transfer list' : 'Put him on the transfer list'), () => { p.listed = !p.listed; save(); G.note = p.listed ? 'Listed. Bids should follow.' : 'Taken off the list.'; }));
  if (p.con <= 1) {
    const wage = Math.round(wageDemand(Object.assign({}, p), c.div) * (p.mor < 40 ? 1.3 : 1) / 10) * 10;
    body.push(G.confirm === 'renew' ? T(choice(`Yes: ${money(wage)}/wk for 3 years`, 'g'), () => { p.wage = wage; p.con = 3; p.mor = clamp(p.mor + 10, 5, 100); G.confirm = null; save(); G.note = 'He has signed a new deal!'; })
      : T(choice('Offer him a new contract'), () => { if (p.mor < 25) { G.note = `${nm(p)} won't talk. He wants out!`; return; } G.confirm = 'renew'; }));
  }
  const cost = releaseCost(p);
  body.push(G.confirm === 'release' ? T(choice(`Yes, release him for ${money(cost)}`, 'r'), () => {
    if (c.squad.length <= 14) { G.note = 'You need at least 14 players.'; return; }
    c.cash -= cost; c.squad = c.squad.filter(x => x !== p.id); p.club = -1; p.listed = false; c.xi = c.xi.map(x => x === p.id ? null : x); c.bench = c.bench.filter(x => x !== p.id); fixTeam(c);
    save(); goto(200);
  }) : T(choice(`Release him (costs ${money(cost)})`, 'r'), () => { G.confirm = 'release'; }));
  return {head: [title(`${clean(p.fn)} ${clean(p.ln)}`.toUpperCase())], body,
    fast: [['SQUAD', 200], ['< PREV', PLAYER_PAGE + (i + list.length - 1) % list.length], ['NEXT >', PLAYER_PAGE + (i + 1) % list.length], ['TEAM', 210]]};
}

// ---------- 210: pick the team, 211: choose who plays
function teamPage() {
  const c = me(); fixTeam(c);
  const slots = formSlots(c.formation);
  const body = [
    T(`[c]FORMATION [w]${pad(c.formation, 14)}[y]> change`, () => { c.formation = cycle(Object.keys(FORMS), c.formation); if (W.settings.autoPick) autoPick(c); save(); }),
    T(`[c]STYLE     [w]${pad(STYLES[c.style].n, 14)}[y]> change`, () => { c.style = cycle(Object.keys(STYLES), c.style); save(); }),
    `[g]          beats ${BEATS[c.style].map(s => STYLES[s].n).join(' and ')}`,
    T(`[c]AUTO-PICK ${yesNo(W.settings.autoPick)}           [y]> change`, () => { W.settings.autoPick = !W.settings.autoPick; if (W.settings.autoPick) autoPick(c); save(); })];
  c.xi.forEach((id, k) => {
    const p = id != null ? P(id) : null, off = p && p.pos !== slots[k];
    body.push(T(p ? `${posT(slots[k])} ${off ? '[r]' : '[w]'}${pad(nm(p), 14)}${rat(p, slots[k])} ${fitT(p.fit)} ${statusT(p)}` : `${posT(slots[k])} [r]NOBODY: tap to pick`, () => { G.slot = k; goto(211); }));
  });
  for (let k = 0; k < 5; k++) {
    const id = c.bench[k], p = id != null ? P(id) : null;
    body.push(T(p ? `[c]SB [w]${pad(nm(p), 14)}${rat(p)} ${fitT(p.fit)} ${posT(p.pos)}` : '[c]SB [b]empty: tap to pick', () => { G.slot = 'b' + Math.min(k, c.bench.length); goto(211); }));
  }
  return {head: [title('PICK THE TEAM')], body, foot: ['[r]Red[w] = out of position. Tap to swap.'], fast: [['BEST XI', () => { autoPick(c); save(); G.note = 'Assistant has picked the strongest team.'; }], ['MATCH DAY', 110], ['SQUAD', 200], INDEX]};
}
function choosePage() {
  const c = me(), k = G.slot;
  if (k == null) return {head: [title('CHOOSE A PLAYER')], body: ['', '[w]Pick a place on page 210 first.'], fast: [['TEAM', 210], null, null, INDEX]};
  const isBench = String(k)[0] === 'b', pos = isBench ? null : formSlots(c.formation)[k], cur = isBench ? c.bench[+String(k).slice(1)] : c.xi[k];
  const list = c.squad.map(P).filter(p => p && p.id !== cur).sort((a, b) => pos ? ovrOf(b, pos) - ovrOf(a, pos) : ovrOf(b) - ovrOf(a));
  const body = list.map(p => {
    const where = c.xi.includes(p.id) ? '[c]XI ' : c.bench.includes(p.id) ? '[c]SUB' : '   ', bad = p.inj || p.sus;
    const row = `${posT(p.pos)} [w]${pad(nm(p), 14)}${rat(p, pos || p.pos)} ${fitT(p.fit)} ${where} ${statusT(p)}`;
    return bad ? row.replace(/\[w\]/, '[b]') : T(row, () => { if (choosePlayer(k, p.id)) goto(210); });
  });
  if (isBench && cur != null) body.push('', T(choice('Leave this place empty'), () => { c.bench.splice(+String(k).slice(1), 1); save(); goto(210); }));
  return {head: [title(isBench ? 'PICK A SUBSTITUTE' : `WHO PLAYS ${POS_NAME[pos].toUpperCase()}?`), cur != null ? `[c]Now: [w]${nm(P(cur))}` : ''], body, fast: [['TEAM', 210], null, null, INDEX]};
}

// ---------- 300: latest scores
function scoresPage() {
  const lw = W.lastWeek, c = me();
  if (!lw) return {head: [title('LATEST SCORES')], body: ['', '[w]No games played yet this season.'], fast: [PLAY(), ['TABLE', 301 + c.div], ['FIXTURES', 310], INDEX]};
  const line = r => { const mine = r.h === c.id || r.a === c.id; return `${mine ? '[y]' : '[w]'}${clubN(r.h, 16)} ${lpad(r.hg, 2)}-${pad(r.ag + (r.pens ? 'p' : ''), 3)}${clubN(r.a, 16)}`; };
  const body = [];
  if (lw.cup) { body.push(`[c]${clean(lw.label || CUP_NAME).toUpperCase()}`); lw.results.forEach(r => body.push(line(r))); }
  else [c.div].concat([0, 1, 2, 3].filter(d => d !== c.div)).forEach(d => { body.push(`[c]${DIVS[d].toUpperCase()}`); lw.results.filter(r => r.d === d).forEach(r => body.push(line(r))); });
  const m = W.lastMoney;
  const foot = m ? [`[w]${m.home && m.gate ? `Gate [g]${money(m.gate)}[w] (${m.att.toLocaleString()}). ` : m.gate ? `Gate share [g]${money(m.gate)}[w]. ` : ''}Wages [r]${money(m.wages)}[w]. TV [g]${money(m.tv)}`] : [];
  return {head: [title('LATEST SCORES'), `[c]${dateOf(W.season, lw.w).toUpperCase()}`], body, foot, fast: [PLAY(), ['TABLE', 301 + c.div], ['FIXTURES', 310], INDEX]};
}

// ---------- 301-304: league tables
function tablePage(d) {
  const c = me(), t = table(d);
  const body = t.map((r, i) => {
    const up = (d > 0 && i < 2) || (d === 0 && i === 0), down = d < 3 && i >= 10, mine = r.id === c.id;
    return `${mine ? '[B]' : ''}[${up ? 'g' : down ? 'r' : 'w'}]${lpad(i + 1, 2)} ${mine ? '[y]' : '[w]'}${clubN(r.id, 16)}${lpad(r.p, 3)}${lpad(r.w, 3)}${lpad(r.d, 3)}${lpad(r.l, 3)}${lpad((r.f - r.a > 0 ? '+' : '') + (r.f - r.a), 4)} [y]${lpad(r.pts, 3)}`;
  });
  return {head: [title(DIVS[d].toUpperCase()), '[c] # TEAM              P  W  D  L  GD PTS'], body,
    foot: [`[g]Green[w] = ${d ? 'promoted' : 'champions'}${d < 3 ? '   [r]Red[w] = relegated' : ''}`],
    fast: [PLAY(), ['< DIV', 301 + (d + 3) % 4], ['DIV >', 301 + (d + 1) % 4], INDEX]};
}

// ---------- 310: fixtures, 320: the cup, 330: top scorers
function fixturesPage() {
  const c = me(), body = [];
  W.cal.forEach((e, w) => {
    const now = w === W.week, day = pad(shortDate(W.season, w), 6), comp = e.t === 'L' ? '[w]LGE' : `[m]${['R1 ', 'R2 ', 'R3 ', 'QF ', 'SF ', 'FIN'][e.r]}`;
    let opp = null, home = false, res = null;
    if (e.t === 'L') { const f = W.fix[c.div][e.r].find(([h, a]) => h === c.id || a === c.id); if (f) { home = f[0] === c.id; opp = home ? f[1] : f[0]; res = W.res.find(r => r.w === w && (r.h === c.id || r.a === c.id)); } }
    else {
      const rd = W.cup.log[e.r], t = rd ? rd.find(t => t.h === c.id || t.a === c.id) : W.cup.r === e.r ? W.cup.ties.map(([h, a]) => ({h, a})).find(t => t.h === c.id || t.a === c.id) : null;
      if (t) { home = t.h === c.id; opp = home ? t.a : t.h; if (rd) res = t; }
    }
    const mark = now ? '[y]>' : ' ';
    if (opp == null) {
      const alive = W.cup.winner == null && W.cup.alive.concat(W.cup.r === 0 ? W.cup.byes : []).includes(c.id);
      body.push(`${mark}[w]${day} ${comp} [b]${e.t === 'C' ? (W.cup.r > e.r || !alive ? (e.r === 0 && W.cup.byes.includes(c.id) ? 'Bye to round two' : 'Not involved') : 'Draw to come') : '-'}`); return;
    }
    let out;
    if (res) { const gf = home ? res.hg : res.ag, ga = home ? res.ag : res.hg, wl = res.win != null ? (res.win === c.id ? 'W' : 'L') : gf > ga ? 'W' : gf < ga ? 'L' : 'D'; out = `[${wl === 'W' ? 'g' : wl === 'L' ? 'r' : 'y'}]${wl} ${gf}-${ga}${res.pens ? 'p' : ''}`; }
    else { const oc = C(opp), op = posIn(opp), hard = oc.div < c.div || (oc.div === c.div && op <= 3), easy = oc.div > c.div || (oc.div === c.div && op >= 10); out = hard ? '[r]HARD' : easy ? '[g]EASY' : '[y]FAIR'; }
    body.push(`${mark}[w]${day} ${comp} [c]${home ? 'H' : 'A'} [w]${clubN(opp, 17)} ${out}`);
  });
  return {head: [title('YOUR FIXTURES')], body, focus: W.week, fast: [PLAY(), ['CUP', 320], ['TABLE', 301 + c.div], INDEX]};
}
function cupPage() {
  const cup = W.cup, c = me(), body = [];
  if (cup.winner != null) body.push(`[y]${clean(C(cup.winner).name)} won the cup!`, '');
  else {
    const wk = W.cal.findIndex(e => e.t === 'C' && e.r === cup.r);
    body.push(`[c]${CUP_ROUNDS[cup.r].toUpperCase()} DRAW${wk >= 0 ? ', ' + shortDate(W.season, wk).toUpperCase() : ''}`);
    if (cup.r === 0) body.push('[w]The top 16 clubs have byes.');
    cup.ties.forEach(([h, a]) => body.push(`${h === c.id || a === c.id ? '[y]' : '[w]'}${clubN(h, 18)} v ${clubN(a, 18)}`));
    body.push('');
  }
  cup.log.map((rd, i) => [rd, i]).reverse().forEach(([rd, i]) => {
    body.push(`[c]${CUP_ROUNDS[i].toUpperCase()}`);
    rd.forEach(r => body.push(`${r.h === c.id || r.a === c.id ? '[y]' : '[w]'}${clubN(r.h, 16)} ${lpad(r.hg, 2)}-${pad(r.ag + (r.pens ? 'p' : ''), 3)}${clubN(r.a, 16)}`));
  });
  return {head: [title(CUP_NAME.toUpperCase()), '[w]Every club in the land. Six rounds.'], body, fast: [PLAY(), ['FIXTURES', 310], null, INDEX]};
}
function scorersPage() {
  const c = me(), d = G.sd ?? c.div;
  const ps = Object.values(W.players).filter(p => p.club >= 0 && C(p.club).div === d && p.s.gl).sort((a, b) => b.s.gl - a.s.gl || a.s.ap - b.s.ap).slice(0, 30);
  const body = ps.map((p, i) => `${p.club === c.id ? '[y]' : '[w]'}${lpad(i + 1, 2)} ${pad(nm(p), 15)} ${pad(C(p.club).short, 4)}${posT(p.pos)} [w]${lpad(p.s.ap, 4)} [y]${lpad(p.s.gl, 4)}`);
  if (!body.length) body.push('[w]No goals yet.');
  return {head: [title('TOP SCORERS'), `[c]${DIVS[d].toUpperCase()}`, '[c]   PLAYER          CLUB    APPS GOALS'], body,
    fast: [PLAY(), ['< DIV', () => { G.sd = (d + 3) % 4; G.sub = 0; }], ['DIV >', () => { G.sd = (d + 1) % 4; G.sub = 0; }], INDEX]};
}

// ---------- 400: transfer market, 401: free agents, 410: make an offer
const TRAIN_SHORT = {balanced: 'A bit of everything.', attack: 'Finishing drills.', defence: 'Tackling and shape.', passing: 'Rondos and one-twos.', fitness: 'Laps. Faster recovery.', rest: 'Feet up. No progress.'};
const MPOS = ['ALL', 'GK', 'DF', 'MF', 'FW'];
function marketPage(free) {
  const c = me(), pos = G.mpos || 'ALL';
  let list = Object.values(W.players).filter(p => p.club !== c.id && (free ? p.club < 0 : p.club >= 0));
  if (pos !== 'ALL') list = list.filter(p => p.pos === pos);
  if (G.afford !== false && !free) list = list.filter(p => askingPrice(p) <= Math.max(0, c.cash));
  list.sort((a, b) => ovrOf(b) - ovrOf(a));
  const body = list.slice(0, 40).map(p => T(`${posT(p.pos)} [w]${pad(nm(p), 13)} ${lpad(p.age, 2)} [c]${pad(free ? '' : C(p.club).short, 3)}${rat(p)} [w]${lpad(money(free ? wageDemand(p, c.div) : askingPrice(p)), 6)}${free ? '/wk' : ''}${p.listed ? '[c]L' : ''}`, () => { G.target = p.id; goto(410); }));
  if (!body.length) body.push('[w]Nobody matches.');
  return {head: [title(free ? 'FREE AGENTS' : 'TRANSFER MARKET'), `[c]Budget [${c.cash < 0 ? 'r' : 'g'}]${money(c.cash)}[c]  Squad [w]${c.squad.length}/26`, `[c]Showing [w]${pos === 'ALL' ? 'all positions' : POS_NAME[pos] + 's'}${free ? '' : G.afford !== false ? ', ones you can afford' : ', any price'}`],
    body, foot: ['[w]Tap a player to make an offer.'],
    fast: [['POSITION', () => { G.mpos = cycle(MPOS, pos); G.sub = 0; }], free ? ['MARKET', 400] : [G.afford !== false ? 'ANY PRICE' : 'AFFORDABLE', () => { G.afford = G.afford === false; G.sub = 0; }], free ? null : ['FREE AGENTS', 401], INDEX]};
}
function offerPage() {
  const c = me(), p = G.target != null ? P(G.target) : null;
  if (!p || p.club === c.id && !(talks[p.id] && talks[p.id].done)) return {head: [title('MAKE AN OFFER')], body: ['', '[w]Pick a player on 400 or 401 first.'], fast: [['MARKET', 400], ['FREE AGENTS', 401], null, INDEX]};
  const free = p.club < 0 && !(talks[p.id] && talks[p.id].done), keys = p.pos === 'GK' ? [['gk', 'GK'], ['pas', 'KCK'], ['pac', 'AGI']] : [['pac', 'PAC'], ['tkl', 'TKL'], ['pas', 'PAS'], ['sho', 'SHO']];
  const wage = wageDemand(p, c.div);
  const body = [`[w]${POS_NAME[p.pos]}, age ${p.age}, ${p.club < 0 ? 'free agent' : clean(C(p.club).name)}`, `[c]RATING ${rat(p)}  ${keys.map(([k, n]) => `[c]${n} [w]${Math.round(p.a[k])}`).join(' ')}`];
  if (p.tr) body.push(`[m]* ${TRAITS[p.tr].n}`);
  body.push(`[c]VALUE [w]${money(valueOf(p))}${free ? '' : `  [c]ASKING [w]${money(askingPrice(p))}`}${p.listed ? ' [c](listed)' : ''}`, `[c]HE WANTS [w]${money(wage)} a week, 3 years`, `[c]YOUR BANK [${c.cash < 0 ? 'r' : 'g'}]${money(c.cash)}`, '');
  const t = free ? null : talkFor(p);
  if (t && t.done) { body.push('[g]' + t.done, '', T(choice('See your squad'), 200)); return {head: [title('SIGNED!', 'g')], body, fast: [['SQUAD', 200], ['MARKET', 400], null, INDEX]}; }
  if (c.squad.length >= 26) body.push('[r]Your squad is full (26).', '[w]Sell or release someone first.');
  else if (!willingToJoin(p)) body.push(`[r]He won't drop down to ${DIVS[c.div]}.`, '[w]Win promotion and try again!');
  else if (free) body.push(T(choice(`Sign him on a free at ${money(wage)}/wk`, 'g'), () => { signPlayer(p, 0); talks[p.id] = {done: `${nm(p)} has signed on a free!`}; }));
  else {
    body.push(`[c]${clean(C(p.club).name)} chairman:`);
    wrap('"' + t.said + '"', 38).forEach(l => body.push('[y] ' + l));
    if (t.dead) body.push('', '[r]Talks are over.');
    else {
      body.push(`[c]Patience [w]${'#'.repeat(t.patience)}${'.'.repeat(3 - t.patience)}`, '');
      [.8, .9, 1, 1.15].forEach(f => {
        const step = t.ask > 1e6 ? 50000 : t.ask > 1e5 ? 5000 : 1000, amt = Math.max(step, Math.round(t.ask * f / step) * step);
        body.push(amt > c.cash ? `[r]  ${money(amt)} (${Math.round(f * 100)}%): too much` : T(choice(`Offer ${money(amt)} (${Math.round(f * 100)}% of asking)`), () => makeOffer(p, f)));
      });
    }
  }
  return {head: [title(nm(p).toUpperCase())], body, fast: [['MARKET', 400], ['FREE AGENTS', 401], null, INDEX]};
}

// ---------- 500: finances, 510: training, 520: the board
function financePage() {
  const c = me(), wages = c.squad.reduce((s, id) => s + (P(id) ? P(id).wage : 0), 0), lh = W.lastHome, base = BASE_TICKET[c.div], m = W.lastMoney;
  const body = [`[c]BANK      [${c.cash < 0 ? 'r' : 'g'}]${money(c.cash)}`, `[c]WAGES     [w]${money(wages)} a week`, `[c]TV MONEY  [w]${money(TV[c.div])} a week`, ''];
  if (m) body.push('[c]LAST WEEK', `[w]  Gate ${money(m.gate)}  Wages -${money(m.wages)}  TV ${money(m.tv)}`, '');
  body.push(`[c]GROUND    [w]${c.cap.toLocaleString()} seats`);
  if (lh) { const full = Math.round(lh.att / lh.cap * 100); body.push(`[c]LAST CROWD[w] ${lh.att.toLocaleString()} [${full >= 100 ? 'g' : full >= 75 ? 'y' : 'r'}](${full}% full)`); if (lh.demand > lh.cap) body.push(`[y]  ${(lh.demand - lh.cap).toLocaleString()} fans were turned away.`); }
  body.push(`[c]TICKETS   [w]£${c.ticket} [c](league average £${base})`, '',
    c.ticket < base * 2 ? T(choice('Raise ticket prices by £1'), () => { c.ticket = clamp(c.ticket + 1, Math.ceil(base * .5), base * 2); save(); }) : '[w]  Tickets are at the most you can charge.',
    c.ticket > Math.ceil(base * .5) ? T(choice('Lower ticket prices by £1'), () => { c.ticket = clamp(c.ticket - 1, Math.ceil(base * .5), base * 2); save(); }) : '[w]  Tickets are at the cheapest.', '');
  wrap('Cheaper tickets fill the ground. Dearer ones earn more per fan.').forEach(l => body.push('[w]' + l));
  if (c.cash < 0) body.push('', '[r]You are in the red. The board are watching.');
  return {head: [title('FINANCES')], body, fast: [PLAY(), ['TRAINING', 510], ['THE BOARD', 520], INDEX]};
}
function trainingPage() {
  const t = W.training, body = ['[c]FOCUS'];
  Object.keys(TRAINING).forEach(k => body.push(T(`${t.focus === k ? '[g]*' : ' '} [w]${pad(TRAINING[k].n, 10)}[c]${TRAIN_SHORT[k]}`, () => { t.focus = k; save(); })));
  body.push('', '[c]INTENSITY');
  INTENSITY.forEach((n, i) => body.push(T(`${t.int === i ? '[g]*' : ' '} [w]${pad(n, 10)}[c]${['Fewer knocks, slower.', 'A sensible week.', 'Faster, more injuries.'][i]}`, () => { t.int = i; save(); })));
  body.push('');
  wrap('Young players improve fastest, and Wonderkids fastest of all. Players who are playing games learn a bit quicker.').forEach(l => body.push('[w]' + l));
  return {head: [title('TRAINING')], body, foot: ['[g]*[w] = this week. Tap to change.'], fast: [PLAY(), ['FINANCES', 500], ['SQUAD', 200], INDEX]};
}
function boardPage() {
  const c = me(), conf = W.board.conf, fans = W.fans ?? 60, col = v => v > 60 ? 'g' : v > 30 ? 'y' : 'r';
  const body = [`[c]TARGET  [y]${clean(W.board.txt)}`, `[c]NOW     [w]${ordinal(posIn(c.id))} in ${DIVS[c.div]}`, `[c]BOARD ${bar(conf, 100, 12, col(conf))} [w]${confWord(conf)}`, `[c]FANS  ${bar(fans, 100, 12, col(fans))} [w]${fansWord(fans)}`, ''];
  const r = C(rivalOf(c));
  if (r) { const d = derbyRec(); body.push(`[c]LOCAL RIVALS [w]${clean(r.name)}`, `[w]  in ${DIVS[r.div]}`, d.w + d.d + d.l ? `[w]  All-time [g]W${d.w} [y]D${d.d} [r]L${d.l}[w]  goals ${d.gf}-${d.ga}` : '[w]  No derbies yet in your time here.', ''); }
  body.push(`[c]CAREER  [w]${clean(W.name)}, ${W.career.seasons} season${W.career.seasons === 1 ? '' : 's'}, [y]${W.career.pts}[w] points`, '[c]TROPHIES');
  if (W.career.trophies.length) W.career.trophies.forEach(t => body.push('[y]  ' + clean(t))); else body.push('[w]  None yet.');
  if (W.history.length) { body.push('', '[c]SEASONS'); W.history.forEach(h => body.push(`[w]  ${seasonLabel(h.s)} ${pad(C(h.club).short, 4)}${pad(DIVS[h.div], 17)}${lpad(ordinal(h.pos), 5)}${lpad(h.pts, 4)}pts`)); }
  return {head: [title('THE BOARD')], body, fast: [PLAY(), ['FINANCES', 500], null, INDEX]};
}

// ---------- 600-603: end of season
function seasonPage(step) {
  const S = W.pendingSeason;
  if (!S) return {head: [title('END OF SEASON')], body: ['', '[w]The season is still going.'], fast: [PLAY(), null, null, INDEX]};
  const u = S.user, c = me(), body = [];
  const next = step === 1 && u.sacked ? 603 : step < 3 ? 600 + step + 1 : null;
  const go = next ? ['NEXT >', next] : u.sacked ? null : ['START SEASON', () => startNextSeason(null)];
  if (step === 0) {
    const ttl = u.pos === 1 ? 'CHAMPIONS!' : u.cupRound === 6 ? 'CUP WINNERS!' : u.pos <= 2 && u.div > 0 ? 'PROMOTED!' : `SEASON ${seasonLabel(S.season)}`;
    body.push(`[w]${clean(C(u.club).name)} finished`, DH(`[y]${ordinal(u.pos)} in ${DIVS[u.div]}`), `[w]${u.pts} points.`, `[w]${CUP_NAME}: ${u.cupRound === 6 ? '[y]WINNERS!' : `out in the ${(CUP_ROUNDS[Math.max(0, u.cupRound)] || 'early rounds').toLowerCase()}`}`, '');
    u.trophies.forEach(t => body.push('[y]* ' + clean(t)));
    wrap(u.verdict).forEach(l => body.push((u.sacked ? '[r]' : '[g]') + l));
    body.push(`[w]+${u.careerAdd} manager points (total ${W.career.pts})`, '', '[c]AWARDS');
    if (u.best && P(u.best)) body.push(`[w]Your player of the season: ${nm(P(u.best))}`);
    if (u.top && P(u.top[0])) body.push(`[w]Your top scorer: ${nm(P(u.top[0]))} (${u.top[1]})`);
    S.awards.forEach(a => body.push(`[c]${pad(['Prem', 'Div 1', 'Div 2', 'Div 3'][a.d], 6)}[w]${pad(clean(C(a.champ).name), 17)}${a.scorer && P(a.scorer[0]) ? ` ${pad(clean(P(a.scorer[0]).ln), 9)}${lpad(a.scorer[1], 3)}` : ''}`));
    if (S.cupWinner != null) body.push(`[c]${pad('Cup', 6)}[w]${clean(C(S.cupWinner).name)}`);
    return {head: [title(ttl)], body, fast: [go, null, null, null]};
  }
  if (step === 1) {
    body.push('[g]GOING UP');
    S.promoted.forEach(([id, d]) => body.push(`[w]  ${clubN(id, 22)} from ${['Prem', 'Div 1', 'Div 2', 'Div 3'][d]}`));
    body.push('', '[r]GOING DOWN');
    S.relegated.forEach(([id, d]) => body.push(`[w]  ${clubN(id, 22)} from ${['Prem', 'Div 1', 'Div 2', 'Div 3'][d]}`));
    if (u.retired) { body.push('', '[c]RETIRING'); wrap(u.retired.join(', ') + ' hung up their boots.').forEach(l => body.push('[w]' + l)); }
    if (!u.sacked && u.youth && u.youth.length) { body.push('', '[c]YOUTH INTAKE'); u.youth.map(P).filter(Boolean).forEach(p => body.push(`[w]  ${posT(p.pos)} [w]${pad(clean(p.fn + ' ' + p.ln), 20)} ${p.age}${rat(p)}`)); }
    return {head: [title('UPS AND DOWNS')], body, fast: [go, ['< BACK', 600], null, null]};
  }
  if (step === 2) {
    const exp = (u.expired || []).map(P).filter(p => p && p.club === c.id);
    if (!exp.length) body.push('[w]Nobody is out of contract this summer.');
    else {
      body.push('[w]Tap to choose who stays. The rest', '[w]leave on a free.', '');
      exp.forEach(p => body.push(T(`${W.renew[p.id] ? '[g]KEEP' : '[r]GO  '} ${posT(p.pos)} [w]${pad(nm(p), 13)}${lpad(p.age, 3)}${rat(p)} [w]${lpad(money(wageDemand(Object.assign({}, p, {club: c.id}), c.div)), 6)}/wk`, () => { W.renew[p.id] = !W.renew[p.id]; save(); })));
    }
    return {head: [title('CONTRACTS UP')], body, fast: [go, ['< BACK', 601], null, null]};
  }
  const offers = W.pendingOffers || [];
  if (u.sacked) body.push('[r]You have been sacked.', '[w]Pick your next club:', '');
  else if (offers.length) body.push('[w]Other chairmen have noticed you.', '[w]Fancy a move?', '');
  else body.push('[w]No other clubs have called this summer.', '');
  offers.forEach(id => body.push(T(choice(`${clean(C(id).name)} (${DIVS[C(id).div]})`, 'g'), () => startNextSeason(id))));
  if (!u.sacked) body.push('', T(choice(`Stay at ${clean(c.name)}`), () => startNextSeason(null)));
  return {head: [title(u.sacked ? 'JOB CENTRE' : 'JOB OFFERS')], body, fast: [go, ['< BACK', u.sacked ? 601 : 602], null, null]};
}

// ---------- 700: how to use it
function helpPage() {
  const body = ['[y]Every screen is a page with a number.', '[w]Type a number on the keypad to go', '[w]there. [c]100[w] is the index. Tap any', '[c]blue-green page number[w] to jump to it.', '',
    '[y]The four coloured buttons[w] do what the', '[w]coloured words at the bottom say.', '[r]RED[w] nearly always carries on: it plays', '[w]the next game or moves the season on.', '',
    '[y]Tap a line with [y]>[w] to choose it.', '[y]< >[w] turn the page when it says 1/2.', '[y]BACK[w] goes to the last page you saw.', '',
    '[c]On a keyboard:[w] type page numbers,', '[w]R G Y B for the coloured buttons, arrow', '[w]keys and Enter to choose, Esc for back.', ''];
  if (W) body.push(T(`[c]SOUND ${yesNo(W.settings.sound !== false)}  [y]> change`, () => { W.settings.sound = W.settings.sound === false; save(); }));
  return {head: [title('HOW TO USE PIXTEXT')], body, fast: [W ? PLAY() : ['NEW CAREER', 800], null, null, INDEX]};
}

// ---------- 800: new career, 801-804: pick a club
const DIFF = ['Hard: big crowds, big egos', 'Tricky: push for the top flight', 'Medium: a proper challenge', 'Classic: start at the bottom'];
function newCareerPage() {
  G.newName = G.newName || 'The Gaffer';
  const body = [T(`[c]YOUR NAME [w]${pad(clean(G.newName), 16)} [y]> change`, () => { const n = prompt('Your name, gaffer?', G.newName); if (n && n.trim()) G.newName = n.trim().slice(0, 16); }), '', '[w]Pick a division to choose your club.', '[w]New to this? Start in Division Three.', ''];
  DIVS.forEach((d, i) => body.push(T(`[c]${801 + i} [y]${pad(d, 17)}[w]${DIFF[i].split(':')[0]}`, 801 + i), `[w]      ${DIFF[i].split(': ')[1]}`));
  if (W) body.push('', '[r]Starting a new career replaces the one', '[r]you have saved now.');
  return {head: [title('NEW CAREER')], body, fast: [['DIV THREE', 804], null, null, INDEX]};
}
function clubPickPage(d) {
  const body = [`[w]${DIFF[d]}.`, '[w]Tap a club, then take the job.', ''];
  CLUBS.forEach((c, i) => { if (Math.floor(i / 12) !== d) return; const sel = G.pick === i; body.push(T(`${sel ? '[G][k]>' : ' [w]'}${pad(c[0], 24)}${sel ? '[k]' : '[c]'}${c[1]}`, () => { G.pick = i; })); });
  const sel = G.pick != null && Math.floor(G.pick / 12) === d;
  if (sel) body.push('', T(choice(`TAKE THE JOB AT ${CLUBS[G.pick][0].toUpperCase()}`, 'g'), startPicked));
  return {head: [title(DIVS[d].toUpperCase())], body, fast: [sel ? ['TAKE THE JOB', startPicked] : null, ['< DIV', 801 + (d + 3) % 4], ['DIV >', 801 + (d + 1) % 4], ['NEW CAREER', 800]]};
}
function startPicked() {
  newCareer(G.newName || 'The Gaffer', G.pick);
  G.pick = null; G.hist = []; LM = null; G.ftm = null; G.scen = null; G.msg = null;
  goto(100);
}

const PAGES = {
  101: inboxPage, 102: scenPage, 110: matchDayPage, 111: livePage, 112: touchlinePage, 113: fullTimePage,
  200: squadPage, 210: teamPage, 211: choosePage, 300: scoresPage, 310: fixturesPage, 320: cupPage, 330: scorersPage,
  400: () => marketPage(false), 401: () => marketPage(true), 410: offerPage, 500: financePage, 510: trainingPage, 520: boardPage,
  600: () => seasonPage(0), 601: () => seasonPage(1), 602: () => seasonPage(2), 603: () => seasonPage(3),
};
