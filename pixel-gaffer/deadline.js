// Pixel Gaffer '96: transfer deadline day. Five quick-fire deals against the clock,
// with the rest of the league scrambling in the background.
'use strict';
const DEADLINE_WEEKS = [2, 23];
const DD_SECONDS = 12;
let DD = null, ddTimer = null;

function deadlineDue() {
  if (!W || !DEADLINE_WEEKS.includes(W.week)) return false;
  return W.ddDone !== W.season * 100 + W.week;
}
const ddPlayers = fn => Object.values(W.players).filter(p => p.club >= 0 && p.club !== W.clubId && !C(p.club).foreign && p.loanFrom == null && fn(p));

// build the day's deals from what's possible for this club
function ddDeals() {
  const c = me(), squad = c.squad.map(P).filter(p => p && p.loanFrom == null), deals = [];
  const lvl = squadStrength(c);
  const buyers = W.clubs.filter(x => x.id !== c.id && !x.foreign && x.div <= c.div + 1);
  // a panic bid for one of yours
  if (squad.length > 15) {
    const p = wpick(squad, q => Math.pow(ovrOf(q), 2) * (q.listed ? 3 : 1));
    const b = pick(buyers.filter(x => x.div <= c.div) .concat(buyers)) ;
    if (p && b) deals.push({type: 'bid', pid: p.id, club: b.id, amt: Math.round(valueOf(p) * (1.1 + R() * .5) / 1000) * 1000});
  }
  // a club desperate to sell
  const bargain = pick(ddPlayers(p => ovrOf(p) > lvl - .5 && ovrOf(p) < lvl + 3 && C(p.club).div >= c.div - 1 && p.age <= 31).slice(0, 80));
  if (bargain) deals.push({type: 'bargain', pid: bargain.id, club: bargain.club, amt: Math.max(1000, Math.round(valueOf(bargain) * (.45 + R() * .25) / 1000) * 1000)});
  // a free loan from a club above
  const loan = pick(ddPlayers(p => p.age <= 22 && C(p.club).div <= c.div && C(p.club).div >= c.div - 1 && ovrOf(p) > lvl - 1).slice(0, 60));
  if (loan) deals.push({type: 'loan', pid: loan.id, club: loan.club});
  // an unhappy player
  const moaner = squad.filter(p => p.mor < 55 || !p.s.ap).sort((a, b) => a.mor - b.mor)[0];
  if (moaner && squad.length > 15) deals.push({type: 'unhappy', pid: moaner.id, club: pick(buyers).id, amt: Math.round(valueOf(moaner) * .85 / 1000) * 1000});
  // a free agent turning up late
  const fa = Object.values(W.players).filter(p => p.club < 0).sort((a, b) => ovrOf(b) - ovrOf(a))[ri(0, 3)];
  if (fa) deals.push({type: 'free', pid: fa.id});
  // top up with another bid if we're short
  while (deals.length < 5 && squad.length > 16) {
    const p = pick(squad), b = pick(buyers);
    if (!deals.some(d => d.pid === p.id)) deals.push({type: 'bid', pid: p.id, club: b.id, amt: Math.round(valueOf(p) * (.95 + R() * .45) / 1000) * 1000});
    else break;
  }
  return shuffle(deals).slice(0, 5);
}
// the rest of the league panic-buys
function ddAiMoves(n) {
  const heads = [];
  for (let i = 0; i < n * 3 && heads.length < n; i++) {
    const buyer = pick(W.clubs.filter(x => x.id !== W.clubId && !x.foreign && x.squad.length < 23));
    const target = pick(ddPlayers(p => p.club !== buyer.id && C(p.club).squad.length > 16 && C(p.club).div >= buyer.div && ovrOf(p) > squadStrength(buyer) - .5).slice(0, 60));
    if (!buyer || !target) continue;
    const fee = Math.round(askingPrice(target) * (.9 + R() * .5) / 1000) * 1000;
    if (buyer.cash < fee) continue;
    const from = C(target.club);
    moveP(target, buyer, fee);
    const h = `${pname(target).toUpperCase()} TO ${buyer.name.toUpperCase()} FROM ${from.short}, ${money(fee)}`;
    heads.push(h); news(h);
  }
  return heads;
}

