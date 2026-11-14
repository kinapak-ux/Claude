// Pixel Gaffer '96: screens, the live match and the weekly flow.
'use strict';
const SAVE = 'pixelgaffer-save', BEST = 'pixelgaffer-best';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const UI = {slot: 1, screen: 'title', tab: 'home', lt: 'table', ld: null, mkt: {pos: 'ALL', view: 'all', afford: false}, sel: null, modal: null};
const lget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
function save() { if (!W) return; W.nextId = NEXT_ID; lset(slotKey(UI.slot), W); lset('pixelgaffer-slot', UI.slot); }
function loadSave(n) { const w = lget(slotKey(n || UI.slot), null); if (!w || !w.clubs) return null; return w; }
const anySave = () => [1, 2, 3].some(n => slotInfo(n));
const best = () => lget(BEST, {keepy: 0, fk: 0, pens: 0});
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

// ---------- little view helpers
const ovrCol = o => o >= 80 ? 'c-c' : o >= 65 ? 'c-g' : o >= 50 ? 'c-y' : o >= 35 ? 'c-o' : 'c-r';
const posTag = pos => `<span class="pos p-${pos}">${pos}</span>`;
const bar = (v, max, cls) => `<span class="bar ${cls || ''}"><i style="width:${clamp(v / max * 100, 0, 100)}%"></i></span>`;
const fitCls = f => f >= 85 ? 'g' : f >= 65 ? 'y' : 'r';
const moraleWord = m => m >= 85 ? 'Superb' : m >= 65 ? 'Good' : m >= 45 ? 'OK' : m >= 25 ? 'Low' : 'Angry';
const formArrow = f => f >= 1.2 ? '<span class="c-g">▲</span>' : f <= -1.2 ? '<span class="c-r">▼</span>' : '<span class="c-d">►</span>';
const stars = p => { const n = clamp(1 + Math.round((p.pot - ovrOf(p)) / 1.4), 1, 5); return `<span class="pips">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(5 - n)}</span>`; };
const status = p => (p.inj ? `<span class="tag r">INJ ${p.inj}w</span>` : '') + (p.sus ? `<span class="tag o">SUS ${p.sus}</span>` : '') + (p.listed ? '<span class="tag c">LIST</span>' : '') + (p.con <= 0 ? '<span class="tag y">CON</span>' : '') + (p.grew ? `<span class="tag g">+${p.grew}</span>` : '');
const clubName = id => id < 0 ? 'Free agent' : C(id).name;
const seasonLabel = s => `${START_YEAR + s}/${String(START_YEAR + s + 1).slice(2)}`;
const kitOf = c => ({shirt: c.c1, shorts: c.c2});
function portrait(p, size) {
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 10;
  const g = cv.getContext('2d'), c = p.club >= 0 ? C(p.club) : {c1: '#888', c2: '#333'};
  const skin = SKIN[p.id % SKIN.length], hair = HAIR[(p.id >> 2) % HAIR.length];
  g.fillStyle = p.pos === 'GK' ? '#33d17a' : c.c1; g.fillRect(1, 7, 6, 3);
  g.fillStyle = c.c2; g.fillRect(3, 7, 2, 1);
  g.fillStyle = skin; g.fillRect(2, 2, 4, 5); g.fillRect(3, 7, 2, 0);
  g.fillStyle = hair; g.fillRect(2, 1, 4, 2); if (p.id % 3 === 0) g.fillRect(1, 2, 1, 3);
  g.fillStyle = '#111'; g.fillRect(3, 4, 1, 1); g.fillRect(5, 4, 1, 1);
  g.fillStyle = p.mor >= 60 ? '#7a2a2a' : '#4a2a2a'; g.fillRect(3, 6, p.mor >= 60 ? 2 : 1, 1);
  return `<img class="face" src="${cv.toDataURL()}" width="${size || 64}" height="${(size || 64) * 10 / 8}" alt="">`;
}

// ---------- rendering
function render() {
  const app = $('#app');
  document.body.dataset.screen = UI.screen; document.body.dataset.tab = UI.screen === 'game' ? UI.tab : '';
  stopTitle();
  switch (UI.screen) {
    case 'title': app.innerHTML = titleHTML(); startTitle(); break;
    case 'new': app.innerHTML = newHTML(); break;
    case 'arcade': app.innerHTML = arcadeHTML(); break;
    case 'game': app.innerHTML = headerHTML() + `<div id="main">${tabHTML()}</div>` + navHTML(); break;
    case 'prematch': app.innerHTML = prematchHTML(); break;
    case 'match': break;
    case 'week': app.innerHTML = weekHTML(); break;
    case 'season': app.innerHTML = seasonHTML(); break;
    case 'sacked': app.innerHTML = sackedHTML(); break;
    case 'deadline': app.innerHTML = deadlineHTML(); break;
  }
  if (UI.screen !== 'match') window.scrollTo(0, UI.keepScroll || 0);
  UI.keepScroll = 0;
  MUSIC.want(['title', 'arcade', 'new'].includes(UI.screen) ? 'title' : UI.screen === 'season' ? 'anthem' : null);
  if (UI.screen !== 'title') pushNav();
  const tc = $('#trophycv'); if (tc) trophyScene(tc, kitOf(C(UI.season.user.club)), tc.dataset.title);
}
// the phone's back button moves back through the game instead of leaving it
function pushNav() { if (!history.state || !history.state.pg) history.pushState({pg: 1}, ''); }
function handleBack() {
  const mb = document.querySelector('.mini .mback'); if (mb) { mb.click(); return true; }
  if (UI.tour != null) { endTour(); return true; }
  if (UI.modal) {
    if (LM && UI.screen === 'match') { if (!document.querySelector('[data-a=talk]')) ACT.mResume(); return true; }
    if (document.querySelector('.scen')) return true;
    ACT.close(); return true;
  }
  switch (UI.screen) {
    case 'match': case 'ft': case 'week': case 'season': case 'deadline': return true;
    case 'prematch': ACT.backToGame(); return true;
    case 'new': case 'arcade': ACT.toTitle(); return true;
    case 'game': if (UI.tab !== 'home') { UI.tab = UI.tab === 'market' ? 'squad' : 'home'; render(); } else ACT.toTitle(); return true;
  }
  return false;
}
addEventListener('popstate', () => { if (handleBack()) pushNav(); });
// swipe left and right between the main screens
const NAV_ORDER = ['home', 'squad', 'tactics', 'league', 'club'];
const navParent = t => t === 'market' ? 'squad' : t === 'news' ? 'home' : t;
let swipe = null;
document.addEventListener('touchstart', e => { if (UI.screen !== 'game' || UI.modal || UI.tour != null || e.touches.length > 1 || (e.target.closest && e.target.closest('input,select,.mini'))) { swipe = null; return; } swipe = {x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now()}; }, {passive: true});
document.addEventListener('touchend', e => {
  if (!swipe) return; const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, dt = Date.now() - swipe.t; swipe = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || dt > 700) return;
  const i = NAV_ORDER.indexOf(navParent(UI.tab)), j = clamp(i + (dx < 0 ? 1 : -1), 0, NAV_ORDER.length - 1);
  if (j !== i) { UI.tab = NAV_ORDER[j]; UI.sel = null; render(); }
}, {passive: true});
function rerender() { UI.keepScroll = window.scrollY; render(); }
function tabHTML() {
  switch (UI.tab) {
    case 'home': return homeHTML();
    case 'squad': return squadHTML();
    case 'tactics': return tacticsHTML();
    case 'league': return leagueHTML();
    case 'market': return marketHTML();
    case 'club': return clubHTML();
    case 'news': return newsHTML();
  }
  return '';
}

// ---------- title screen with a little "attract mode" match behind the logo
let titleLoop = null;
function titleHTML() {
  UI.slot = lget('pixelgaffer-slot', 1);
  if (!slotInfo(UI.slot)) UI.slot = [1, 2, 3].find(n => slotInfo(n)) || UI.slot;
  const cur = slotInfo(UI.slot), has = !!cur, many = [1, 2, 3].filter(n => slotInfo(n)).length;
  return `<div class="title">
    <canvas id="tpitch" class="tpitch"></canvas>
    <h1 class="logo"><span>PIXEL</span><span>GAFFER</span><small>'96</small></h1>
    <p class="tag-line">Football management, the old-fashioned way.</p>
    <div class="menu">
      ${has ? `<button class="btn go big" data-a="continueGame">▶ Continue: ${esc(cur.club.short)} ${seasonLabel(cur.season)}</button>` : ''}
      <button class="btn ${has ? '' : 'go big'}" data-a="newGame">New career</button>
      ${many ? `<button class="btn" data-a="slots">Saved careers (${many})</button>` : ''}
      <button class="btn" data-a="arcade">Arcade mini-games</button>
      <div class="menu2"><button class="btn ghost small" data-a="howto">How to play</button><button class="btn ghost small" data-a="achs">🏆 Achievements</button><button class="btn ghost small" data-a="musicToggle">${MUSIC.on ? '♪ Music on' : '♪ Music off'}</button></div>
    </div>
    <p class="foot">48 clubs · 4 divisions · the ${CUP_NAME}<br>${window.FamilyScores ? '<a href="../">← Family Games</a>' : `<a href="privacy.html">Privacy</a> · v${window.APP_VERSION || '1.0'}`}</p>
  </div>`;
}
function startTitle() {
  const cv = $('#tpitch'); if (!cv) return;
  const a = pick(CLUBS.map((c, i) => ({id: i, c1: c[2], c2: c[3]}))), b = pick(CLUBS.map((c, i) => ({id: i, c1: c[2], c2: c[3]})));
  const p = new Pitch(cv, a, b, [pick(Object.keys(FORMS)), pick(Object.keys(FORMS))]);
  let last = performance.now(), next = 0;
  const loop = now => {
    const dt = Math.min(50, now - last); last = now;
    if (p.t >= next) { const sh = R() < .2 ? pick(['goal', 'save', 'miss']) : null, s = R() < .5 ? 0 : 1; p.playMinute({poss: s, shot: sh, shotSide: s}, 1400); if (sh === 'goal') setTimeout(() => p.banner('GOAL!'), 1300); next = p.t + 1500; }
    p.update(dt); p.draw();
    titleLoop = requestAnimationFrame(loop);
  };
  titleLoop = requestAnimationFrame(loop);
}
function stopTitle() { if (titleLoop) cancelAnimationFrame(titleLoop); titleLoop = null; }

// ---------- new career
function newHTML() {
  const sel = UI.newClub;
  const byDiv = [0, 1, 2, 3].map(d => CLUBS.map((c, i) => ({i, c, d: Math.floor(i / 12)})).filter(x => x.d === d));
  const diff = ['Hard: big crowds, big egos, big expectations', 'Tricky: push for the top flight', 'Medium: a proper lower-league challenge', 'Classic: start at the bottom and climb!'];
  return `<div class="top-simple"><button class="btn ghost small" data-a="toTitle">← Back</button><h2 class="px">NEW CAREER</h2></div>
  <div class="panel"><h2>Your name, gaffer</h2><input id="mname" class="txt" maxlength="16" placeholder="e.g. Big Ron" value="${esc(UI.newName || (window.FamilyScores && FamilyScores.name()) || '')}"></div>
  <div class="panel"><h2>Pick your club</h2><p class="note">New to this? Start in <b>Division Three</b> and climb the leagues.</p>
  ${byDiv.map((list, d) => `<h3 class="divh">${DIVS[d]} <small>${diff[d]}</small></h3><div class="clubgrid">${list.map(({i, c}) => `<button class="clubpick ${sel === i ? 'on' : ''}" data-a="pickClub" data-id="${i}">${badgeImg({id: i, c1: c[2], c2: c[3], pat: c[4]}, 22)}<span>${esc(c[0])}</span></button>`).join('')}</div>`).join('')}
  </div>
  <div class="sticky"><button class="btn go big wide" data-a="startCareer" ${sel == null ? 'disabled' : ''}>${sel == null ? 'Pick a club' : `Take the job at ${esc(CLUBS[sel][0])} ▶`}</button></div>`;
}

// ---------- header and navigation
function headerHTML() {
  const c = me(), unread = W.inbox.filter(m => !m.read).length;
  const fx = W.week < W.cal.length ? userFixture() : null;
  return `<header class="hdr">
    <div class="hclub">${badgeImg(c, 26)}<div><b>${esc(c.name)}</b><small>${dateOf(W.season, W.week)} · ${DIVS[c.div]}</small></div></div>
    <div class="hcash ${c.cash < 0 ? 'c-r' : 'c-g'}">${money(c.cash)}</div>
    <button class="btn go nextbtn" data-a="go">${fx ? `PLAY<small>${derbyFx(fx) ? '🔥' : 'v'} ${esc(C(fx.h === c.id ? fx.a : fx.h).short)}${tacCheck(c, C(fx.h === c.id ? fx.a : fx.h)).st === 'bad' ? ' <i class="c-r">⚠</i>' : ''}</small>` : W.week >= W.cal.length ? 'SEASON<small>review</small>' : `NEXT<small>week</small>`}</button>
  </header>${unread ? '' : ''}`;
}
function navHTML() {
  const unread = W.inbox.filter(m => !m.read).length;
  const t = [['home', 'HOME'], ['squad', 'SQUAD'], ['tactics', 'TACTICS'], ['league', 'TABLES'], ['club', 'CLUB']], cur = navParent(UI.tab);
  return `<nav class="nav">${t.map(([k, n]) => `<button class="${cur === k ? 'on' : ''}" data-a="tab" data-t="${k}"><img src="${navIcon(k, cur === k ? '#ffd23f' : '#9aa6dd')}" alt="">${n}${k === 'home' && unread ? `<b class="dot">${unread}</b>` : ''}</button>`).join('')}</nav>`;
}

// ---------- HOME
function homeHTML() {
  const c = me(), fx = userFixture(), e = W.cal[W.week];
  const pos = posIn(c.id), tb = table(c.div), row = tb.find(r => r.id === c.id);
  let next;
  if (fx) {
    const opp = C(fx.h === c.id ? fx.a : fx.h), home = fx.h === c.id;
    next = `<div class="nextfx">${badgeImg(c, 40)}<div class="vs" data-a="viewOpp" data-id="${opp.id}"><small>${fx.cup ? esc(fx.label) : `${DIVS[c.div]} · Rd ${e.r + 1}`} · <b>${fx.neutral ? 'FINAL' : home ? 'HOME' : 'AWAY'}</b></small><span>${esc(opp.name)}</span><small>${[opp.foreign || opp.div !== c.div ? divName(opp) : '', opp.foreign ? '' : ordinal(posIn(opp.id)), 'form ' + formHTML(opp.formStr)].filter(Boolean).join(' · ')} · <span class="lnk">scout</span></small></div>${badgeImg(opp, 40)}</div>
      ${derbyFx(fx) ? derbyBanner(opp) : ''}${tacBox(c, opp)}
`;
  } else next = e.t === 'K' ? `<p>Midweek cup night${userComp() ? ` in the ${esc(userComp().name)}` : ''}, but you're not playing this round.</p><p class="note center">Tap <b class="c-g">NEXT</b> at the top to move on.</p>` : `<p>${e.t === 'C' ? `${CUP_NAME} ${cupRoundName()} day. ${W.cup.alive.includes(c.id) || W.cup.byes.includes(c.id) ? '' : "You're out, so the lads get a week off."}` : 'A week without a game.'}</p><p class="note center">Tap <b class="c-g">NEXT</b> at the top to move on.</p>`;
  const conf = W.board.conf, fans = W.fans ?? 60;
  const injured = c.squad.map(P).filter(p => p.inj || p.sus);
  const act = W.inbox.filter(m => m.act && !m.act.done), unread = W.inbox.filter(m => !m.read).length;
  const col = v => v > 60 ? 'g' : v > 30 ? 'y' : 'r';
  const posCls = pos <= 2 && c.div > 0 || pos === 1 ? 'c-g' : pos >= 11 && c.div < 3 ? 'c-r' : 'c-y';
  const lw = W.lastWeek, myRes = lw && lw.results.find(r => r.h === c.id || r.a === c.id);
  const ticker = [myRes ? `FT ${C(myRes.h).short} ${myRes.hg}-${myRes.ag} ${C(myRes.a).short}` : '', ...W.news.slice(0, 4).map(n => n.txt)].filter(Boolean).join('   ◆   ') || 'NO NEWS IS GOOD NEWS';
  const alerts = [
    act.length ? `<button class="hal r" data-a="tab" data-t="news">✉ ${act.length} to answer</button>` : '',
    injured.length ? `<button class="hal o" data-a="tab" data-t="squad">✚ ${injured.length} out</button>` : '',
  ].join('');
  // One screen, no scrolling: the next game, four tiles you can tap for detail, and a news ticker.
  return `<div class="home">
  <div class="panel hnext"><h2>Next up · ${dateOf(W.season, W.week)}</h2>${next}</div>
  ${alerts ? `<div class="halerts">${alerts}</div>` : ''}
  <div class="tiles">
    <button class="tile" data-a="tab" data-t="league"><span>League</span><b class="${posCls}">${row.p ? ordinal(pos) : '-'}</b><small>${row.pts} pts · P${row.p} ${formHTML(row.form.slice(-5))}</small></button>
    <button class="tile" data-a="tab" data-t="club"><span>Board</span>${bar(conf, 100, col(conf))}<small>${confWord(conf)}</small><small class="c-d">${esc(W.board.txt)}</small></button>
    <button class="tile" data-a="tab" data-t="club"><span>Fans</span>${bar(fans, 100, col(fans))}<small>${fansWord(fans)}</small></button>
    <button class="tile" data-a="tab" data-t="news"><span>Inbox</span><b class="${unread ? 'c-r' : 'c-d'}">${unread ? unread + ' new' : '0'}</b><small>${unread ? esc(W.inbox.find(m => !m.read).subj) : 'All read'}</small></button>
  </div>
  <div class="ddticker hticker" data-a="tab" data-t="news"><span class="ddbrk">PIXTEXT</span><div class="ddmarq"><span>${esc(ticker).toUpperCase()}</span></div></div>
  </div>`;
}
function lastResultsTTX() {
  const mine = W.lastWeek;
  if (!mine) return '';
  return `<div class="c-y" style="margin-top:6px">LATEST ${mine.cup ? CUP_NAME.toUpperCase() : DIVS[me().div].toUpperCase()}</div>` + mine.results.filter(r => mine.cup || r.d === me().div).slice(0, 6).map(r => resLine(r)).join('');
}
function resLine(r) {
  const mine = r.h === W.clubId || r.a === W.clubId;
  return `<div class="res ${mine ? 'mine' : ''}"><span>${esc(C(r.h).name)}</span><b>${r.hg}-${r.ag}</b><span>${esc(C(r.a).name)}</span>${r.pens ? `<small>(${r.pens[0]}-${r.pens[1]}p)</small>` : ''}</div>`;
}
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const formHTML = f => (f || '').slice(-5).split('').map(x => `<span class="fm ${x}">${x}</span>`).join('') || '<span class="c-d">-</span>';
// league position and last five results, shown beside a club's name on match screens
function teamTag(c) {
  const row = c.foreign ? null : table(c.div).find(r => r.id === c.id);
  const pos = row && row.p ? ordinal(posIn(c.id)) : c.foreign ? '' : '-';
  return `<span class="ttag">${pos ? `<i>${pos}</i>` : ''}${formHTML(c.formStr)}</span>`;
}
const fansWord = f => f >= 80 ? 'Singing your name' : f >= 60 ? 'Right behind you' : f >= 40 ? 'Restless' : f >= 20 ? 'Grumbling' : 'Calling for your head';
const confWord = c => c >= 80 ? 'Delighted' : c >= 60 ? 'Happy' : c >= 40 ? 'Watching closely' : c >= 20 ? 'Worried' : 'Your job is on the line';