function startDeadline() {
  W.ddDone = W.season * 100 + W.week;
  const label = W.week < 10 ? 'Summer' : 'January';
  DD = {label, deals: ddDeals(), i: 0, done: [], log: [], ticker: ddAiMoves(4).concat(pick([['AGENTS SPOTTED IN TRAINING GROUND CAR PARKS'], ['FAX MACHINES WORKING OVERTIME'], ['CHAIRMAN SEEN BUYING A NEW CHEQUE BOOK']]))};
  if (!DD.deals.length) { DD.deals = []; }
  save();
  UI.screen = 'deadline'; render();
  SND.whistle(2);
  ddStartClock();
}
function ddStartClock() {
  clearInterval(ddTimer);
  if (!DD || DD.i >= DD.deals.length) return;
  DD.left = DD_SECONDS * 10;
  ddTimer = setInterval(() => {
    if (!DD || UI.screen !== 'deadline') return clearInterval(ddTimer);
    if (UI.modal) return;
    DD.left--;
    const bar = document.querySelector('.ddbar i'); if (bar) bar.style.width = (DD.left / (DD_SECONDS * 10) * 100) + '%';
    const clk = document.getElementById('ddclock'); if (clk) clk.textContent = ddClock();
    if (DD.left % 10 === 0 && DD.left <= 50 && DD.left > 0) SND.tone(DD.left <= 30 ? 1200 : 900, .05, 'square', .04);
    if (DD.left <= 0) ddResolve('timeout');
  }, 100);
}
function ddClock() {
  const n = DD.deals.length || 1, per = 55 / n, used = DD.i * per + (DD.i < n ? per * (1 - (DD.left ?? DD_SECONDS * 10) / (DD_SECONDS * 10)) : per);
  const m = Math.min(59, Math.floor(4 + used));
  return `23:${String(m).padStart(2, '0')}`;
}

function ddCardHTML(d) {
  const p = P(d.pid), c = me(); if (!p) return '';
  const cl = d.club != null ? C(d.club) : null;
  const info = `<div class="ddp">${portrait(p, 48)}<div><b>${esc(p.fn)} ${esc(p.ln)}</b><div>${posTag(p.pos)} age ${p.age} · ${ovrHTML(p)} · ${money(valueOf(p))}</div><small>${p.club === c.id ? `Your player · ${p.s.ap} apps · ${moraleWord(p.mor).toLowerCase()} morale` : p.club < 0 ? 'Free agent' : `${esc(C(p.club).name)}${p.club >= 0 ? ' · ' + divName(C(p.club)) : ''}`}</small></div></div>`;
  let head, body, acts;
  switch (d.type) {
    case 'bid': head = `📠 FAX FROM ${esc(cl.name.toUpperCase())}`; body = `"We'll give you <b class="c-g">${money(d.amt)}</b> for him. Right now. Final offer... probably."`;
      acts = `<button class="btn go" data-a="ddDo" data-r="accept">Sell (${money(d.amt)})</button><button class="btn" data-a="ddDo" data-r="counter">Ask for ${money(Math.round(d.amt * 1.2 / 1000) * 1000)}</button><button class="btn bad" data-a="ddDo" data-r="no">Not for sale</button>`; break;
    case 'bargain': head = `📞 ${esc(cl.name.toUpperCase())} NEED CASH`; body = `"Take him off our hands for <b class="c-y">${money(d.amt)}</b>. He wants about ${money(wageDemand(p, c.div))} a week."`;
      acts = `<button class="btn go" data-a="ddDo" data-r="buy">Buy him</button><button class="btn" data-a="ddDo" data-r="no">Pass</button>`; break;
    case 'loan': head = `📞 ${esc(cl.name.toUpperCase())} OFFER A LOAN`; body = '"He needs games. Have him till the summer, no fee. You just pay his wages."';
      acts = `<button class="btn go" data-a="ddDo" data-r="loan">Take him on loan</button><button class="btn" data-a="ddDo" data-r="no">No thanks</button>`; break;
    case 'unhappy': head = `🚪 KNOCK ON YOUR DOOR`; body = `"Gaffer, I want out. ${esc(cl.name)} want me and they'll pay ${money(d.amt)}."`;
      acts = `<button class="btn" data-a="ddDo" data-r="sell">Let him go</button><button class="btn go" data-a="ddDo" data-r="persuade">Talk him round</button>`; break;
    case 'free': head = `📞 AN AGENT CALLS`; body = `"My client's a free agent and he's sat in his car outside. One-year deal, ${money(wageDemand(p, c.div))} a week?"`;
      acts = `<button class="btn go" data-a="ddDo" data-r="sign">Sign him</button><button class="btn" data-a="ddDo" data-r="no">Send him home</button>`; break;
  }
  return `<div class="ddcard"><div class="ddhead">${head}<small>Deal ${DD.i + 1} of ${DD.deals.length}</small></div>${info}<p class="ddsay">${body}</p><div class="ddbar"><i style="width:100%"></i></div><div class="ddacts">${acts}</div></div>`;
}
function deadlineHTML() {
  const c = me(), over = DD.i >= DD.deals.length;
  const tick = DD.ticker.concat(DD.log.filter(l => l.big).map(l => l.txt.toUpperCase()));
  return `<div class="dd">
    <div class="ddtop"><div><span class="ddtitle">DEADLINE DAY</span><small>${DD.label} window · ${esc(c.name)} · ${money(c.cash)} · squad ${c.squad.length}/26</small></div><span class="ddclock" id="ddclock">${over ? '00:00' : ddClock()}</span></div>
    <div class="ddticker"><span class="ddbrk">BREAKING</span><div class="ddmarq"><span>${tick.map(esc).join(' &nbsp;•&nbsp; ') || 'QUIET SO FAR...'}</span></div></div>
    ${over ? `<div class="panel center ddend"><h2>THE WINDOW HAS SLAMMED SHUT!</h2><p>${DD.done.length ? `You did <b class="c-y">${DD.done.length}</b> deal${DD.done.length > 1 ? 's' : ''}.` : 'You kept your powder dry.'}</p></div>` : ddCardHTML(DD.deals[DD.i])}
    <div class="panel"><h2>Tonight's business</h2>${DD.log.map(l => `<div class="${l.cls || ''}">• ${esc(l.txt)}</div>`).join('') || '<p class="note">Nothing yet. The phone is ringing...</p>'}</div>
    ${over ? '<div class="sticky"><button class="btn go big wide" data-a="ddEnd">Back to the football ▶</button></div>' : ''}
  </div>`;
}
function ddResolve(r) {
  clearInterval(ddTimer);
  const d = DD.deals[DD.i], p = P(d.pid), c = me(), cl = d.club != null ? C(d.club) : null;
  const log = (txt, cls, big) => DD.log.push({txt, cls, big});
  if (!p) { DD.i++; return ddNext(); }
  const sell = amt => { moveP(p, cl, amt); fixTeam(c); DD.done.push(d); log(`Sold ${pname(p)} to ${cl.name} for ${money(amt)}`, 'c-g', true); news(`${pname(p).toUpperCase()} JOINS ${cl.name.toUpperCase()} FROM ${c.short} FOR ${money(amt)}`); SND.good(); };
  const tooBig = () => { log(`No room: your squad is full (26).`, 'c-r'); };
  switch (d.type) {
    case 'bid':
      if (r === 'accept') sell(d.amt);
      else if (r === 'counter') { if (R() < .5) sell(Math.round(d.amt * 1.2 / 1000) * 1000); else { log(`${cl.name} walked away from the ${pname(p)} deal.`, 'c-o'); SND.bad(); } }
      else if (r === 'timeout') log(`The ${cl.name} bid for ${pname(p)} ran out of time.`, 'c-d');
      else { log(`You told ${cl.name} that ${pname(p)} isn't for sale.`); p.mor = clamp(p.mor + 5, 5, 100); }
      break;
    case 'bargain':
      if (r === 'buy') {
        if (c.squad.length >= 26) tooBig();
        else if (c.cash < d.amt) log(`You couldn't afford ${pname(p)}.`, 'c-r');
        else if (!willingToJoin(p)) log(`${pname(p)} didn't fancy dropping down to ${DIVS[c.div]}.`, 'c-o');
        else { const from = C(p.club); moveP(p, c, d.amt); p.wage = wageDemand(p, c.div); p.con = 2; DD.done.push(d); log(`Signed ${pname(p)} from ${from.name} for ${money(d.amt)}!`, 'c-g', true); news(`${pname(p).toUpperCase()} SIGNS FOR ${c.name.toUpperCase()} FOR ${money(d.amt)}`); SND.good(); if (d.amt >= 1e6) ach('bigspend'); }
      } else log(r === 'timeout' ? `Too slow! ${pname(p)} went elsewhere.` : `You passed on ${pname(p)}.`, 'c-d');
      break;
    case 'loan':
      if (r === 'loan') {
        if (c.squad.length >= 26) tooBig(); else if (loansIn() >= 3) log('You already have three players on loan.', 'c-r');
        else { const from = C(p.club); from.squad = from.squad.filter(x => x !== p.id); if (from.xi) from.xi = from.xi.map(x => x === p.id ? null : x); if (from.bench) from.bench = from.bench.filter(x => x !== p.id); c.squad.push(p.id); p.club = c.id; p.loanFrom = from.id; DD.done.push(d); log(`${pname(p)} joins on loan from ${from.name}.`, 'c-g', true); SND.good(); }
      } else log(r === 'timeout' ? `The loan for ${pname(p)} fell through.` : `You turned down ${pname(p)} on loan.`, 'c-d');
      break;
    case 'unhappy':
      if (r === 'sell') { if (c.squad.length <= 14) log('You need at least 14 players.', 'c-r'); else sell(d.amt); }
      else if (r === 'persuade') { if (R() < .55) { p.mor = clamp(p.mor + 30, 5, 100); log(`You talked ${pname(p)} round. He's staying, and happier.`, 'c-g'); } else { p.mor = clamp(p.mor - 10, 5, 100); log(`${pname(p)} stormed out. He's still unhappy.`, 'c-r'); } }
      else { p.mor = clamp(p.mor - 8, 5, 100); log(`You left ${pname(p)} waiting. He's sulking.`, 'c-d'); }
      break;
    case 'free':
      if (r === 'sign') { if (c.squad.length >= 26) tooBig(); else { moveP(p, c, 0); p.wage = wageDemand(p, c.div); p.con = 1; DD.done.push(d); log(`Signed free agent ${pname(p)} on a one-year deal.`, 'c-g', true); news(`${pname(p).toUpperCase()} SIGNS FOR ${c.name.toUpperCase()} ON A FREE`); SND.good(); } }
      else log(r === 'timeout' ? `The agent gave up and drove off.` : `You sent ${pname(p)} home.`, 'c-d');
      break;
  }
  DD.i++;
  ddNext();
}
function ddNext() {
  // more breaking news as the night goes on
  if (R() < .6) DD.ticker = DD.ticker.concat(ddAiMoves(1));
  if (DD.i >= DD.deals.length) { if (DD.done.length >= 3) ach('deadline'); SND.whistle(3); }
  save(); render();
  ddStartClock();
}