// ---------- STADIUM
function stadiumHTML(c) {
  const g = ground(), lh = W.lastHome, lim = groundLimit(c), b = g.build;
  const away = lh ? Math.max(0, lh.demand - lh.cap) : 0, full = lh ? Math.round(lh.att / lh.cap * 100) : null;
  const crowd = !lh ? '<p class="note">No home game yet this job. Your first crowd will show how much demand there is.</p>'
    : `<div class="kv"><span>Last home crowd</span><b>${lh.att.toLocaleString()} <small class="${full >= 100 ? 'c-g' : full >= 75 ? 'c-y' : 'c-r'}">(${full}% full)</small></b><span>Fans who wanted in</span><b class="${away ? 'c-o' : ''}">${lh.demand.toLocaleString()}</b></div>
      <p class="note">${away ? `<b class="c-o">About ${away.toLocaleString()} fans were turned away.</b> Raise ticket prices (free, but fans grumble) or build more seats.` : full >= 95 ? 'Full, but not many locked out. More seats would sit empty for now.' : 'Empty seats. Cheaper tickets or better results will fill them; building would be wasted money.'}</p>`;
  const standBtn = k => { const s = GROUND.stands[k], cost = standCost(k, c), over = c.cap + s.add > lim;
    return `<button class="btn small" data-a="buildStand" data-k="${k}" ${over || c.cash < cost ? 'disabled' : ''}>${s.n}: +${s.add.toLocaleString()} seats · ${money(cost)} · ${s.wk} wks</button>`; };
  const upg = (k, name, now, desc) => { const lv = g[k], cost = upgradeCost(k, c);
    return `<div class="upg"><div><b>${name}</b> <span class="lvl">${'■'.repeat(lv)}${'□'.repeat(3 - lv)}</span><small>${now}</small></div>${lv < 3 ? `<button class="btn small" data-a="upgrade" data-k="${k}" ${c.cash < cost ? 'disabled' : ''}>${lv ? 'Upgrade' : 'Build'} · ${money(cost)}</button>` : '<span class="c-g">MAX</span>'}<p class="note">${desc}</p></div>`; };
  return `<div class="panel"><h2>Stadium</h2>
    <div class="kv"><span>Capacity</span><b>${c.cap.toLocaleString()}${b ? ` <small class="c-o">(${openSeats(c).toLocaleString()} open)</small>` : ''}</b><span>Ticket price</span><b>£${c.ticket} <small class="c-d">(max £${BASE_TICKET[c.div] * 2})</small></b></div>
    ${crowd}
    <h3 class="divh">Build seats</h3>
    ${b ? `<p>🏗 <b>${esc(b.n)}</b> going up: <b class="c-y">${b.wk} week${b.wk > 1 ? 's' : ''}</b> left, then +${b.add.toLocaleString()} seats. ${b.closed.toLocaleString()} seats are closed while the builders are in.</p>`
      : c.cap >= lim ? `<p class="note">The council won't allow a bigger ground in ${DIVS[c.div]} (limit ${lim.toLocaleString()}). Win promotion to build more, or earn more per fan below.</p>`
      : `<div class="acts col">${standBtn('small')}${standBtn('big')}</div><p class="note">Part of the ground closes during building. ${DIVS[c.div]} limit: ${lim.toLocaleString()}.</p>`}
    <h3 class="divh">Earn more per fan</h3>
    ${upg('boxes', 'Executive boxes', g.boxes ? `${money(boxIncome(c))} every home game` : 'Not built', 'Hospitality for local businesses. Pays every home game, full ground or not.')}
    ${upg('shop', 'Club shop', g.shop ? `about ${money(shopIncome(c))} a week` : 'Not built', 'Shirts and scarves. Weekly income that grows with ground size and happier fans.')}
  </div>`;
}

// ---------- DERBY UI
const derbyFx = fx => !!fx && isDerby(fx.h, fx.a);
function derbyBanner(opp, big) {
  const d = derbyRec(), all = d.w + d.d + d.l;
  return `<div class="derbyb${big ? ' big' : ''}"><b>🔥 DERBY DAY</b><span>${all ? `All-time v ${esc(opp.short)}: <i class="c-g">W${d.w}</i> <i class="c-y">D${d.d}</i> <i class="c-r">L${d.l}</i>` : `First derby against ${esc(opp.short)}`}</span>${big ? `<small>Bigger crowd, more cards. Win and the fans, board and squad all lift. Lose and you'll hear about it all week.</small>` : ''}</div>`;
}
function derbyPress(opp) {
  return pick([
    {q: `It's ${opp.short} on Saturday. What does this one mean to you?`, a: [['Everything. This town is ours.', 5, 1], ['Same three points as any other game.', 0, -1], ['Ask me after we beat them.', 3, 0]]},
    {q: `${opp.name}'s manager says your club is "the second team in town". Response?`, a: [["Check the history books, mate.", 4, 0], ['Let him talk. We will do ours on the pitch.', 2, 1], ['He might be right...', -4, -3]]},
    {q: `Fans want blood against ${opp.short}. Can you deliver?`, a: [["We'll run through walls for them.", 4, 1], ['We will stay calm and play our game.', 1, 1], ["I can't promise anything.", -2, -2]]},
  ]);
}
function rivalHTML(c) {
  const r = C(rivalOf(c)); if (!r) return '';
  const d = derbyRec(), all = d.w + d.d + d.l, same = r.div === c.div;
  return `<div class="panel"><h2>Local rivals</h2><div class="nextfx" style="justify-content:flex-start;text-align:left">${badgeImg(r, 36)}<div class="vs"><b>${esc(r.name)}</b><small>${DIVS[r.div]}${same ? ` · ${ordinal(posIn(r.id))}` : ''}</small></div></div>
    ${all ? `<div class="kv"><span>All-time</span><b><span class="c-g">W${d.w}</span> <span class="c-y">D${d.d}</span> <span class="c-r">L${d.l}</span></b><span>Goals</span><b>${d.gf}-${d.ga}</b><span>This season</span><b>${d.sw}W ${d.sd}D ${d.sl}L</b></div>` : '<p class="note">No derbies played yet in your time here.</p>'}
    <p class="note">${same ? 'Two league derbies a season. Beat them home and away for the derby double.' : r.div < c.div ? `They're in a higher league. Win promotion to bring the derby back.` : `They're a league below. The derby returns if they come up, or if you meet in a cup.`}</p></div>`;
}

// ---------- TACTICS CHECK: shown on Home and Match Day so you can't forget to counter the opponent
function tacCheck(c, opp) {
  const counters = Object.keys(STYLES).filter(s => BEATS[s].includes(opp.style));
  return {st: BEATS[c.style].includes(opp.style) ? 'good' : BEATS[opp.style].includes(c.style) ? 'bad' : 'even', counters};
}
function tacBox(c, opp) {
  const t = tacCheck(c, opp), us = STYLES[c.style].n, them = STYLES[opp.style].n;
  const msg = t.st === 'good' ? `✓ Your ${us} should beat their ${them}.` : t.st === 'bad' ? `⚠ Their ${them} beats your ${us}!` : `= Your ${us} v their ${them}: no edge either way.`;
  return `<div class="taccheck ${t.st}"><small>TACTICS CHECK · ${esc(opp.short)} play ${them}</small><b>${msg}</b>${t.st === 'good' ? '' : `<div class="chips small">${t.counters.map(s => `<button class="chip" data-a="style" data-s="${s}">Switch to ${STYLES[s].n}</button>`).join('')}</div>`}</div>`;
}
function tacWarn(mode) {
  const fx = UI.fx, c = me(), opp = C(fx.h === c.id ? fx.a : fx.h), t = tacCheck(c, opp), key = W.season * 100 + W.week;
  if (t.st !== 'bad' || UI.tacOk === key) return false;
  modal(`<div class="scen"><div class="scenh"><span>⚠ Assistant manager</span></div>
    <p class="scenr">"Gaffer, ${esc(opp.name)} play <b>${STYLES[opp.style].n}</b>, and that beats our <b>${STYLES[c.style].n}</b>. Want to switch?"</p>
    <div class="answers">${t.counters.map(s => `<button class="btn go" data-a="tacFix" data-s="${s}" data-m="${mode}">Switch to ${STYLES[s].n}</button>`).join('')}<button class="btn" data-a="tacAnyway" data-m="${mode}">Keep ${STYLES[c.style].n} and play</button></div></div>`);
  return true;
}

// ---------- SQUAD
// three views of the same squad (overview / contract / season), sortable by tapping a column header
const SQ_VIEWS = [['ovr', 'Overview'], ['con', 'Contract'], ['sea', 'Season']];
const sqAvg = p => p.s.ap ? p.s.rt / p.s.ap : 0;
const SQ_COLS = {
  ovr: [['age', 'Age', p => p.age, p => p.age],
        ['rat', 'Rat', p => ovr(p), p => `<span class="${ovrCol(ovr(p))}">${ovr(p)}</span>`],
        ['fit', 'Fit', p => p.fit, p => bar(p.fit, 100, fitCls(p.fit))],
        ['fm', 'Fm', p => p.form, p => formArrow(p.form)]],
  con: [['wage', 'Wage', p => p.wage, p => money(p.wage)],
        ['con', 'Con', p => p.con, p => p.loanFrom != null ? '<span class="c-m">Loan</span>' : p.con <= 0 ? '<span class="c-r">Exp</span>' : `<span class="${p.con === 1 ? 'c-o' : ''}">${p.con}y</span>`],
        ['val', 'Value', p => valueOf(p), p => money(valueOf(p))]],
  sea: [['ap', 'Ap', p => p.s.ap, p => p.s.ap || '<span class="c-d">0</span>'],
        ['gl', 'Gl', p => p.s.gl, p => p.s.gl || '<span class="c-d">0</span>'],
        ['as', 'As', p => p.s.as, p => p.s.as || '<span class="c-d">0</span>'],
        ['avg', 'Avg', sqAvg, p => p.s.ap ? `<span class="${sqAvg(p) >= 7.2 ? 'c-g' : sqAvg(p) < 6.2 ? 'c-r' : ''}">${sqAvg(p).toFixed(1)}</span>` : '<span class="c-d">-</span>']]
};
function squadHTML() {
  const c = me(), view = UI.sqv || 'ovr', cols = SQ_COLS[view], srt = UI.sqs;
  const list = c.squad.map(P).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || ovrOf(b) - ovrOf(a));
  const sc = srt && Object.values(SQ_COLS).flat().find(x => x[0] === srt.k);
  if (sc) list.sort((a, b) => (sc[2](b) - sc[2](a)) * srt.d || POS.indexOf(a.pos) - POS.indexOf(b.pos));
  const n = list.length || 1, wages = list.reduce((s, p) => s + p.wage, 0), value = list.reduce((s, p) => s + valueOf(p), 0);
  const avgAge = list.reduce((s, p) => s + p.age, 0) / n, avgRat = list.reduce((s, p) => s + ovr(p), 0) / n;
  const tvPct = Math.round(TV[c.div] / Math.max(1, wages) * 100), expiring = list.filter(p => p.loanFrom == null && p.con <= 1).length;
  const top = list.filter(p => p.s.gl).sort((a, b) => b.s.gl - a.s.gl)[0];
  const head = (k, label) => `<th data-a="sqSort" data-k="${k}" class="srt${srt && srt.k === k ? ' on' : ''}">${label}${srt && srt.k === k ? (srt.d > 0 ? '▼' : '▲') : ''}</th>`;
  return `<div class="subtabs"><button class="${UI.tab === 'squad' ? 'on' : ''}" data-a="tab" data-t="squad">My squad</button><button class="${UI.tab === 'market' ? 'on' : ''}" data-a="tab" data-t="market">Transfer market</button></div><div class="panel sqpanel"><h2>First-team squad (${list.length})</h2>
  <div class="sqsum">
    <div><span>Wages/wk</span><b>${money(wages)}</b><i class="${tvPct >= 100 ? 'c-g' : tvPct >= 50 ? 'c-y' : 'c-r'}">TV covers ${tvPct}%</i></div>
    <div><span>Squad value</span><b>${money(value)}</b><i>${expiring ? `<span class="c-o">${expiring} expiring soon</span>` : 'Contracts OK'}</i></div>
    <div><span>Avg age</span><b>${avgAge.toFixed(1)}</b><i>U21s: ${list.filter(p => p.age <= 21).length}</i></div>
    <div><span>Avg rating</span><b class="${ovrCol(Math.round(avgRat))}">${Math.round(avgRat)}</b><i>${top ? `Top scorer ${esc(top.ln)} ${top.s.gl}` : 'No goals yet'}</i></div>
  </div>
  <div class="sqviews">${SQ_VIEWS.map(([k, l]) => `<button class="chip${view === k ? ' on' : ''}" data-a="sqView" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="sqscroll"><table class="tbl squad"><thead><tr><th></th><th data-a="sqSort" data-k="" class="srt">Name</th>${cols.map(x => head(x[0], x[1])).join('')}</tr></thead><tbody>
  ${list.map(p => `<tr data-a="player" data-id="${p.id}" class="${c.xi && c.xi.includes(p.id) ? 'xi' : ''}"><td>${posTag(p.pos)}</td><td class="nm">${esc(pname(p))}${p.tr ? ' <span class="c-m">◆</span>' : ''} ${status(p)}${p.loanFrom != null ? '<span class="tag m">LOAN</span>' : ''}</td>${cols.map(x => `<td>${x[3](p)}</td>`).join('')}</tr>`).join('')}
  </tbody></table>${(() => { const out = Object.values(W.players).filter(p => p.loanFrom === c.id); return out.length ? `<h3 class="divh">Out on loan</h3>${out.map(p => `<div class="row" data-a="player" data-id="${p.id}">${posTag(p.pos)} ${esc(pname(p))} at ${badgeImg(C(p.club), 14)} ${esc(C(p.club).name)} · ${p.s.ap} apps</div>`).join('')}` : ''; })()}</div><p class="note sqkey"><span class="xi-key"></span> starting XI · ◆ trait · tap to sort${srt ? ' · <span class="lnk" data-a="sqSort" data-k="">reset sort</span>' : ''}</p></div>`;
}
function playerModal(id) {
  const p = P(id); if (!p) return;
  const mine = p.club === W.clubId, c = p.club >= 0 ? C(p.club) : null;
  const a = p.a, keys = p.pos === 'GK' ? [['gk', 'Goalkeeping'], ['pas', 'Kicking'], ['pac', 'Agility']] : [['pac', 'Pace'], ['tkl', 'Tackling'], ['pas', 'Passing'], ['sho', 'Shooting']];
  const avg = p.s.ap ? (p.s.rt / p.s.ap).toFixed(2) : '-';
  const ask = askingPrice(p), k = known(p), loanee = p.loanFrom != null, myLoan = p.loanFrom === W.clubId;
  UI.curModal = () => playerModal(id); UI.curKind = 'player';
  modal(`<div class="pcard">
    <div class="phead">${portrait(p, 64)}<div><h3>${esc(p.fn)} ${esc(p.ln)}</h3><div>${posTag(p.pos)} ${POS_NAME[p.pos]} · age ${p.age}</div><div>${c ? badgeImg(c, 16) + ' ' + esc(c.name) : 'Free agent'}</div>${loanee ? `<div class="c-m">On loan from ${esc(C(p.loanFrom).name)}</div>` : ''}</div><div class="pbig">${ovrHTML(p)}</div></div>
    ${k ? `<div class="attrs">${keys.map(([k, n]) => `<div><span>${n}</span>${bar(a[k], 20, a[k] >= 15 ? 'c' : a[k] >= 11 ? 'g' : a[k] >= 7 ? 'y' : 'r')}<b>${Math.round(a[k])}</b></div>`).join('')}</div>`
      : `<div class="scoutbox">🔍 Your scout hasn't watched him yet. Ratings are a rough guess.<button class="btn small go" data-a="scout" data-id="${p.id}">Scout him (${money(scoutCost())})</button></div>`}
    <div class="kv"><span>Room to grow</span><b>${k ? stars(p) : '<span class="c-d">?</span>'}</b><span>Fitness</span><b>${Math.round(p.fit)}%</b><span>Morale</span><b>${moraleWord(p.mor)}</b><span>Form</span><b>${formArrow(p.form)} ${p.form >= 1.2 ? 'Hot' : p.form <= -1.2 ? 'Poor' : 'Steady'}</b>
      <span>Value</span><b>${money(valueOf(p))}</b><span>Wage</span><b>${money(p.wage)}/wk</b><span>Contract</span><b>${p.club < 0 ? '-' : p.con <= 0 ? 'Expiring!' : p.con + ' yr' + (p.con > 1 ? 's' : '')}</b>
      <span>This season</span><b>${p.s.ap} apps · ${p.s.gl} gls · ${p.s.as} ast · avg ${avg}</b></div>
    ${p.tr ? `<div class="trait">◆ <b>${TRAITS[p.tr].n}</b>: ${TRAITS[p.tr].d}</div>` : ''}
    ${p.inj ? `<div class="c-r">Injured: out for ${p.inj} week${p.inj > 1 ? 's' : ''}</div>` : ''}${p.sus ? `<div class="c-o">Suspended: ${p.sus} match${p.sus > 1 ? 'es' : ''}</div>` : ''}
    ${!mine && !myLoan ? compareHTML(p) : ''}
    <div class="acts">
      ${mine && loanee ? `<div class="note">He goes back to ${esc(C(p.loanFrom).name)} at the end of the season.</div>`
      : mine ? `<button class="btn small" data-a="toggleList" data-id="${p.id}">${p.listed ? 'Take off the list' : 'Transfer list'}</button>
        ${p.con <= 1 ? `<button class="btn small go" data-a="renew" data-id="${p.id}">New contract</button>` : ''}
        ${p.age <= 23 ? `<button class="btn small" data-a="loanOut" data-id="${p.id}">Send out on loan</button>` : ''}
        <button class="btn small bad" data-a="release" data-id="${p.id}">Release (${money(releaseCost(p))})</button>`
      : myLoan ? `<div class="note">Your player, out on loan. He comes back at the end of the season.</div>`
      : loanee ? `<div class="note">On loan here from ${esc(C(p.loanFrom).name)}, so he can't be signed until the summer.</div>`
      : `<div class="note">${p.club < 0 ? `Free agent. Wants about ${money(wageDemand(p, me().div))}/wk.` : `Asking price about <b>${money(ask)}</b>${p.listed ? ' (transfer listed!)' : ''}.`}</div><button class="btn go" data-a="offer" data-id="${p.id}">${p.club < 0 ? 'Offer a contract' : 'Make an offer'}</button>
        ${canLoanIn(p) ? `<button class="btn" data-a="loanIn" data-id="${p.id}">Loan him (${money(loanFee(p))})</button>` : ''}`}
      <button class="btn ghost small" data-a="close">${UI.ret ? '◀ Back' : 'Close'}</button>
    </div></div>`);
}

// ---------- TACTICS
function pitchHTML(c, edit) {
  const slots = formSlots(c.formation), spots = FORMS[c.formation];
  return `<div class="tpitch2">${c.xi.map((id, k) => {
    const p = id != null ? P(id) : null, [x, y] = spots[k];
    const off = p && p.pos !== slots[k];
    return `<${edit ? 'button' : 'div'} class="slot ${edit && UI.sel === k ? 'sel' : ''} ${off ? 'off' : ''}" style="left:${y * 100}%;top:${92 - x * 112}%" ${edit ? `data-a="slot" data-k="${k}"` : `data-a="player" data-id="${id}"`}><i style="background:${k ? c.c1 : '#33d17a'};border-color:${c.c2}"></i><span>${p ? esc(p.ln) : '???'}</span><b>${p ? (edit ? `<span class="${ovrCol(ovr(p, slots[k]))}">${ovr(p, slots[k])}</span>` : ovrHTML(p, slots[k])) : ''}</b></${edit ? 'button' : 'div'}>`;
  }).join('')}</div>`;
}
function tacticsTop() {
  const fx = userFixture();
  const fromPre = UI.fromPre === W.season * 100 + W.week && fx;
  const opp = fx ? C(fx.h === W.clubId ? fx.a : fx.h) : null;
  return `<div class="tacbar">${fromPre ? '<button class="btn go" data-a="tacBack">◀ Back to the game</button>' : fx ? '<button class="btn go" data-a="go">Play match ▶</button>' : '<button class="btn" data-a="tab" data-t="home">◀ Back</button>'}
    <button class="btn" data-a="viewOpp" data-id="${opp ? opp.id : ''}">${opp ? `${badgeImg(opp, 14)} View ${esc(opp.short)}` : 'View opponents'}</button></div>`;
}
function tacticsHTML() {
  const c = me(); fixTeam(c);
  const st = STYLES[c.style];
  return tacticsTop() + `<div class="panel tacpanel">
    <div class="chips tacrow"><span class="tlab">Shape</span>${Object.keys(FORMS).map(f => `<button class="chip ${c.formation === f ? 'on' : ''}" data-a="form" data-f="${f}">${f}</button>`).join('')}</div>
    <div class="pitchbox">${pitchHTML(c, true)}</div>
    <p class="note tacnote">Tap a shirt to swap. <span class="c-r">Red</span> = out of position.</p>
    <div class="bench tacrow"><span class="tlab">Subs</span>${c.bench.map((id, k) => `<button class="chip ${UI.sel === 'b' + k ? 'on' : ''}" data-a="slot" data-k="b${k}">${posTag(P(id).pos)} ${esc(P(id).ln)}</button>`).join('')} ${c.bench.length < 5 ? `<button class="chip" data-a="slot" data-k="b${c.bench.length}">+ add</button>` : ''}</div>
    <div class="acts tacauto"><button class="btn small" data-a="autoPick">Pick best XI</button>
    <label class="tog"><input type="checkbox" data-a="toggleAuto" ${W.settings.autoPick ? 'checked' : ''}> Auto-pick weekly</label></div>
    <div class="chips tacrow"><span class="tlab">Style</span>${Object.keys(STYLES).map(k => `<button class="chip ${c.style === k ? 'on' : ''}" data-a="style" data-s="${k}">${STYLES[k].n}</button>`).join('')}</div>
    <p class="note tacdesc"><b class="c-y">${st.n}:</b> ${st.d} <span class="c-g">Beats ${BEATS[c.style].map(s => STYLES[s].n).join(', ')}.</span></p>
  </div>`;
}
// a look at any other club: their likely team, style and best players
function oppModal(id) {
  const c = me(), fx = userFixture(), nextId = fx ? (fx.h === c.id ? fx.a : fx.h) : null;
  if (id == null || isNaN(id) || id === c.id) id = nextId ?? W.clubs.find(x => x.div === c.div && x.id !== c.id).id;
  const o = C(id); autoPick(o);
  const t = table(o.div), row = t.find(r => r.id === o.id), pos = t.indexOf(row) + 1;
  const counters = Object.keys(STYLES).filter(s => BEATS[s].includes(o.style));
  const weBeat = BEATS[c.style].includes(o.style), theyBeat = BEATS[o.style].includes(c.style);
  const squad = o.squad.map(P).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || ovrOf(b) - ovrOf(a));
  const key = o.xi.map(P).filter(Boolean).sort((a, b) => ovrOf(b) - ovrOf(a))[0];
  const rivals = W.clubs.filter(x => x.div === c.div && x.id !== c.id).sort((a, b) => a.name.localeCompare(b.name));
  if (o.div !== c.div && !rivals.includes(o)) rivals.unshift(o);
  UI.curModal = () => oppModal(id); UI.curKind = 'opp';
  const unknown = o.squad.filter(x => !known(P(x))).length;
  modal(`<div class="opp">
    <div class="chips small">${nextId != null ? `<button class="chip ${id === nextId ? 'on' : ''}" data-a="viewOpp" data-id="${nextId}">Next opponent</button>` : ''}
      <select class="oppsel" data-a="oppSel">${rivals.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="nextfx">${badgeImg(o, 40)}<div class="vs"><b>${esc(o.name)}</b><small>${divName(o)}${o.foreign ? '' : ` · ${row && row.p ? ordinal(pos) : '-'}`} · form ${formHTML(o.formStr)}</small></div></div>
    <p>${o.formation}, plays <b class="c-y">${STYLES[o.style].n}</b>. ${STYLES[o.style].d}</p>
    <p class="note">${weBeat ? `<span class="c-g">Your ${STYLES[c.style].n} should trouble them.</span>` : theyBeat ? `<span class="c-r">Their style beats your ${STYLES[c.style].n}.</span>` : 'Your styles cancel out.'} Best against them: <b>${counters.map(s => STYLES[s].n).join(' or ')}</b>.${key ? ` Danger man: <b>${esc(pname(key))}</b> (${ovrHTML(key)}).` : ''}</p>
    ${unknown ? `<div class="scoutbox">🔍 Ratings are rough guesses until you scout them.<button class="btn small go" data-a="scoutSquad" data-id="${o.id}">Scout the whole squad (${money(scoutCost() * 4)})</button></div>` : ''}
    <h3 class="divh">Their likely team</h3>${pitchHTML(o, false)}
    <h3 class="divh">Squad</h3>
    <table class="tbl"><tbody>${squad.map(p => `<tr data-a="player" data-id="${p.id}" class="${o.xi.includes(p.id) ? 'xi' : ''}"><td>${posTag(p.pos)}</td><td class="nm">${esc(pname(p))}${p.tr ? ' <span class="c-m">◆</span>' : ''} ${p.inj ? `<span class="tag r">INJ</span>` : ''}${p.sus ? '<span class="tag o">SUS</span>' : ''}</td><td>${p.age}</td><td>${ovrHTML(p)}</td><td>${p.s.gl ? p.s.gl + '⚽' : ''}</td></tr>`).join('')}</tbody></table>
    <div class="acts"><button class="btn go" data-a="close">Done</button></div></div>`);
}
function slotModal(k) {
  const c = me(), isBench = String(k)[0] === 'b', slots = formSlots(c.formation), pos = isBench ? null : slots[k];
  const cur = isBench ? c.bench[+k.slice(1)] : c.xi[k];
  const list = c.squad.map(P).filter(p => p.id !== cur).sort((a, b) => pos ? ovrOf(b, pos) - ovrOf(a, pos) : ovrOf(b) - ovrOf(a));
  UI.curModal = () => slotModal(k); UI.curKind = 'slot';
  modal(`<h3>${isBench ? 'Pick a substitute' : `Who plays ${POS_NAME[pos]}?`}</h3>
  <table class="tbl"><tbody>${list.map(p => {
    const where = c.xi.includes(p.id) ? 'XI' : c.bench.includes(p.id) ? 'SUB' : '';
    const bad = p.inj || p.sus;
    return `<tr data-a="${bad ? '' : 'choose'}" data-k="${k}" data-id="${p.id}" class="${bad ? 'dim' : ''}"><td>${posTag(p.pos)}</td><td class="nm">${esc(pname(p))} ${status(p)}</td><td><small>${where}</small></td><td class="${ovrCol(ovr(p, pos || p.pos))}">${ovr(p, pos || p.pos)}</td><td>${bar(p.fit, 100, fitCls(p.fit))}</td></tr>`;
  }).join('')}</tbody></table>${isBench && cur != null ? `<button class="btn small" data-a="unbench" data-k="${k}">Leave this place empty</button>` : ''}<button class="btn ghost small" data-a="close">Cancel</button>`);
}
function choosePlayer(k, id) {
  const c = me(), isBench = String(k)[0] === 'b';
  W.settings.autoPick = false;
  const inXi = c.xi.indexOf(id), inB = c.bench.indexOf(id);
  if (isBench) {
    const b = +k.slice(1), cur = c.bench[b];
    if (inXi >= 0) { if (cur == null) return toast('Pick someone to take his place in the team first.'); c.xi[inXi] = cur; }
    if (inB >= 0) c.bench[inB] = cur;
    c.bench[b] = id;
    c.bench = c.bench.filter(x => x != null);
  } else {
    const cur = c.xi[k];
    if (inXi >= 0) c.xi[inXi] = cur;
    else if (inB >= 0) { if (cur != null) c.bench[inB] = cur; else c.bench.splice(inB, 1); }
    c.xi[k] = id;
  }
  closeModal(); save(); rerender();
}

// ---------- LEAGUE
function leagueHTML() {
  const c = me(), d = UI.ld ?? c.div;
  const tabs = `<div class="chips">${[['table', 'Tables'], ['fix', 'Fixtures'], ['cup', 'Cups'], ['scorers', 'Stats']].map(([k, n]) => `<button class="chip ${UI.lt === k ? 'on' : ''}" data-a="lt" data-k="${k}">${n}</button>`).join('')}</div>`;
  const divs = `<div class="chips small">${DIVS.map((n, i) => `<button class="chip ${d === i ? 'on' : ''}" data-a="ld" data-d="${i}">${i ? 'Div ' + i : 'Premier'}</button>`).join('')}</div>`;
  let body = '';
  if (UI.lt === 'table') {
    const t = table(d);
    body = divs + `<table class="tbl league"><thead><tr><th>#</th><th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${t.map((r, i) => {
      const zone = (d > 0 && i < 2) || (d === 0 && i === 0) ? 'up' : d < 3 && i >= 10 ? 'down' : '';
      return `<tr class="${zone} ${r.id === c.id ? 'me' : ''}"><td>${i + 1}</td><td>${badgeImg(C(r.id), 14)}</td><td class="nm">${esc(C(r.id).name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.f - r.a > 0 ? '+' : ''}${r.f - r.a}</td><td><b>${r.pts}</b></td></tr>`;
    }).join('')}</tbody></table><p class="note"><span class="c-g">■</span> ${d ? 'promoted' : 'champions'} ${d < 3 ? '· <span class="c-r">■</span> relegated' : ''}</p>`;
  } else if (UI.lt === 'fix') {
    let month = '';
    const rows = W.cal.map((e, w) => {
      const dt = dateOf(W.season, w), mon = dt.replace(/^\d+ /, ''), day = dt.split(' ')[0];
      let head = ''; if (mon !== month) { month = mon; head = `<div class="calm">${mon.toUpperCase()}</div>`; }
      let opp = null, home, res = null;
      if (e.t === 'L') { const f = W.fix[c.div][e.r].find(([h, a]) => h === c.id || a === c.id); if (f) { home = f[0] === c.id; opp = home ? f[1] : f[0]; res = W.res.find(r => r.w === w && (r.h === c.id || r.a === c.id)); } }
      else if (e.t === 'K') { const cp = userComp(); if (cp && e.r >= cp.start) { const ri2 = e.r - cp.start, rd = cp.log[ri2]; const t = rd ? rd.find(t => t.h === c.id || t.a === c.id) : (cp.r === ri2 ? cp.ties.map(([h, a]) => ({h, a})).find(t => t.h === c.id || t.a === c.id) : null); if (t) { home = t.h === c.id; opp = home ? t.a : t.h; if (rd) res = t; } } }
      else { const rd = W.cup.log[e.r]; const t = rd ? rd.find(t => t.h === c.id || t.a === c.id) : (W.cup.r === e.r ? W.cup.ties.map(([h, a]) => ({h, a})).find(t => t.h === c.id || t.a === c.id) : null); if (t) { home = t.h === c.id; opp = home ? t.a : t.h; if (rd) res = t; } }
      const kc = e.t === 'K' ? userComp() : null;
      const comp = e.t === 'L' ? '<span class="comp l">LGE</span>' : e.t === 'K' ? `<span class="comp ${kc && kc.euro ? 'e' : 'k'}">${kc ? kc.short : 'CUP'}</span>` : `<span class="comp c">${['R1', 'R2', 'R3', 'QF', 'SF', 'FINAL'][e.r]}</span>`;
      const now = w === W.week ? 'now' : w < W.week ? 'past' : '';
      if (opp == null) return head + `<div class="calr ${now} dim"><span class="d">${day}</span>${comp}<span class="o">${e.t === 'K' ? (kc && e.r >= kc.start && kc.winner == null && kc.entrants.includes(c.id) && !kc.log.some(rd => rd.some(t => (t.h === c.id || t.a === c.id) && t.win !== c.id)) ? `${kc.rounds[e.r - kc.start]}: draw to come` : 'Not involved') : e.t === 'C' ? (W.cup.r > e.r || W.cup.winner != null || !W.cup.alive.concat(W.cup.byes).includes(c.id) ? 'Not involved' : 'Draw to come') : 'No game'}</span></div>`;
      let out = '';
      if (res) { const gf = home ? res.hg : res.ag, ga = home ? res.ag : res.hg; const wl = res.win != null ? (res.win === c.id ? 'W' : 'L') : gf > ga ? 'W' : gf < ga ? 'L' : 'D'; out = `<span class="fm ${wl}">${wl}</span> ${gf}-${ga}${res.pens ? 'p' : ''}`; }
      else { const op = posIn(opp), oc = C(opp), dv = oc.div, hard = oc.foreign ? squadStrength(oc) > squadStrength(c) : dv < c.div || (dv === c.div && op <= 3), easy = oc.foreign ? squadStrength(oc) < squadStrength(c) - 1 : dv > c.div || (dv === c.div && op >= 10); out = `<span class="diff ${hard ? 'h' : easy ? 'e' : 'm'}">${hard ? 'HARD' : easy ? 'EASY' : 'FAIR'}</span>`; }
      return head + `<div class="calr ${now}" data-a="viewOpp" data-id="${opp}"><span class="d">${now === 'now' ? '▶' : day}</span>${comp}<span class="ha">${home ? 'H' : 'A'}</span><span class="o">${badgeImg(C(opp), 14)} ${esc(C(opp).name)}</span><span class="r">${out}</span></div>`;
    }).join('');
    const left = W.cal.map((e, w) => ({e, w})).filter(x => x.w >= W.week && x.e.t === 'L').slice(0, 5).map(x => { const f = W.fix[c.div][x.e.r].find(([h, a]) => h === c.id || a === c.id); return f ? (f[0] === c.id ? f[1] : f[0]) : null; }).filter(x => x != null);
    const avg = left.length ? left.reduce((s, id) => s + posIn(id), 0) / left.length : 0;
    body = `${left.length ? `<p class="note">Next ${left.length} league games: average opponent ${ordinal(Math.round(avg))} in the table, so <b class="${avg < 5 ? 'c-r' : avg > 8 ? 'c-g' : 'c-y'}">${avg < 5 ? 'a tough run' : avg > 8 ? 'a kind run' : 'a mixed run'}</b>. Tap a game to scout the opponent.</p>` : ''}<div class="cal">${rows}</div>`;
  } else if (UI.lt === 'cup') {
    const comps = [['tin', CUP_NAME]].concat(Object.values(W.ko || {}).map(cp => [cp.key, cp.name]));
    const mine = userComp(), cv = UI.cv || 'tin';
    body = `<div class="chips small">${comps.map(([k, n]) => `<button class="chip ${cv === k ? 'on' : ''}" data-a="cv" data-k="${k}">${k === 'tin' || (mine && mine.key === k) ? '★ ' : ''}${n}</button>`).join('')}</div>` + cupView(cv);
  } else {
    body = statsHTML(d, divs);
  }
  return `<div class="panel">${tabs}${body}</div>`;
}

// one knockout competition: who's in it, the current draw and every result so far
function cupView(key) {
  const c = me();
  if (key === 'tin') {
    const cup = W.cup, wk = W.cal.findIndex(e => e.t === 'C' && e.r === cup.r);
    return `<p>Every club in the land. ${cup.winner != null ? `<b class="c-y">🏆 ${esc(C(cup.winner).name)} won it!</b>` : `Next: <b>${CUP_ROUNDS[cup.r]}</b>${wk >= 0 ? ' on ' + dateOf(W.season, wk) : ''}`}</p>
      ${cup.winner == null ? `<div class="ttx"><div class="c-y">${CUP_ROUNDS[cup.r].toUpperCase()} DRAW${cup.r === 0 ? ' (THE TOP 16 HAVE BYES)' : ''}</div>${cup.ties.map(([h, a]) => `<div class="res ${h === c.id || a === c.id ? 'mine' : ''}"><span>${esc(C(h).name)}</span><b>v</b><span>${esc(C(a).name)}</span></div>`).join('')}</div>` : ''}
      ${cup.log.map((rd, i) => `<div class="ttx"><div class="c-y">${CUP_ROUNDS[i].toUpperCase()}</div>${rd.map(r => resLine(r)).join('')}</div>`).reverse().join('')}`;
  }
  const cp = W.ko && W.ko[key]; if (!cp) return '<p class="note">Starts next season.</p>';
  const who = {vase: 'Division Two and Division Three clubs.', flood: 'Division One clubs.', ecc: "Last season's top four in the Premier Division, against the best of Europe.", fairs: 'The rest of the Premier Division, against more of Europe.'}[key];
  const wk = W.cal.findIndex(e => e.t === 'K' && e.r === cp.start + cp.r);
  const nm = id => `${esc(C(id).name)}${C(id).foreign ? ` <small class="c-c">${C(id).short}</small>` : ''}`;
  return `<p>${who} ${cp.entrants.includes(c.id) ? `<b class="c-g">You're in it!</b>` : ''}</p>
    <p>${cp.winner != null ? `<b class="c-y">🏆 ${esc(C(cp.winner).name)} won the ${esc(cp.name)}!</b>` : `Next: <b>${cp.rounds[cp.r]}</b>${wk >= 0 ? ' on ' + dateOf(W.season, wk) : ''}`}</p>
    ${cp.winner == null ? `<div class="ttx"><div class="c-y">${cp.rounds[cp.r].toUpperCase()} DRAW${cp.r === 0 && cp.byes.length ? ` (${cp.byes.length} SEEDS HAVE BYES)` : ''}</div>${cp.ties.map(([h, a]) => `<div class="res ${h === c.id || a === c.id ? 'mine' : ''}"><span>${nm(h)}</span><b>v</b><span>${nm(a)}</span></div>`).join('')}</div>` : ''}
    ${cp.log.map((rd, i) => `<div class="ttx"><div class="c-y">${cp.rounds[i].toUpperCase()}</div>${rd.map(r => resLine(r)).join('')}</div>`).reverse().join('')}
    ${cp.euro ? `<p class="note">European sides: ${cp.entrants.filter(id => C(id).foreign).map(id => `${esc(C(id).name)} (${C(id).country})`).join(', ')}.</p>` : ''}`;
}

// ---------- STATS: player leaderboards, team tables and your own squad
const STAT_TABS = [['goals', 'Goals'], ['assists', 'Assists'], ['rating', 'Ratings'], ['motm', 'Star man'], ['cs', 'Clean sheets'], ['cards', 'Discipline'], ['form', 'Form table'], ['home', 'Home'], ['away', 'Away'], ['attack', 'Attack'], ['defence', 'Defence'], ['mine', 'My club']];
function teamRows(div, filter) {
  const rows = {};
  W.clubs.filter(c => c.div === div).forEach(c => rows[c.id] = {id: c.id, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0, form: ''});
  W.res.filter(r => r.d === div).sort((a, b) => a.w - b.w).forEach(r => {
    [[r.h, r.hg, r.ag, 'h'], [r.a, r.ag, r.hg, 'a']].forEach(([id, gf, ga, where]) => {
      const x = rows[id]; if (!x || (filter && filter !== where)) return;
      x.p++; x.f += gf; x.a += ga;
      if (gf > ga) { x.w++; x.pts += 3; x.form += 'W'; } else if (gf < ga) { x.l++; x.form += 'L'; } else { x.d++; x.pts++; x.form += 'D'; }
    });
  });
  return Object.values(rows);
}
function statsHTML(d, divs) {
  const c = me(), st = UI.st || 'goals';
  const chips = `<div class="chips small">${STAT_TABS.map(([k, n]) => `<button class="chip ${st === k ? 'on' : ''}" data-a="st" data-k="${k}">${n}</button>`).join('')}</div>`;
  const pl = Object.values(W.players).filter(p => p.club >= 0 && C(p.club).div === d && p.s.ap > 0);
  const club = p => `${badgeImg(C(p.club), 14)} <small>${C(p.club).short}</small>`;
  const pTable = (list, val, head) => `<table class="tbl"><thead><tr><th>#</th><th>Player</th><th>Club</th><th>Apps</th><th>${head}</th></tr></thead><tbody>${list.slice(0, 15).map((p, i) => `<tr data-a="player" data-id="${p.id}" class="${p.club === c.id ? 'me' : ''}"><td>${i + 1}</td><td class="nm">${posTag(p.pos)} ${esc(pname(p))}</td><td>${club(p)}</td><td>${p.s.ap}</td><td><b>${val(p)}</b></td></tr>`).join('') || '<tr><td colspan="5">Nothing yet this season.</td></tr>'}</tbody></table>`;
  const played = Math.max(1, ...W.clubs.filter(x => x.div === d).map(x => teamRows(d).find(r => r.id === x.id).p));
  const tTable = (rows, cols) => `<table class="tbl league"><thead><tr><th>#</th><th></th><th>Team</th>${cols.map(x => `<th>${x[0]}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.id === c.id ? 'me' : ''}"><td>${i + 1}</td><td>${badgeImg(C(r.id), 14)}</td><td class="nm">${esc(C(r.id).name)}</td>${cols.map(x => `<td>${x[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const std = [['P', r => r.p], ['W', r => r.w], ['D', r => r.d], ['L', r => r.l], ['GD', r => (r.f - r.a > 0 ? '+' : '') + (r.f - r.a)], ['Pts', r => `<b>${r.pts}</b>`]];
  const ord = (a, b) => b.pts - a.pts || (b.f - b.a) - (a.f - a.a) || b.f - a.f;
  let out;
  switch (st) {
    case 'goals': out = pTable(pl.filter(p => p.s.gl).sort((a, b) => b.s.gl - a.s.gl || a.s.ap - b.s.ap), p => p.s.gl, 'Goals'); break;
    case 'assists': out = pTable(pl.filter(p => p.s.as).sort((a, b) => b.s.as - a.s.as || a.s.ap - b.s.ap), p => p.s.as, 'Assists'); break;
    case 'rating': { const min = Math.max(2, Math.floor(played / 3)); out = pTable(pl.filter(p => p.s.ap >= min).sort((a, b) => b.s.rt / b.s.ap - a.s.rt / a.s.ap), p => (p.s.rt / p.s.ap).toFixed(2), 'Avg') + `<p class="note">Players with at least ${min} appearances.</p>`; break; }
    case 'motm': out = pTable(pl.filter(p => p.s.mo).sort((a, b) => b.s.mo - a.s.mo), p => p.s.mo, '★') + '<p class="note">How often each player was his team\'s best performer.</p>'; break;
    case 'cs': out = pTable(pl.filter(p => p.pos === 'GK' && p.s.cs).sort((a, b) => b.s.cs - a.s.cs || a.s.ap - b.s.ap), p => p.s.cs, 'Clean') ; break;
    case 'cards': out = pTable(pl.filter(p => p.s.yc || p.s.rc).sort((a, b) => ((b.s.rc || 0) * 3 + (b.s.yc || 0)) - ((a.s.rc || 0) * 3 + (a.s.yc || 0))), p => `<span class="card y"></span>${p.s.yc || 0} <span class="card r"></span>${p.s.rc || 0}`, 'Cards'); break;
    case 'form': { const rows = teamRows(d).map(r => { const f = r.form.slice(-5); return Object.assign({}, r, {f5: f, fp: [...f].reduce((s, x) => s + (x === 'W' ? 3 : x === 'D' ? 1 : 0), 0)}); }).sort((a, b) => b.fp - a.fp || ord(a, b)); out = tTable(rows, [['Last 5', r => formHTML(r.f5)], ['Pts', r => `<b>${r.fp}</b>`]]); break; }
    case 'home': out = tTable(teamRows(d, 'h').sort(ord), std); break;
    case 'away': out = tTable(teamRows(d, 'a').sort(ord), std); break;
    case 'attack': out = tTable(teamRows(d).sort((a, b) => b.f - a.f || a.p - b.p), [['P', r => r.p], ['Scored', r => `<b>${r.f}</b>`], ['Per game', r => r.p ? (r.f / r.p).toFixed(1) : '-']]); break;
    case 'defence': out = tTable(teamRows(d).sort((a, b) => a.a - b.a || b.p - a.p), [['P', r => r.p], ['Conceded', r => `<b>${r.a}</b>`], ['Per game', r => r.p ? (r.a / r.p).toFixed(1) : '-']]); break;
    case 'mine': {
      const sq = c.squad.map(P).sort((a, b) => b.s.gl - a.s.gl || b.s.ap - a.s.ap);
      out = `<table class="tbl mystats"><thead><tr><th></th><th>Player</th><th>Apps</th><th>Gls</th><th>Ast</th><th>Avg</th><th>★</th><th>🟨</th></tr></thead><tbody>${sq.map(p => `<tr data-a="player" data-id="${p.id}"><td>${posTag(p.pos)}</td><td class="nm">${esc(pname(p))}</td><td>${p.s.ap}</td><td>${p.s.gl || ''}</td><td>${p.s.as || ''}</td><td>${p.s.ap ? (p.s.rt / p.s.ap).toFixed(1) : '-'}</td><td>${p.s.mo || ''}</td><td>${p.s.yc || p.s.rc ? (p.s.yc || 0) + (p.s.rc ? '+' + p.s.rc + 'R' : '') : ''}</td></tr>`).join('')}</tbody></table>`;
      return chips + `<p class="note">${esc(c.name)} this season, in all competitions.</p>` + out;
    }
  }
  return chips + divs + out + (['goals', 'assists', 'rating', 'motm', 'cs', 'cards'].includes(st) ? '<p class="note">League and cup games combined.</p>' : '');
}

// ---------- MARKET
function marketHTML() {
  const c = me(), m = UI.mkt;
  let list = Object.values(W.players).filter(p => p.club !== c.id && (p.club < 0 || !C(p.club).foreign));
  if (m.view === 'free') list = list.filter(p => p.club < 0); else if (m.view === 'listed') list = list.filter(p => p.listed); else if (m.view === 'mine') list = c.squad.map(P);
  if (m.pos !== 'ALL') list = list.filter(p => p.pos === m.pos);
  if (m.afford && m.view !== 'mine') list = list.filter(p => askingPrice(p) <= Math.max(0, c.cash));
  if (m.young) list = list.filter(p => p.age <= 21);
  list.sort((a, b) => estOvr(b) - estOvr(a));
  const shown = list.slice(0, 60);
  return `<div class="subtabs"><button class="${UI.tab === 'squad' ? 'on' : ''}" data-a="tab" data-t="squad">My squad</button><button class="${UI.tab === 'market' ? 'on' : ''}" data-a="tab" data-t="market">Transfer market</button></div><div class="panel"><h2>Transfer market</h2><p class="note">Budget: <b class="${c.cash < 0 ? 'c-r' : 'c-g'}">${money(c.cash)}</b> · squad ${c.squad.length}/26 · loans in ${loansIn()}/3. Ratings like <span class="rng c-y">55-65</span> are guesses until you scout a player.</p>
  <div class="chips">${[['all', 'All players'], ['listed', 'Transfer list'], ['free', 'Free agents'], ['mine', 'My squad']].map(([k, n]) => `<button class="chip ${m.view === k ? 'on' : ''}" data-a="mview" data-k="${k}">${n}</button>`).join('')}</div>
  <div class="chips small">${['ALL'].concat(POS).map(p => `<button class="chip ${m.pos === p ? 'on' : ''}" data-a="mpos" data-p="${p}">${p}</button>`).join('')}
    <button class="chip ${m.afford ? 'on' : ''}" data-a="mafford">Can afford</button><button class="chip ${m.young ? 'on' : ''}" data-a="myoung">21 &amp; under</button></div>
  <table class="tbl"><thead><tr><th></th><th>Name</th><th>Age</th><th>Club</th><th>Rat</th><th>${m.view === 'mine' ? 'Value' : 'Price'}</th></tr></thead><tbody>
  ${shown.map(p => `<tr data-a="player" data-id="${p.id}"><td>${posTag(p.pos)}</td><td class="nm">${esc(pname(p))}${p.listed ? ' <span class="tag c">L</span>' : ''}${p.loanFrom != null ? ' <span class="tag m">LOAN</span>' : ''}${known(p) && p.tr === 'wonder' ? ' <span class="c-m">◆</span>' : ''}</td><td>${p.age}</td><td>${p.club < 0 ? '<small>FREE</small>' : badgeImg(C(p.club), 14) + ' <small>' + C(p.club).short + '</small>'}</td><td>${ovrHTML(p)}</td><td>${m.view === 'mine' ? money(valueOf(p)) : p.club < 0 ? '-' : money(askingPrice(p))}</td></tr>`).join('') || '<tr><td colspan="6">Nobody matches.</td></tr>'}
  </tbody></table>${list.length > 60 ? `<p class="note">Showing the best 60 of ${list.length}.</p>` : ''}</div>`;
}

// haggling: you and their chairman go back and forth; he has 3 lots of patience
function offerModal(id) {
  const p = P(id), c = me();
  if (c.squad.length >= 26) return toast('Your squad is full (26). Sell or release someone first.');
  if (!willingToJoin(p)) { modal(`<h3>No deal</h3><p>${esc(pname(p))} isn't interested in dropping down to ${DIVS[c.div]}. Win promotion and try again!</p><button class="btn" data-a="close">OK</button>`); return; }
  if (p.club < 0) return contractModal(id, 0);
  const ask = askingPrice(p);
  UI.neg = {id, ask, secret: ask * (.9 + R() * .14), offer: Math.round(ask * .8 / 1000) * 1000, patience: 3, said: `"${pick(['He is not for sale... but everyone has a price.', 'Make me an offer, son.', "He's the heartbeat of this club.", 'You will have to pay up for him.'])}"`};
  negHTML();
}
function negHTML() {
  const n = UI.neg, p = P(n.id), sell = C(p.club), c = me();
  const face = n.patience >= 3 ? '😐' : n.patience === 2 ? '😒' : n.patience === 1 ? '😠' : '🤬';
  modal(`<div class="neg"><h3>Buying ${esc(pname(p))}</h3>
    <div class="chair">${badgeImg(sell, 36)}<div><b>${esc(sell.name)} chairman</b><div class="say">${esc(n.said)}</div></div><span class="face">${face}</span></div>
    <div class="note">Valued at ${money(valueOf(p))}. Patience: ${'■'.repeat(n.patience)}${'□'.repeat(3 - n.patience)}</div>
    <div class="offer"><button class="btn" data-a="negStep" data-d="-1">−</button><b class="${n.offer > c.cash ? 'c-r' : 'c-y'}">${money(n.offer)}</b><button class="btn" data-a="negStep" data-d="1">+</button></div>
    <div class="chips small">${[.7, .85, 1, 1.15].map(f => `<button class="chip" data-a="negSet" data-f="${f}">${Math.round(f * 100)}% of asking</button>`).join('')}</div>
    <div class="acts"><button class="btn go" data-a="negBid" ${n.offer > c.cash ? 'disabled' : ''}>${n.offer > c.cash ? 'Not enough money' : 'Make the bid'}</button><button class="btn ghost small" data-a="close">Walk away</button></div></div>`);
}
function negBid() {
  const n = UI.neg, p = P(n.id);
  const step = n.ask > 1e6 ? 50000 : n.ask > 1e5 ? 5000 : 1000;
  if (n.offer >= n.secret) { SND.good(); closeModal(); return contractModal(n.id, n.offer); }
  const ratio = n.offer / n.ask;
  n.patience -= ratio < .6 ? 2 : 1;
  if (n.patience <= 0) { SND.bad(); n.said = '"Get out of my office. We are done talking."'; n.dead = true; modal(`<div class="neg"><h3>Talks over</h3><div class="chair"><span class="face">🤬</span><div class="say">${esc(n.said)}</div></div><button class="btn" data-a="close">OK</button></div>`); return; }
  const counter = Math.round(Math.max(n.secret * 1.04, (n.offer + n.ask * 1.1) / 2) / step) * step;
  n.said = ratio < .6 ? `"Is that a joke? ${money(counter)} or nothing."` : `"Not enough. I want ${money(counter)}."`;
  n.counter = counter;
  SND.click(); negHTML();
}
function contractModal(id, fee) {
  const p = P(id), c = me(), wage = wageDemand(p, c.div);
  UI.deal = {id, fee, wage};
  modal(`<h3>Contract talks: ${esc(pname(p))}</h3>
    ${fee ? `<p>Fee agreed: <b class="c-y">${money(fee)}</b></p>` : '<p>Free transfer: no fee!</p>'}
    <p>He wants <b class="c-y">${money(wage)}</b> a week on a 3-year deal.</p>
    <p class="note">Your wage bill goes from ${money(c.squad.reduce((s, x) => s + P(x).wage, 0))} to ${money(c.squad.reduce((s, x) => s + P(x).wage, 0) + wage)} a week.</p>
    <div class="acts"><button class="btn go" data-a="sign">Sign him!</button><button class="btn ghost small" data-a="close">No thanks</button></div>`);
}
function signDeal() {
  const d = UI.deal, p = P(d.id), c = me();
  if (c.cash < d.fee) return toast("You can't afford that.");
  const from = p.club >= 0 ? C(p.club) : null;
  moveP(p, c, d.fee); p.wage = d.wage; p.con = 3;
  if (d.fee >= 1e6) ach('bigspend');
  news(`${pname(p).toUpperCase()} SIGNS FOR ${c.name.toUpperCase()} ${from ? 'FOR ' + money(d.fee) : 'ON A FREE'}`);
  SND.good(); closeModal(); save(); rerender();
  toast(`<b>${esc(pname(p))}</b> has signed!`);
}

// ---------- CLUB
function clubHTML() {
  const c = me(), wages = c.squad.reduce((s, id) => s + P(id).wage, 0), t = W.training, b = best();
  const drillDone = W.drillWeek === W.week + W.season * 100;
  return `<button class="btn savequit wide" data-a="saveQuit">💾 Save &amp; quit to menu</button><div class="panel"><h2>The board</h2>${bar(W.board.conf, 100, W.board.conf > 60 ? 'g' : W.board.conf > 30 ? 'y' : 'r')}<p>${confWord(W.board.conf)}. Season target: <b class="c-y">${esc(W.board.txt)}</b>. You're ${ordinal(posIn(c.id))}.</p></div>
  <div class="panel"><h2>Training</h2><div class="chips">${Object.keys(TRAINING).map(k => `<button class="chip ${t.focus === k ? 'on' : ''}" data-a="train" data-k="${k}">${TRAINING[k].n}</button>`).join('')}</div>
    <p class="note">${TRAINING[t.focus].d} Young players improve fastest. Players who reach their potential stop improving.</p>
    <div class="chips small">${INTENSITY.map((n, i) => `<button class="chip ${t.int === i ? 'on' : ''}" data-a="intensity" data-i="${i}">${n}</button>`).join('')}</div>
    <p class="note">${['Light: fewer knocks, slower progress, fresher legs.', 'Normal: a sensible week.', 'Hard: faster progress, but tired legs and more injuries.'][t.int]}</p>
    <h3 class="divh">Drill of the week</h3>
    ${drillDone ? `<p class="c-g">Done this week! Training bonus +${Math.round((W.drill || 0) * 100)}%.</p>` : `<p class="note">Run a drill with the lads for a training bonus this week.</p><div class="acts"><button class="btn" data-a="drill" data-k="keepy">⚽ Keepy-uppy</button><button class="btn" data-a="drill" data-k="fk">🎯 Free-kick practice</button></div>`}
  </div>
  <div class="panel"><h2>Finances</h2><div class="kv"><span>Bank</span><b class="${c.cash < 0 ? 'c-r' : 'c-g'}">${money(c.cash)}</b><span>Wages</span><b>${money(wages)}/wk</b><span>TV money</span><b>${money(TV[c.div])}/wk</b><span>Last gate</span><b>${W.lastGate ? money(W.lastGate.gate) + ' (' + W.lastGate.att.toLocaleString() + ' fans)' : '-'}</b></div>
    <div class="offer small"><span>Ticket price</span><button class="btn small" data-a="ticket" data-d="-1">−</button><b>£${c.ticket}</b><button class="btn small" data-a="ticket" data-d="1">+</button></div>
    <p class="note">Cheaper tickets fill the ground, dearer ones earn more per fan. League average is £${BASE_TICKET[c.div]}.</p></div>
  ${stadiumHTML(c)}
  ${rivalHTML(c)}
  <div class="panel"><h2>Trophy cabinet</h2>${W.career.trophies.length ? W.career.trophies.map(t => `<div>🏆 ${esc(t)}</div>`).join('') : '<p class="note">Empty... for now.</p>'}
    <h3 class="divh">Career</h3><p>${esc(W.name)} · ${W.career.seasons} season${W.career.seasons === 1 ? '' : 's'} · <b class="c-y">${W.career.pts}</b> manager points</p>
    ${W.history.length ? `<table class="tbl"><tbody>${W.history.map(h => `<tr><td>${seasonLabel(h.s)}</td><td>${badgeImg(C(h.club), 14)} ${C(h.club).short}</td><td>${DIVS[h.div]}</td><td>${ordinal(h.pos)}</td><td>${h.pts} pts</td></tr>`).join('')}</tbody></table>` : ''}</div>
  <div class="panel"><h2>Achievements</h2>${achHTML()}</div>
  <div class="panel"><h2>Settings</h2>
    <label class="tog"><input type="checkbox" data-a="set" data-k="mini" ${W.settings.mini ? 'checked' : ''}> Play penalties and free kicks yourself in matches</label>
    <label class="tog"><input type="checkbox" data-a="set" data-k="sound" ${W.settings.sound ? 'checked' : ''}> Sound</label>
    <label class="tog"><input type="checkbox" data-a="set" data-k="zoom" ${W.settings.zoom !== false ? 'checked' : ''}> Close-up match camera (off = whole pitch)</label>
    <div class="chips small">Match speed: ${['Slow', 'Normal', 'Fast'].map((n, i) => `<button class="chip ${W.settings.speed === i + 1 ? 'on' : ''}" data-a="speed" data-s="${i + 1}">${n}</button>`).join('')}</div>
    <label class="tog"><input type="checkbox" data-a="musicSet" ${MUSIC.on ? 'checked' : ''}> Music on the title and season screens</label>
    <div class="acts"><button class="btn small" data-a="backup">💾 Back up this career</button><button class="btn small" data-a="slots">Saved careers</button><button class="btn small" data-a="tour">Replay the tour</button></div>
    <div class="acts"><button class="btn small bad" data-a="resign">Resign</button></div>
    <p class="note">Best: keepy-uppy ${b.keepy} · free-kick challenge ${b.fk}/10</p></div>`;
}

// ---------- NEWS (inbox)
function newsHTML() {
  return `<div class="subtabs"><button data-a="tab" data-t="home">◀ Home</button><button class="on">News &amp; inbox</button></div>
  <div class="ttx"><div class="ttxh"><span>P302</span><span>PIXTEXT</span><span>FOOTBALL</span></div>
  ${W.news.slice(0, 6).map(n => `<div class="c-c">${esc(n.txt)}</div>`).join('') || '<div class="c-y">NO NEWS IS GOOD NEWS</div>'}
  ${lastResultsTTX()}</div><div class="ttx inbox"><div class="ttxh"><span>P101</span><span>PIXTEXT</span><span>MAIL</span></div>
  ${W.inbox.length ? W.inbox.map(m => `<div class="msg ${m.read ? '' : 'unread'} ${UI.open === m.id ? 'open' : ''}" data-a="openMsg" data-id="${m.id}">
    <div class="mh"><span class="c-c">${esc(m.from)}</span><span class="c-d">${dateOf(m.s, m.w).replace(/ \d{4}$/, '')}</span></div><div class="c-y">${esc(m.subj)}</div>
    ${UI.open === m.id ? `<div class="mb">${esc(m.body)}</div>${msgActs(m)}` : ''}</div>`).join('') : '<div class="c-y">NO MESSAGES</div>'}</div>`;
}
function msgActs(m) {
  if (!m.act) return '';
  if (m.act.done) return `<div class="c-g">${esc(m.act.done)}</div>`;
  if (m.act.type === 'bid') return `<div class="acts"><button class="btn small go" data-a="bidYes" data-id="${m.id}">Accept</button><button class="btn small bad" data-a="bidNo" data-id="${m.id}">Reject</button></div>`;
  return '';
}
function answerBid(mid, yes) {
  const m = W.inbox.find(x => x.id === mid); if (!m || m.act.done) return;
  const p = P(m.act.pid), buyer = C(m.act.club), c = me();
  if (!p || p.club !== c.id) { m.act.done = 'No longer at the club.'; return rerender(); }
  if (yes) {
    if (c.squad.length <= 14) return toast('You need at least 14 players. Sign someone first.');
    moveP(p, buyer, m.act.amt); fixTeam(c);
    m.act.done = `Sold to ${buyer.name} for ${money(m.act.amt)}.`;
    news(`${pname(p).toUpperCase()} JOINS ${buyer.name.toUpperCase()} FROM ${c.short} FOR ${money(m.act.amt)}`);
    SND.good();
  } else {
    m.act.done = 'Rejected.';
    if (R() < .35 && buyer.cash > m.act.amt * 1.2) { const amt = Math.round(m.act.amt * 1.18 / 1000) * 1000; inbox(buyer.name, `Improved bid for ${pname(p)}`, `${buyer.name} have come back with ${money(amt)} for ${p.fn} ${p.ln}.`, {type: 'bid', pid: p.id, club: buyer.id, amt, w: W.week}); }
    else p.mor = clamp(p.mor + (p.listed ? -5 : 3), 5, 100);
  }
  save(); rerender();
}

// ---------- the weekly flow
function go() {
  cleanSquads();
  if (deadlineDue()) return startDeadline();
  // stale bids expire
  W.inbox.forEach(m => { if (m.act && m.act.type === 'bid' && !m.act.done && (m.s !== W.season || W.week - m.act.w > 2)) m.act.done = 'The offer expired.'; });
  const fx = userFixture();
  if (!fx) { UI.match = null; const rep = finishWeek(null); afterWeek(rep); return; }
  const c = me();
  if (W.settings.autoPick) autoPick(c); else { const out = fixTeam(c); if (out.length) toast(`Assistant: ${out.join(', ')} can't play, so I've changed the team.`); }
  if (c.xi.filter(x => x != null).length < 11) autoPick(c);
  const key = W.season * 100 + W.week;
  if (W.scenWeek !== key && W.week >= 1 && W.week - (W.lastScen ?? -9) >= 2 && R() < .45) { W.scenWeek = key; W.lastScen = W.week; return scenarioModal(); }
  W.scenWeek = key;
  UI.fx = fx; UI.press = derbyFx(fx) ? derbyPress(C(fx.h === W.clubId ? fx.a : fx.h)) : R() < .3 ? pressQ(fx) : null;
  UI.screen = 'prematch'; render();
}
function pressQ(fx) {
  const opp = C(fx.h === W.clubId ? fx.a : fx.h);
  return pick([
    {q: `${opp.name}'s manager says your lot are "a pub team". Your response?`, a: [['Let the football do the talking.', 2, 0], ["He'll be eating those words!", 5, -1], ['No comment.', 0, 0]]},
    {q: `Is the pressure getting to you, ${W.name}?`, a: [['Pressure? I love it.', 3, 1], ["We're taking it one game at a time.", 1, 1], ['Ask the board, not me.', -2, -3]]},
    {q: `Who's going to be the hero against ${opp.short} on Saturday?`, a: [['The fans. They are our twelfth man.', 2, 2], ['All eleven of them.', 2, 0], ['Me, obviously.', -1, -1]]},
    {q: `${opp.name} are ${ordinal(posIn(opp.id))}. Worried?`, a: [["We fear nobody.", 3, 0], ["They're a good side. We respect them.", 1, 1], ["I've not even heard of them.", -1, -2]]},
  ]);
}
function prematchHTML() {
  const fx = UI.fx, c = me(), home = fx.h === c.id, opp = C(home ? fx.a : fx.h);
  autoPick(opp);
  const mm = home ? new Match(c.id, opp.id, {}) : new Match(opp.id, c.id, {});
  const us = mm.power(home ? 0 : 1), them = mm.power(home ? 1 : 0);
  const cmp = (n, a, b) => { const tot = a + b; return `<div class="cmp"><span>${n}</span><div class="cmpbar"><i style="width:${a / tot * 100}%"></i></div><small>${a > b * 1.08 ? '<span class="c-g">Stronger</span>' : b > a * 1.08 ? '<span class="c-r">Weaker</span>' : 'Even'}</small></div>`; };
  const key = opp.xi.map(P).filter(Boolean).sort((a, b) => ovrOf(b) - ovrOf(a))[0];
  const theyBeat = BEATS[opp.style].includes(c.style), weBeat = BEATS[c.style].includes(opp.style);
  const pr = UI.press;
  return `<div class="top-simple"><button class="btn ghost small" data-a="backToGame">← Back</button><h2 class="px">MATCH DAY</h2></div>
  <div class="panel"><div class="nextfx">${badgeImg(home ? c : opp, 44)}<div class="vs"><small>${fx.cup ? `${esc(fx.label)}${fx.neutral ? ' · neutral ground' : ''}` : DIVS[c.div]}</small><b>${esc((home ? c : opp).short)} v ${esc((home ? opp : c).short)}</b><small>${esc(C(fx.h).name)} v ${esc(C(fx.a).name)}</small><div class="ttags">${teamTag(C(fx.h))}<span>v</span>${teamTag(C(fx.a))}</div></div>${badgeImg(home ? opp : c, 44)}</div></div>
  ${derbyFx(fx) ? `<div class="panel">${derbyBanner(opp, true)}</div>` : ''}<div class="panel">${tacBox(c, opp)}</div>
  <div class="panel"><h2>Scout report: ${esc(opp.name)}</h2>
    <p>${opp.formation}, plays <b class="c-y">${STYLES[opp.style].n}</b>. Form ${formHTML(opp.formStr)}. Danger man: <b>${key ? esc(pname(key)) + ' (' + ovrHTML(key) + ')' : '-'}</b></p>
    ${cmp('Defence', us.def, them.def)}${cmp('Midfield', us.mid, them.mid)}${cmp('Attack', us.att, them.att)}
    </div>
  <div class="panel"><h2>Your team · ${c.formation} · ${STYLES[c.style].n}</h2><div class="lineup">${c.xi.map((id, k) => id == null ? '' : `<span>${posTag(formSlots(c.formation)[k])} ${esc(P(id).ln)}</span>`).join('')}</div>
    <div class="acts"><button class="btn small" data-a="preTactics">Change tactics</button><button class="btn small" data-a="viewOpp" data-id="${opp.id}">View ${esc(opp.short)}</button></div></div>
  ${pr && !pr.done ? `<div class="panel press"><h2>📰 The press want a word</h2><p>"${esc(pr.q)}"</p><div class="answers">${pr.a.map((x, i) => `<button class="btn small" data-a="press" data-i="${i}">${esc(x[0])}</button>`).join('')}</div></div>` : pr ? `<div class="panel press"><p class="note">${esc(pr.done)}</p></div>` : ''}
  <div class="sticky two"><button class="btn big go" data-a="kickoff">KICK OFF ▶</button><button class="btn" data-a="quick">Quick result</button></div>`;
}

// ---------- quick-fire scenarios
function scenarioModal() {
  const sc = UI.scen = pickScenario();
  const s = sc.s, p = sc.pid != null ? P(sc.pid) : null;
  modal(`<div class="scen"><div class="scenh"><span>✉ ${esc(scenText(s.from, sc))}</span><small>${dateOf(W.season, W.week).replace(/ \d{4}$/, '')}</small></div>
    <div class="scenq">${p ? portrait(p, 44) : ''}<p>"${esc(scenText(s.q, sc))}"</p></div>
    <div class="answers">${s.a.map((a, i) => `<button class="btn" data-a="scen" data-i="${i}">${esc(scenText(a[0], sc))}${a[1].chance ? ' <span class="c-o">🎲</span>' : ''}</button>`).join('')}</div>
    <p class="note">🎲 = a gamble. It could go either way.</p></div>`, true);
}
function answerScenario(i) {
  const sc = UI.scen, a = sc.s.a[i];
  let eff = a[1], txt = a[2], gamble = null;
  if (eff.chance != null) { const win = R() < eff.chance; gamble = win; [eff, txt] = win ? eff.win : eff.lose; }
  W.scenSeen = (W.scenSeen || []).concat(sc.s.id).slice(-60);
  const out = applyScenario(eff, sc);
  if (bumpStat('scen') >= 20) ach('scen20');
  if (gamble && bumpStat('gamble') >= 5) ach('gambler');
  save();
  if (gamble != null) (gamble ? SND.good() : SND.bad()); else SND.click();
  modal(`<div class="scen"><div class="scenh"><span>${gamble == null ? 'You decided...' : gamble ? '🎲 It paid off!' : '🎲 It backfired!'}</span></div>
    <p class="scenr">${esc(scenText(txt, sc))}</p>
    <div class="effs">${out.map(([n, v]) => n === '£' ? `<span class="eff ${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : '−'}${money(Math.abs(v))}</span>` : typeof v === 'boolean' ? `<span class="eff ${v ? 'up' : 'down'}">${esc(n)}</span>` : `<span class="eff ${v > 0 ? 'up' : 'down'}">${esc(n)} ${v > 0 ? '▲' : '▼'}</span>`).join('') || '<span class="eff">No real change</span>'}</div>
    <div class="acts"><button class="btn go big wide" data-a="scenDone">Continue ▶</button></div></div>`, true);
}

// ---------- LIVE MATCH
let LM = null;
function startMatch(live) {
  const fx = UI.fx, c = me(), home = fx.h === c.id;
  const m = new Match(fx.h, fx.a, {cup: fx.cup, neutral: fx.neutral, live, userSide: home ? 0 : 1});
  if (!live) { m.sim(); return fullTime(m); }
  UI.screen = 'match'; render();
  const S = m.sides;
  $('#app').innerHTML = `<div class="match">
    <div class="scorebar"><div class="tm">${badgeImg(S[0].c, 22)}<div class="tn"><b>${esc(S[0].c.short)}</b>${teamTag(S[0].c)}</div></div><div class="sc"><b id="sc0">0</b>-<b id="sc1">0</b><small id="min">0'</small></div><div class="tm r"><div class="tn"><b>${esc(S[1].c.short)}</b>${teamTag(S[1].c)}</div>${badgeImg(S[1].c, 22)}</div></div>
    <div class="pwrap"><canvas id="pitch"></canvas></div>
    <div class="mstats" id="mstats"></div>
    <div class="comm" id="comm"></div>
    <div class="mctl"><button class="btn small" data-a="mTactics">⏸ Tactics</button><button class="btn small" data-a="mSpeed" id="spd">${['', 'Slow', 'Normal', 'Fast'][W.settings.speed]}</button><button class="btn small" data-a="mSkip">Skip ⏭</button></div>
  </div>`;
  const pitch = new Pitch($('#pitch'), S[0].c, S[1].c, [S[0].form, S[1].form], W.settings.zoom !== false);
  pitch.setForms([S[0].form, S[1].form], [S[0].on, S[1].on]);
  LM = {m, pitch, paused: false, next: performance.now() + 900, lines: [], raf: 0, skip: false, busy: false};
  SND.whistle();
  addLine({txt: `KICK OFF! ${C(fx.h).name} v ${C(fx.a).name}`, t: 'ko'});
  let last = performance.now();
  const loop = now => {
    if (!LM || LM.m !== m) return;
    const dt = Math.min(50, now - last); last = now;
    if (!LM.paused && !LM.busy && now >= LM.next && !m.done) tick();
    pitch.update(dt); pitch.draw();
    LM.raf = requestAnimationFrame(loop);
  };
  LM.raf = requestAnimationFrame(loop);
}
const SPEED_MS = [0, 700, 330, 110];
function tick() {
  const m = LM.m, ms = SPEED_MS[W.settings.speed];
  const before = m.log.length;
  m.step();
  handleEvents(m.log.slice(before), ms);
}
function handleEvents(evs, ms) {
  const m = LM.m;
  let pause = ms;
  const shot = evs.find(e => ['goal', 'save', 'miss', 'post'].includes(e.t));
  LM.pitch.playMinute({poss: shot ? shot.s : m.ball ?? 0, shot: shot ? shot.t : null, shotSide: shot ? shot.s : 0}, Math.max(ms, shot ? 700 : 0));
  evs.forEach(e => {
    addLine(e);
    if (e.t === 'goal') { pause = Math.max(pause, 2200); setTimeout(() => { if (!LM) return; LM.pitch.banner('GOAL!', e.s === m.userSide ? '#3ddc5a' : '#ff4b55', 1600); LM.pitch.celebrate(e.s, 1500); SND.roar(); }, 650); }
    if (e.t === 'save' || e.t === 'post') { pause = Math.max(pause, 1100); setTimeout(() => SND.ooh(), 600); }
    if (e.t === 'rc') { pause = Math.max(pause, 1500); LM.pitch.banner('RED CARD', '#ff4b55', 1200); }
    if (e.t === 'yc') SND.whistle();
    if (e.t === 'sub' || e.t === 'rc' || e.t === 'inj') LM.pitch.setForms([m.sides[0].form, m.sides[1].form], [m.sides[0].on, m.sides[1].on]);
  });
  updateScore();
  if (LM.skip) pause = 0;
  LM.next = performance.now() + pause;
  const ht = evs.find(e => e.t === 'ht'), et = evs.find(e => e.t === 'et');
  if (m.pending) { LM.busy = true; setTimeout(() => runPending(), LM.skip ? 0 : Math.min(pause, 900)); return; }
  if (m.done) { LM.busy = true; SND.whistle(3); setTimeout(() => fullTime(m), LM.skip ? 100 : 1600); return; }
  if (ht && !LM.skip) { LM.busy = true; SND.whistle(2); setTimeout(() => halfTime(), 900); }
  if (et && !LM.skip) { LM.busy = true; SND.whistle(2); setTimeout(() => { LM.busy = false; toast('Extra time! 30 more minutes.'); }, 900); }
}
function addLine(e) {
  const comm = $('#comm'); if (!comm) return;
  const cls = {goal: 'c-g', rc: 'c-r', yc: 'c-y', save: 'c-c', post: 'c-c', ht: 'c-m', ft: 'c-m', pen: 'c-o', fk: 'c-o', sub: 'c-d', inj: 'c-r', et: 'c-m', pens: 'c-m', shootout: 'c-o'}[e.t] || '';
  const mine = e.s === LM.m.userSide;
  LM.lines.unshift(`<div class="${cls} ${e.t === 'goal' ? (mine ? 'gl us' : 'gl them') : ''}">${e.m != null ? `<span class="c-d">${e.m}'</span> ` : ''}${esc(e.txt)}</div>`);
  LM.lines = LM.lines.slice(0, 6);
  comm.innerHTML = LM.lines.join('');
}
function updateScore() {
  const m = LM.m, S = m.sides;
  $('#sc0').textContent = S[0].g; $('#sc1').textContent = S[1].g; $('#min').textContent = m.minute + "'";
  const pos = Math.round(S[0].poss / Math.max(1, S[0].poss + S[1].poss) * 100);
  $('#mstats').innerHTML = `<span>${pos}%</span><span>Possession</span><span>${100 - pos}%</span><span>${S[0].sh} (${S[0].sot})</span><span>Shots (on target)</span><span>${S[1].sh} (${S[1].sot})</span>`;
}
async function runPending() {
  const m = LM.m, pd = m.pending, us = m.sides[m.userSide], them = m.sides[1 - m.userSide];
  if (!pd) { LM.busy = false; return; }
  if (LM.skip) { if (pd.type === 'shootout') m.resolveShootout(m.autoShootout()); else m.resolve(pd.type === 'fk' ? R() < .12 : R() < penChance(P(pd.taker), pd.gk != null ? P(pd.gk) : null)); return afterPending(); }
  const gkKit = s => ({shirt: '#33d17a', shorts: s.c.c2});
  const oppGkKit = {shirt: '#e6e62e', shorts: '#1a1a1a'};
  if (pd.type === 'shootout') {
    const takers = s => s.on.filter(id => id != null).map(P).sort((a, b) => (b.a.sho + (b.tr === 'deadball' ? 6 : 0)) - (a.a.sho + (a.tr === 'deadball' ? 6 : 0)));
    const sc = await shootout({us: {short: us.c.short, takers: takers(us), gk: P(m.keeper(us)), kit: kitOf(us.c), gkKit: gkKit(us)}, them: {short: them.c.short, takers: takers(them), gk: P(m.keeper(them)), kit: kitOf(them.c), gkKit: oppGkKit}});
    m.resolveShootout(m.userSide === 0 ? sc : [sc[1], sc[0]]);
    const b = best(); if (sc[0] > sc[1]) { b.pens++; lset(BEST, b); ach('shootout'); }
  } else {
    const taker = P(pd.taker), gk = pd.gk != null ? P(pd.gk) : null;
    let goal;
    if (pd.type === 'pen-shoot') goal = await penShoot({taker, gk, kit: kitOf(us.c), gkKit: oppGkKit});
    else if (pd.type === 'pen-save') goal = await penSave({taker, gk, kit: kitOf(them.c), gkKit: gkKit(us)});
    else goal = await freeKick({taker, gk, kit: kitOf(us.c), gkKit: oppGkKit, wallKit: kitOf(them.c)});
    const e = m.resolve(goal);
    if (pd.type === 'pen-shoot' && goal) ach('pen_score');
    if (pd.type === 'pen-save' && !goal) ach('pen_save');
    if (pd.type === 'fk' && goal) ach('fk_goal');
    addLine(e);
    if (goal) { LM.pitch.banner('GOAL!', pd.type === 'pen-save' ? '#ff4b55' : '#3ddc5a', 1500); LM.pitch.celebrate(pd.type === 'pen-save' ? 1 - m.userSide : m.userSide, 1500); }
  }
  afterPending();
}
function afterPending() {
  const m = LM.m;
  m.log.slice(-3).forEach(e => { if (e.t === 'ft' || e.t === 'pens') addLine(e); });
  updateScore();
  if (m.done) { setTimeout(() => fullTime(m), 1200); return; }
  if (m.minute >= m.end) { const out = []; m.finishTime(out); out.forEach(addLine); if (m.pending) return runPending(); if (m.done) return setTimeout(() => fullTime(m), 1200); }
  LM.busy = false; LM.next = performance.now() + 800;
}
function halfTime() {
  const m = LM.m, us = m.sides[m.userSide], them = m.sides[1 - m.userSide];
  const diff = us.g - them.g;
  modal(`<h3>HALF TIME: ${m.sides[0].c.short} ${m.sides[0].g}-${m.sides[1].g} ${m.sides[1].c.short}</h3>
    <p>The lads trudge into the dressing room. What do you say?</p>
    <div class="answers"><button class="btn" data-a="talk" data-k="praise">"Brilliant, lads. More of the same!"</button>
    <button class="btn" data-a="talk" data-k="calm">"Stay calm. Stick to the plan."</button>
    <button class="btn bad" data-a="talk" data-k="hair">THE HAIRDRYER 💨</button></div>
    <p class="note">${diff > 0 ? "You're winning." : diff < 0 ? "You're losing." : "It's level."} You can also change tactics and make subs.</p>
    <div class="acts"><button class="btn small" data-a="mTactics">Tactics &amp; subs</button></div>`, true);
}
function teamTalk(k) {
  const m = LM.m, us = m.sides[m.userSide], diff = us.g - m.sides[1 - m.userSide].g;
  const eff = {praise: diff > 0 ? 8 : diff === 0 ? 2 : -6, calm: 3, hair: diff < 0 ? 10 : diff === 0 ? 3 : -8}[k];
  us.on.forEach(id => { if (id != null) P(id).mor = clamp(P(id).mor + eff, 5, 100); });
  const say = eff >= 8 ? 'The players look fired up!' : eff > 0 ? 'The players nod along.' : 'The players look fed up with you...';
  toast(say); closeModal(); LM.busy = false; LM.next = performance.now() + 600;
  SND.whistle();
}
function matchTactics() {
  if (!LM) return;
  LM.paused = true;
  const m = LM.m, s = m.sides[m.userSide], slots = formSlots(s.form);
  const sel = UI.msel;
  modal(`<h3>Tactics · ${m.minute}' · ${s.subsLeft} sub${s.subsLeft === 1 ? '' : 's'} left</h3>
    <div class="chips small">${Object.keys(STYLES).map(k => `<button class="chip ${s.style === k ? 'on' : ''}" data-a="mStyle" data-s="${k}">${STYLES[k].n}</button>`).join('')}</div>
    <div class="chips small">${Object.keys(FORMS).map(f => `<button class="chip ${s.form === f ? 'on' : ''}" data-a="mForm" data-f="${f}">${f}</button>`).join('')}</div>
    <p class="note">Tap a player on the pitch, then a sub to bring on.</p>
    <table class="tbl"><tbody>${s.on.map((id, k) => id == null ? `<tr class="dim"><td>${posTag(slots[k])}</td><td colspan="3">(sent off / empty)</td></tr>` : `<tr data-a="mSel" data-id="${id}" class="${sel === id ? 'me' : ''}"><td>${posTag(slots[k])}</td><td class="nm">${esc(pname(P(id)))}${s.yc[id] ? ' <span class="tag y">YC</span>' : ''}${s.injured && s.injured[id] ? ' <span class="tag r">INJ</span>' : ''}</td><td class="${ovrCol(ovr(P(id), slots[k]))}">${ovr(P(id), slots[k])}</td><td>${bar(s.fit[id], 100, fitCls(s.fit[id]))}</td></tr>`).join('')}</tbody></table>
    <h3 class="divh">Bench</h3>
    <table class="tbl"><tbody>${s.bench.map(id => `<tr data-a="mSubIn" data-id="${id}" class="${sel == null || s.subsLeft <= 0 ? 'dim' : ''}"><td>${posTag(P(id).pos)}</td><td class="nm">${esc(pname(P(id)))}</td><td class="${ovrCol(ovr(P(id)))}">${ovr(P(id))}</td><td>${bar(P(id).fit, 100, fitCls(P(id).fit))}</td></tr>`).join('') || '<tr><td>No subs left on the bench.</td></tr>'}</tbody></table>
    <div class="acts"><button class="btn go" data-a="mResume">Back to the game ▶</button></div>`, true);
}
function fullTime(m) {
  if (LM) { cancelAnimationFrame(LM.raf); LM = null; }
  closeModal();
  UI.match = m; UI.screen = 'ft';
  const S = m.sides, us = m.userSide >= 0 ? m.userSide : (S[0].id === W.clubId ? 0 : 1), mine = S[us];
  m.userSide = us;
  const won = m.winner() === us, lost = m.winner() === 1 - us;
  if (won) SND.good(); else if (lost) SND.bad();
  const goals = side => m.log.filter(e => e.t === 'goal' && e.s === side).map(e => `${esc(pname(P(e.pid)))} ${e.m}'${e.kind === 'pen' ? ' (pen)' : ''}`).join('<br>') || '&nbsp;';
  const rated = [...mine.played].filter(id => P(id)).map(id => ({p: P(id), r: clamp(Math.round(mine.rt[id] * 10) / 10, 3, 10)})).sort((a, b) => b.r - a.r);
  $('#app').innerHTML = `<div class="top-simple"><h2 class="px">FULL TIME</h2></div>
  <div class="panel ftbox"><div class="ftscore"><div>${badgeImg(S[0].c, 40)}<b>${esc(S[0].c.short)}</b></div><div class="big">${S[0].g} - ${S[1].g}</div><div>${badgeImg(S[1].c, 40)}<b>${esc(S[1].c.short)}</b></div></div>
    ${m.pens ? `<p class="c-y center">${m.pens[0]}-${m.pens[1]} on penalties</p>` : ''}
    <div class="scorers"><div>${goals(0)}</div><div>${goals(1)}</div></div>
    <p class="center ${won ? 'c-g' : lost ? 'c-r' : 'c-y'} px">${won ? 'VICTORY!' : lost ? 'DEFEAT' : 'A DRAW'}</p>
    ${m.log.some(e => e.t === 'goal') ? '<button class="btn wide" data-a="highlights">▶ Watch the goals</button>' : ''}</div>
  ${won && m.cup && UI.fx && UI.fx.final ? `<canvas id="cupcv" class="trophycv" data-title="${UI.fx.euro ? 'KINGS OF EUROPE!' : 'CUP WINNERS!'}"></canvas>` : ''}
  <div class="panel"><h2>Stats</h2><div class="mstats">${(() => { const pos = Math.round(S[0].poss / Math.max(1, S[0].poss + S[1].poss) * 100); return `<span>${pos}%</span><span>Possession</span><span>${100 - pos}%</span><span>${S[0].sh}</span><span>Shots</span><span>${S[1].sh}</span><span>${S[0].sot}</span><span>On target</span><span>${S[1].sot}</span>`; })()}</div></div>
  <div class="panel"><h2>Your player ratings</h2><table class="tbl"><tbody>${rated.map((x, i) => `<tr><td>${posTag(x.p.pos)}</td><td class="nm">${esc(pname(x.p))}${i === 0 ? ' <span class="tag y">STAR</span>' : ''}${mine.gl[x.p.id] ? ' ' + '⚽'.repeat(mine.gl[x.p.id]) : ''}</td><td class="${x.r >= 7.5 ? 'c-g' : x.r < 6 ? 'c-r' : 'c-y'}">${x.r.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
  <div class="sticky"><button class="btn go big wide" data-a="ftContinue">Continue ▶</button></div>`;
  window.scrollTo(0, 0);
  if ($('#cupcv')) { trophyScene($('#cupcv'), kitOf(mine.c), $('#cupcv').dataset.title); MUSIC.want('anthem'); }
}
function afterWeek(rep) {
  W.lastWeek = {cup: rep.cup, results: rep.results.map(r => ({h: r.h, a: r.a, hg: r.hg, ag: r.ag, pens: r.pens, d: r.d}))};
  if (rep.user && rep.gate != null) W.lastGate = {gate: rep.gate, att: rep.user.att};
  if (rep.user) { try { achAfterMatch(rep); } catch (e) { console.error(e); } }
  UI.rep = rep; UI.screen = 'week'; save(); render();
}
function weekHTML() {
  const rep = UI.rep, c = me();
  const grew = c.squad.map(P).filter(p => p.grew && p.grewShown !== p.grew);
  grew.forEach(p => p.grewShown = p.grew);
  const groups = rep.cup ? [...new Set(rep.results.map(r => r.label))].map(l => [(l || CUP_NAME).toUpperCase(), rep.results.filter(r => r.label === l)]) : [0, 1, 2, 3].map(d => [DIVS[d].toUpperCase(), rep.results.filter(r => r.d === d)]);
  groups.sort((a, b) => (b[1].some(r => r.h === c.id || r.a === c.id) ? 1 : 0) - (a[1].some(r => r.h === c.id || r.a === c.id) ? 1 : 0));
  return `<div class="top-simple"><h2 class="px">RESULTS</h2></div>
  <div class="ttx vidi"><div class="ttxh"><span>P303</span><span>VIDIPRINTER</span><span>${dateOf(W.season, W.week - 1).toUpperCase()}</span></div>
    ${groups.map(([n, rs]) => `<div class="c-y">${n}</div>${rs.map(resLine).join('')}`).join('')}</div>
  <div class="panel"><h2>Your week</h2>
    ${rep.user ? (() => { const r = rep.user, home = r.h === c.id, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg, wl = r.win != null ? (r.win === c.id ? 'W' : 'L') : gf > ga ? 'W' : gf < ga ? 'L' : 'D'; return `<p><span class="fm ${wl}">${wl}</span> ${gf}-${ga}${r.pens ? ' (pens)' : ''} ${home ? 'v' : 'at'} ${esc(C(home ? r.a : r.h).name)}. ${r.cup ? '' : `You're ${ordinal(posIn(c.id))}.`}</p>`; })() : ''}
    ${rep.user && rep.user.derby ? `<div class="derbyb"><b>🔥 ${rep.user.derby === 'w' ? 'DERBY WIN!' : rep.user.derby === 'l' ? 'DERBY DEFEAT' : 'DERBY DRAW'}</b><span>${rep.user.derby === 'w' ? 'The town is yours. Fans, board and players all buzzing.' : rep.user.derby === 'l' ? "Fans furious, the chairman isn't happy and the lads are gutted." : 'Honours even. Nobody gets bragging rights this time.'}</span></div>` : ''}
    ${rep.user ? `<p>${rep.gate ? `Gate receipts <b class="c-g">${money(rep.gate)}</b> (${rep.user.att.toLocaleString()} fans). ` : ''}${rep.boxes ? `Boxes <b class="c-g">${money(rep.boxes)}</b>. ` : ''}Wages <b class="c-r">−${money(rep.wages)}</b>. TV <b class="c-g">${money(rep.tv)}</b>.${rep.shop ? ` Shop <b class="c-g">${money(rep.shop)}</b>.` : ''}</p>` : `<p>Wages <b class="c-r">−${money(rep.wages)}</b>. TV <b class="c-g">${money(rep.tv)}</b>.${rep.shop ? ` Shop <b class="c-g">${money(rep.shop)}</b>.` : ''}</p>`}
    ${rep.msgs.map(t => `<div>• ${esc(t)}</div>`).join('')}
    ${grew.map(p => `<div class="c-g">▲ ${esc(pname(p))} has improved in training! Now ${ovr(p)}.</div>`).join('')}
    ${c.squad.map(P).filter(p => p.injNew === undefined && p.inj && rep.user && [...(UI.match ? UI.match.sides[UI.match.userSide].played : [])].includes(p.id) && UI.match && UI.match.sides[UI.match.userSide].injured && UI.match.sides[UI.match.userSide].injured[p.id]).map(p => `<div class="c-r">✚ ${esc(pname(p))} is injured for ${p.inj} week${p.inj > 1 ? 's' : ''}.</div>`).join('')}
    ${c.squad.map(P).filter(p => p.sus && UI.match && UI.match.sides[UI.match.userSide].reds && UI.match.sides[UI.match.userSide].reds[p.id]).map(p => `<div class="c-o">■ ${esc(pname(p))} is suspended for ${p.sus} game${p.sus > 1 ? 's' : ''}.</div>`).join('')}
    ${W.board.conf < 25 ? '<div class="c-r">The board are getting twitchy. Results, please!</div>' : ''}
  </div>
  <div class="sticky"><button class="btn go big wide" data-a="weekDone">${rep.seasonOver ? 'End of season ▶' : 'Continue ▶'}</button></div>`;
}

// ---------- end of season
function seasonHTML() {
  const S = UI.season, u = S.user, c = me();
  const offers = UI.offers || [];
  const exp = (u.expired || []).map(P).filter(Boolean);
  UI.renew = UI.renew || Object.fromEntries(exp.map(p => [p.id, p.age < 33]));
  const ttl = u.pos === 1 ? 'CHAMPIONS!' : (u.koWon || []).some(k => k === 'ecc' || k === 'fairs') ? 'KINGS OF EUROPE!' : u.cupRound === 6 || (u.koWon || []).length ? 'CUP WINNERS!' : u.pos <= 2 && u.div > 0 ? 'PROMOTED!' : '';
  return `<div class="top-simple"><h2 class="px">SEASON ${seasonLabel(S.season)}</h2></div>
  ${ttl ? `<canvas id="trophycv" class="trophycv" data-title="${ttl}"></canvas>` : ''}
  <div class="panel center"><div>${badgeImg(C(u.club), 48)}</div><h2>${esc(C(u.club).name)}</h2>
    <div class="big c-y">${ordinal(u.pos)} in ${DIVS[u.div]}</div><p>${u.pts} points · ${u.cupRound === 6 ? `<b class="c-y">${CUP_NAME} WINNERS!</b>` : `${CUP_NAME}: out in the ${CUP_ROUNDS[Math.max(0, u.cupRound)] || 'early rounds'}`}${u.ko && u.ko.res ? `<br>${esc(u.ko.name)}: ${u.ko.res === 'Winners' ? '<b class="c-y">WINNERS!</b>' : esc(u.ko.res.toLowerCase().replace(/^out/, 'out'))}` : ''}</p>
    ${u.trophies.map(t => `<div class="trophy">🏆 ${esc(t)}</div>`).join('')}
    <p class="${u.sacked ? 'c-r' : 'c-g'}">${esc(u.verdict)}</p><p>+${u.careerAdd} manager points (career total <b class="c-y">${W.career.pts}</b>)</p></div>
  <div class="panel"><h2>Awards</h2>${u.best ? `<div>Your player of the season: <b>${esc(pname(P(u.best)) || '')}</b></div>` : ''}${u.top ? `<div>Your top scorer: <b>${esc(pname(P(u.top[0])))}</b> (${u.top[1]})</div>` : ''}
    ${S.awards.map(a => `<div><span class="c-c">${DIVS[a.d]}:</span> champions ${esc(C(a.champ).name)}${a.scorer && P(a.scorer[0]) ? `, golden boot ${esc(pname(P(a.scorer[0])))} (${a.scorer[1]})` : ''}</div>`).join('')}
    <div><span class="c-c">${CUP_NAME}:</span> ${S.cupWinner != null ? esc(C(S.cupWinner).name) : '-'}</div>
    ${(S.koWinners || []).filter(([, w]) => w != null).map(([n, w]) => `<div><span class="c-c">${esc(n)}:</span> ${esc(C(w).name)}${C(w).foreign ? ` (${C(w).country})` : ''}</div>`).join('')}</div>
  <div class="panel"><h2>Ups and downs</h2><div class="c-g">▲ ${S.promoted.map(([id]) => esc(C(id).name)).join(', ')}</div><div class="c-r">▼ ${S.relegated.map(([id]) => esc(C(id).name)).join(', ')}</div></div>
  ${u.retired ? `<div class="panel"><h2>Retirements</h2><p>${u.retired.map(esc).join(', ')} hung up their boots.</p></div>` : ''}
  ${!u.sacked && exp.length ? `<div class="panel"><h2>Contracts up</h2><p class="note">Tick who you want to keep. The rest leave on a free.</p>${exp.map(p => `<label class="tog"><input type="checkbox" data-a="renewTick" data-id="${p.id}" ${UI.renew[p.id] ? 'checked' : ''}> ${posTag(p.pos)} ${esc(pname(p))} (${p.age}, ${ovr(p)}) wants ${money(wageDemand(Object.assign({}, p, {club: c.id}), c.div))}/wk</label>`).join('')}</div>` : ''}
  ${!u.sacked && u.youth && u.youth.length ? `<div class="panel"><h2>Youth intake</h2><p class="note">Fresh-faced kids from the youth team. Keep an eye on their potential!</p>${u.youth.map(id => P(id)).filter(Boolean).map(p => `<div class="row" data-a="player" data-id="${p.id}">${posTag(p.pos)} ${esc(p.fn)} ${esc(p.ln)} (${p.age}) · ${ovr(p)} · ${stars(p)}</div>`).join('')}</div>` : ''}
  ${offers.length ? `<div class="panel alert"><h2>${u.sacked ? "You're sacked! Job offers" : 'Job offers'}</h2><p class="note">${u.sacked ? 'Pick your next club.' : 'Other chairmen have noticed you. Fancy a move?'}</p>${offers.map(id => `<button class="clubpick wide" data-a="takeJob" data-id="${id}">${badgeImg(C(id), 22)}<span>${esc(C(id).name)} <small>(${DIVS[C(id).div]})</small></span></button>`).join('')}</div>` : ''}
  <div class="sticky">${u.sacked ? '' : `<button class="btn go big wide" data-a="nextSeason">${offers.length ? `Stay at ${esc(c.short)} and ` : ''}Start ${seasonLabel(S.season + 1)} ▶</button>`}</div>`;
}
function sackedHTML() { return ''; }

// ---------- arcade
function arcadeHTML() {
  const b = best();
  return `<div class="top-simple"><button class="btn ghost small" data-a="toTitle">← Back</button><h2 class="px">ARCADE</h2></div>
  <div class="panel arc"><h2>⚽ Keepy-uppy</h2><p>Tap the ball to keep it in the air. Tap the side of the ball to steer it.</p><p class="note">Best: ${b.keepy}</p><button class="btn go" data-a="arc" data-k="keepy">Play</button></div>
  <div class="panel arc"><h2>🎯 Free-kick challenge</h2><p>Ten free kicks. Aim, curl, power. Bend it round the wall!</p><p class="note">Best: ${b.fk}/10</p><button class="btn go" data-a="arc" data-k="fk">Play</button></div>
  <div class="panel arc"><h2>🥅 Penalty shoot-out</h2><p>Five each, then sudden death. Take yours, then dive to save theirs.</p><p class="note">Shoot-outs won: ${b.pens}</p><button class="btn go" data-a="arc" data-k="pens">Play</button></div>`;
}
async function arcade(k) {
  const b = best(), you = W ? me() : {c1: '#d8242c', c2: '#ffffff', short: 'YOU'};
  const fake = (sho, gk) => ({a: {sho, gk, pas: 10, pac: 10, tkl: 10}, fn: 'You', ln: '', tr: null});
  if (k === 'keepy') {
    const n = await keepyUppy({kit: kitOf(you), best: b.keepy});
    if (n > b.keepy) { b.keepy = n; lset(BEST, b); }
    if (n >= 50) ach('keepy50'); if (n >= 100) ach('keepy100');
    if (n > 0 && window.FamilyScores) FamilyScores.submit('pixelgaffer', 'keepy', n, {fallbackName: W && W.name});
  } else if (k === 'fk') {
    const ov = miniOverlay('FREE-KICK CHALLENGE', '', {skip: false});
    let goals = 0;
    for (let i = 0; i < 10 && !ov.quit; i++) {
      ov.score(`Kick ${i + 1}/10 · ${goals} goal${goals === 1 ? '' : 's'}`);
      ov.cv.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
      const ok = await freeKick({taker: fake(14), gk: fake(5, 9 + i * .5), kit: kitOf(you), wallKit: {shirt: '#1d3fbf', shorts: '#fff'}}, ov);
      if (ok && !ov.quit) goals++;
    }
    ov.close();
    if (ov.quit) return rerender();
    if (goals > b.fk) { b.fk = goals; lset(BEST, b); }
    if (goals >= 8) ach('fk8');
    toast(`<b>${goals}/10</b> free kicks scored!`);
    if (window.FamilyScores) FamilyScores.submit('pixelgaffer', 'freekick', goals, {fallbackName: W && W.name});
  } else {
    const opp = pick(CLUBS);
    const takers = n => Array.from({length: 5}, () => fake(10 + R() * 6, 10));
    const sc = await shootout({us: {short: you.short || 'YOU', takers: takers(), gk: fake(5, 12), kit: kitOf(you)}, them: {short: opp[1], takers: takers(), gk: fake(5, 11), kit: {shirt: opp[2], shorts: opp[3]}}});
    if (sc[0] > sc[1]) { b.pens++; lset(BEST, b); ach('shootout'); }
    toast(sc[0] > sc[1] ? '<b>You won the shoot-out!</b>' : 'Beaten on penalties...');
  }
  rerender();
}
async function drill(k) {
  const c = me(), b = best();
  if (k === 'keepy') {
    const n = await keepyUppy({kit: kitOf(c), best: b.keepy});
    if (n > b.keepy) { b.keepy = n; lset(BEST, b); }
    if (n >= 50) ach('keepy50'); if (n >= 100) ach('keepy100');
    if (n > 0 && window.FamilyScores) FamilyScores.submit('pixelgaffer', 'keepy', n, {fallbackName: W.name});
    W.drill = Math.min(1, n / 30);
    c.squad.forEach(id => P(id).mor = clamp(P(id).mor + Math.min(8, n / 4), 5, 100));
    toast(`${n} touches! Training bonus +${Math.round(W.drill * 100)}%.`);
  } else {
    const ov = miniOverlay('FREE-KICK PRACTICE', '', {skip: false});
    const taker = c.squad.map(P).sort((x, y) => y.a.sho - x.a.sho)[0], gk = c.squad.map(P).filter(p => p.pos === 'GK').sort((x, y) => y.a.gk - x.a.gk)[1] || null;
    let goals = 0;
    for (let i = 0; i < 5 && !ov.quit; i++) { ov.score(`Kick ${i + 1}/5 · ${goals} scored`); ov.cv.getContext('2d').setTransform(1, 0, 0, 1, 0, 0); const ok = await freeKick({taker, gk, kit: kitOf(c), wallKit: {shirt: '#ff8a1f', shorts: '#ff8a1f'}}, ov); if (ok && !ov.quit) goals++; }
    ov.close();
    W.drill = goals / 5;
    if (goals >= 3 && taker) { taker.a.sho = clamp(taker.a.sho + .5, 1, 20); toast(`${goals}/5! ${esc(pname(taker))}'s shooting improved. Training bonus +${Math.round(W.drill * 100)}%.`); }
    else toast(`${goals}/5. Training bonus +${Math.round(W.drill * 100)}%.`);
  }
  W.drillWeek = W.week + W.season * 100;
  save(); rerender();
}

// ---------- modal
function modal(html, sticky) { closeModal(); const el = document.createElement('div'); el.className = 'modal'; el.innerHTML = `<div class="mbox">${html}</div>`; if (!sticky) el.addEventListener('click', e => { if (e.target === el) ACT.close(); }); document.body.appendChild(el); UI.modal = el; }
function closeModal() { if (UI.modal) UI.modal.remove(); UI.modal = null; }
function howto() {
  modal(`<h3>How to play</h3><div class="howto">
  <p><b class="c-y">1. Hit PLAY ▶</b> to go to the next match. Your assistant picks the team until you change it.</p>
  <p><b class="c-y">2. Watch the game</b> in glorious pixels, or take a quick result. At half time give a team talk. Pause to make subs or change style.</p>
  <p><b class="c-y">3. Take the big moments yourself.</b> When you win a penalty or a free kick, you take it: tap to aim, tap for power. When they get a penalty, tap where to dive!</p>
  <p><b class="c-y">4. Styles beat styles.</b> Passing beats Long Ball, Counter beats All-out Attack and so on. The scout report before each game tells you what to pick.</p>
  <p><b class="c-y">5. Train the lads</b> in CLUB. Young players grow fastest. Run a drill each week for a bonus.</p>
  <p><b class="c-y">6. Buy and sell</b> in MARKET. Haggle with chairmen, but don't push them too far!</p>
  <p><b class="c-y">7. Keep the board happy.</b> Hit your target, climb the divisions, win the ${CUP_NAME}.</p></div>
  <button class="btn go" data-a="close">Got it</button>`);
}

// ---------- actions
const ACT = {
  newGame() { if (!anySave()) { UI.slot = 1; UI.screen = 'new'; UI.newClub = null; return render(); } modal(slotsHTML('new')); },
  slots() { modal(slotsHTML('load')); },
  slotNew(d) { const n = +d.n; if (slotInfo(n) && !confirm(`Start a new career in slot ${n}? The career saved there will be lost.`)) return; closeModal(); UI.slot = n; W = null; UI.screen = 'new'; UI.newClub = null; render(); },
  slotLoad(d) { closeModal(); save(); UI.slot = +d.n; lset('pixelgaffer-slot', UI.slot); ACT.continueGame(); },
  slotDel(d) { const n = +d.n; if (!confirm(`Delete the career in slot ${n}? This can't be undone.`)) return; try { localStorage.removeItem(slotKey(n)); } catch (e) {} if (W && UI.slot === n) W = null; modal(slotsHTML('load')); if (UI.screen === 'title') rerender(); },
  slotRestore(d, el) { if (el.files && el.files[0]) restoreSave(+d.n, el.files[0]); },
  backup() { exportSave(); },
  achs() { modal(`<h3>🏆 Achievements</h3>${achHTML()}<button class="btn go" data-a="close">Close</button>`); },
  musicToggle() { MUSIC.on = !MUSIC.on; if (MUSIC.on) MUSIC.want('title'); rerender(); },
  musicSet(d, el) { MUSIC.on = el.checked; },
  tour() { startTour(); },
  tourNext() { UI.tour++; showTour(); },
  tourEnd() { endTour(); },
  scout(d) { const c = me(), cost = scoutCost(); if (c.cash < cost) return toast("You can't afford the scout."); c.cash -= cost; scoutPlayers([+d.id]); save(); toast('Your scout has seen him play. Full report ready!'); playerModal(+d.id); },
  scoutSquad(d) { const c = me(), cost = scoutCost() * 4, o = C(+d.id); if (c.cash < cost) return toast("You can't afford the scouts."); c.cash -= cost; scoutPlayers(o.squad); save(); toast(`Your scouts have watched ${esc(o.name)}. Full reports ready!`); oppModal(o.id); },
  loanIn(d) { const p = P(+d.id); if (!confirm(`Take ${pname(p)} on loan until the end of the season for ${money(loanFee(p))}? You pay his wages (${money(p.wage)}/wk).`)) return; loanInPlayer(p); fixTeam(me()); UI.ret = null; closeModal(); save(); rerender(); },
  loanOut(d) { const p = P(+d.id); if (!confirm(`Send ${pname(p)} out on loan until the end of the season? He'll play regularly and come back better.`)) return; loanOutPlayer(p); UI.ret = null; closeModal(); save(); rerender(); },
  highlights() { showHighlights(UI.match); },
  openMsgHome(d) { UI.open = d.id; const m = W.inbox.find(x => x.id === d.id); if (m) m.read = true; UI.tab = 'news'; save(); render(); },
  continueGame() { W = loadSave(); if (!W) return toast('No saved career in that slot.'); NEXT_ID = W.nextId; if (!W.training) W.training = {focus: 'balanced', int: 1}; cleanSquads(); if (!W.clubs.some(c => c.foreign)) addForeignClubs(); if (!W.ko) W.ko = {}; UI.screen = W.pendingSeason ? 'season' : 'game'; UI.tab = 'home'; if (W.pendingSeason) { UI.season = W.pendingSeason; UI.offers = W.pendingOffers || []; } render(); },
  arcade() { UI.screen = 'arcade'; W = W || loadSave(); render(); },
  howto,
  toTitle() { save(); UI.screen = 'title'; render(); },
  ddDo(d) { if (DD && DD.i < DD.deals.length) ddResolve(d.r); },
  ddEnd() { clearInterval(ddTimer); DD = null; UI.screen = 'game'; UI.tab = 'home'; render(); go(); },
  saveQuit() { save(); UI.screen = 'title'; render(); toast(`💾 Career saved: <b>${esc(me().name)}</b>, ${dateOf(W.season, W.week)}`); },
  pickClub(d) { UI.newName = $('#mname').value; UI.newClub = +d.id; rerender(); },
  startCareer() {
    const name = ($('#mname').value || '').trim().slice(0, 16) || 'The Gaffer';
    startCareer(name, UI.newClub); save();
    UI.screen = 'game'; UI.tab = 'home'; render(); setTimeout(startTour, 350);
  },
  scen(d) { answerScenario(+d.i); },
  scenDone() { closeModal(); go(); },
  preTactics() { UI.fromPre = W.season * 100 + W.week; UI.screen = 'game'; UI.tab = 'tactics'; UI.sel = null; render(); },
  tacBack() { fixTeam(me()); UI.screen = 'prematch'; render(); },
  viewOpp(d) { oppModal(d.id === '' ? null : +d.id); },
  oppSel(d, el) { oppModal(+el.value); },
  sqView(d) { UI.sqv = d.v; render(); },
  sqSort(d) { const k = d.k; UI.sqs = !k ? null : UI.sqs && UI.sqs.k === k ? (UI.sqs.d > 0 ? {k, d: -1} : null) : {k, d: 1}; render(); },
  tab(d) { UI.ret = null; closeModal(); if (UI.screen !== 'game') UI.screen = 'game'; UI.tab = d.t; UI.sel = null; render(); },
  go() { go(); },
  backToGame() { UI.screen = 'game'; render(); },
  player(d) { UI.ret = UI.modal && UI.curKind !== 'player' ? UI.curModal : UI.modal ? UI.ret : null; playerModal(+d.id); },
  close() { const r = UI.ret; UI.ret = null; closeModal(); if (r) r(); },
  toggleList(d) { const p = P(+d.id); p.listed = !p.listed; save(); toast(p.listed ? 'Transfer listed. Bids should follow.' : 'Taken off the list.'); playerModal(p.id); },
  renew(d) {
    const p = P(+d.id), wage = Math.round(wageDemand(Object.assign({}, p), me().div) * (p.mor < 40 ? 1.3 : 1) / 10) * 10;
    if (p.mor < 25) { toast(`${esc(pname(p))} refuses to talk. He wants out!`); return; }
    if (confirm(`${pname(p)} wants ${money(wage)}/week on a 3-year deal. Agree?`)) { p.wage = wage; p.con = 3; p.mor = clamp(p.mor + 10, 5, 100); save(); toast('Signed a new deal!'); playerModal(p.id); }
  },
  release(d) {
    const p = P(+d.id), c = me(), cost = releaseCost(p);
    if (c.squad.length <= 14) return toast('You need at least 14 players.');
    if (!confirm(`Release ${pname(p)}? Paying up his contract costs ${money(cost)}.`)) return;
    c.cash -= cost; c.squad = c.squad.filter(x => x !== p.id); p.club = -1; p.listed = false; c.xi = c.xi.map(x => x === p.id ? null : x); c.bench = c.bench.filter(x => x !== p.id); fixTeam(c);
    closeModal(); save(); rerender();
  },
  offer(d) { offerModal(+d.id); },
  negStep(d) { const n = UI.neg, step = n.ask > 1e6 ? 50000 : n.ask > 1e5 ? 5000 : 1000; n.offer = Math.max(step, n.offer + d.d * step); negHTML(); },
  negSet(d) { const n = UI.neg, step = n.ask > 1e6 ? 50000 : n.ask > 1e5 ? 5000 : 1000; n.offer = Math.max(step, Math.round(n.ask * d.f / step) * step); negHTML(); },
  negBid() { negBid(); },
  sign() { signDeal(); },
  slot(d) { slotModal(isNaN(d.k) ? d.k : +d.k); },
  choose(d) { choosePlayer(isNaN(d.k) ? d.k : +d.k, +d.id); },
  unbench(d) { const c = me(); c.bench.splice(+d.k.slice(1), 1); closeModal(); save(); rerender(); },
  autoPick() { autoPick(me()); save(); rerender(); toast('Assistant has picked the strongest team.'); },
  toggleAuto(d, el) { W.settings.autoPick = el.checked; if (el.checked) autoPick(me()); save(); rerender(); },
  form(d) { const c = me(); c.formation = d.f; if (W.settings.autoPick) autoPick(c); save(); rerender(); },
  style(d) { me().style = d.s; save(); rerender(); },
  lt(d) { UI.lt = d.k; rerender(); },
  st(d) { UI.st = d.k; rerender(); },
  cv(d) { UI.cv = d.k; rerender(); },
  statsGo() { UI.tab = 'league'; UI.lt = 'scorers'; UI.st = 'goals'; render(); },
  ld(d) { UI.ld = +d.d; rerender(); },
  mview(d) { UI.mkt.view = d.k; rerender(); },
  mpos(d) { UI.mkt.pos = d.p; rerender(); },
  mafford() { UI.mkt.afford = !UI.mkt.afford; rerender(); },
  myoung() { UI.mkt.young = !UI.mkt.young; rerender(); },
  train(d) { W.training.focus = d.k; save(); rerender(); },
  intensity(d) { W.training.int = +d.i; save(); rerender(); },
  drill(d) { drill(d.k); },
  ticket(d) { const c = me(), base = BASE_TICKET[c.div]; c.ticket = clamp(c.ticket + +d.d, Math.ceil(base * .5), base * 2); save(); rerender(); },
  set(d, el) { W.settings[d.k] = el.checked; save(); },
  speed(d) { W.settings.speed = +d.s; save(); rerender(); },
  resign() { if (!confirm('Resign and look for a new job?')) return; UI.season = null; const offers = jobOffers(true); modal(`<h3>Job centre</h3><p>Who's hiring?</p>${(offers.length ? offers : [pick(W.clubs.filter(x => x.div === 3 && x.id !== W.clubId)).id]).map(id => `<button class="clubpick wide" data-a="takeJob" data-id="${id}">${badgeImg(C(id), 22)}<span>${esc(C(id).name)} <small>(${DIVS[C(id).div]})</small></span></button>`).join('')}<button class="btn ghost small" data-a="close">Changed my mind</button>`); },
  openMsg(d) { const m = W.inbox.find(x => x.id === d.id); if (m) m.read = true; UI.open = UI.open === d.id ? null : d.id; save(); rerender(); },
  bidYes(d) { answerBid(d.id, true); },
  bidNo(d) { answerBid(d.id, false); },
  press(d) {
    const pr = UI.press, a = pr.a[+d.i];
    me().squad.forEach(id => P(id).mor = clamp(P(id).mor + a[1], 5, 100)); W.board.conf = clamp(W.board.conf + a[2], 0, 100);
    pr.done = `You said: "${a[0]}" ${a[1] > 2 ? 'The dressing room loved it.' : a[1] < 0 ? 'The players cringed.' : ''}${a[2] < 0 ? ' The chairman winced.' : a[2] > 0 ? ' The chairman smiled.' : ''}`;
    rerender();
  },
  kickoff() { if (tacWarn('live')) return; SND.init(); startMatch(true); },
  quick() { if (tacWarn('quick')) return; startMatch(false); },
  tacFix(d) { me().style = d.s; UI.tacOk = W.season * 100 + W.week; closeModal(); save(); toast(`Switched to ${STYLES[d.s].n}.`); rerender(); },
  tacAnyway(d) { UI.tacOk = W.season * 100 + W.week; closeModal(); if (d.m === 'live') { SND.init(); startMatch(true); } else startMatch(false); },
  buildStand(d) { const c = me(), g = ground(), s = GROUND.stands[d.k], cost = standCost(d.k, c);
    if (g.build || c.cash < cost || c.cap + s.add > groundLimit(c)) return;
    if (!confirm(`Build the ${s.n.toLowerCase()} for ${money(cost)}? It takes ${s.wk} weeks and ${Math.round(s.add / 4).toLocaleString()} seats close while it's built.`)) return;
    c.cash -= cost; g.build = {n: s.n, add: s.add, wk: s.wk, closed: Math.round(s.add / 4)}; save(); toast('The builders are in!'); rerender(); },
  upgrade(d) { const c = me(), g = ground(), cost = upgradeCost(d.k, c); if (g[d.k] >= 3 || c.cash < cost) return; c.cash -= cost; g[d.k]++; save(); toast(d.k === 'boxes' ? 'Executive boxes ready.' : 'Club shop open for business.'); rerender(); },
  mTactics() { closeModal(); UI.msel = null; matchTactics(); },
  mResume() { closeModal(); if (LM) { LM.paused = false; LM.busy = LM.m.done; LM.next = performance.now() + 400; } },
  mSpeed() { W.settings.speed = W.settings.speed % 3 + 1; const b = $('#spd'); if (b) b.textContent = ['', 'Slow', 'Normal', 'Fast'][W.settings.speed]; if (LM) LM.next = Math.min(LM.next, performance.now() + SPEED_MS[W.settings.speed]); },
  mSkip() { if (!LM) return; LM.skip = true; LM.paused = false; closeModal(); if (!LM.busy) LM.next = 0; else if (!LM.m.pending && !LM.m.done) LM.busy = false; },
  mStyle(d) { const s = LM.m.sides[LM.m.userSide]; s.style = d.s; matchTactics(); },
  mForm(d) { const s = LM.m.sides[LM.m.userSide]; s.form = d.f; LM.pitch.setForms([LM.m.sides[0].form, LM.m.sides[1].form], [LM.m.sides[0].on, LM.m.sides[1].on]); matchTactics(); },
  mSel(d) { UI.msel = +d.id; matchTactics(); },
  mSubIn(d) {
    const m = LM.m, s = m.sides[m.userSide];
    if (UI.msel == null) return toast('First tap the player to take off.');
    if (s.subsLeft <= 0) return toast('No subs left.');
    if (s.injured && s.injured[UI.msel] === undefined && false) return;
    const e = []; m.sub(m.userSide, UI.msel, +d.id, e); e.forEach(addLine);
    LM.pitch.setForms([m.sides[0].form, m.sides[1].form], [m.sides[0].on, m.sides[1].on]);
    UI.msel = null; matchTactics();
  },
  talk(d) { teamTalk(d.k); },
  ftContinue() {
    const m = UI.match;
    if (!m) { UI.screen = 'game'; UI.tab = 'home'; return render(); }
    let rep;
    try { rep = finishWeek(m); }
    catch (err) { console.error(err); cleanSquads(); fixTeam(me()); try { rep = finishWeek(m); } catch (err2) { return showError(err2.message, err2); } }
    try { afterWeek(rep); } catch (err) { console.error(err); UI.rep = rep; UI.screen = 'week'; save(); render(); }
  },
  weekDone() {
    const rep = UI.rep;
    if (rep.seasonOver) {
      const S = endSeason(); UI.season = S; UI.renew = null;
      const great = S.user.pos <= 2 || S.user.cupRound === 6;
      UI.offers = S.user.sacked ? jobOffers(true) : great && R() < .7 ? jobOffers(false).slice(0, 2) : [];
      if (S.user.sacked && !UI.offers.length) UI.offers = [pick(W.clubs.filter(x => x.div === 3 && x.id !== W.clubId)).id];
      W.pendingSeason = S; W.pendingOffers = UI.offers; save(); achAfterSeason(S);
      if (window.FamilyScores) FamilyScores.submit('pixelgaffer', 'career', W.career.pts, {fallbackName: W.name, detail: `${me().name}, ${W.career.seasons} season${W.career.seasons > 1 ? 's' : ''}`});
      UI.screen = 'season'; render(); return;
    }
    UI.screen = 'game'; UI.tab = 'home'; render();
  },
  renewTick(d, el) { UI.renew[+d.id] = el.checked; },
  takeJob(d) {
    const id = +d.id;
    if (UI.screen === 'season') { applyRenewals(); takeJob(id); finishSummer(); toast(`Welcome to ${esc(me().name)}!`); return; }
    takeJob(id); closeModal(); inbox('The Chairman', `Welcome to ${me().name}`, `Glad to have you, ${W.name}. Our target this season: ${W.board.txt.toUpperCase()}.`); save(); UI.tab = 'home'; render();
  },
  nextSeason() { applyRenewals(); finishSummer(); },
  arc(d) { arcade(d.k); },
};
function applyRenewals() {
  const S = UI.season; if (!S || S.user.sacked) return;
  const c = me();
  (S.user.expired || []).forEach(id => {
    const p = P(id); if (!p || p.club !== c.id) return;
    if (UI.renew && UI.renew[id]) { p.wage = wageDemand(Object.assign({}, p, {club: c.id}), c.div); p.con = 3; }
    else { c.squad = c.squad.filter(x => x !== id); p.club = -1; p.con = 1; }
  });
}
function finishSummer() {
  delete W.pendingSeason; delete W.pendingOffers;
  newSeason();
  inbox('The Chairman', `Season ${seasonLabel(W.season)}`, `A new season, ${W.name}. The board's target: ${W.board.txt.toUpperCase()}. You have ${money(me().cash)} to spend.`);
  UI.season = null; UI.offers = null; UI.renew = null; UI.lt = 'table'; UI.ld = null;
  save(); UI.screen = 'game'; UI.tab = 'home'; render();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const a = el.dataset.a; if (!a || !ACT[a]) return;
  SND.click();
  ACT[a](el.dataset, el);
});
document.addEventListener('change', e => {
  const el = e.target; if ((el.tagName !== 'INPUT' && el.tagName !== 'SELECT') || !el.dataset.a || !ACT[el.dataset.a]) return;
  ACT[el.dataset.a](el.dataset, el);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
// if something unexpected goes wrong, say so (with a screenshot-able message) instead of failing silently
let lastErr = 0;
function showError(msg, err) {
  if (Date.now() - lastErr < 4000) return; lastErr = Date.now();
  try { save(); } catch (e) {}
  // where it happened, e.g. "engine.js:212 · ui.js:1013", so a screenshot pins it down
  const where = String(err && err.stack || '').split('\n').map(l => (/([a-z]+\.js):(\d+)/.exec(l) || [])).filter(m => m[1]).slice(0, 3).map(m => m[1] + ':' + m[2]).join(' · ');
  toast(`⚠️ Something went wrong, gaffer. Your game is saved.<br><small>${esc(String(msg).slice(0, 120))}${where ? '<br>' + esc(where) : ''} · v${esc(window.APP_VERSION || 'family')}</small>`);
}
addEventListener('error', e => showError(e.message || e.error, e.error));
addEventListener('unhandledrejection', e => showError(e.reason && e.reason.message || e.reason, e.reason));

render();
if (document.fonts) document.fonts.ready.then(() => { if (UI.screen === 'title') {} });
