// Pixel Gaffer '96: the extra knockout competitions and the European clubs.
// Division Two and Three play the Pixel Vase, Division One the Floodlit Cup,
// and the Premier Division goes into Europe: the top four into the Euro Champions Cup,
// everyone else (including the promoted sides) into the Euro Fairs Trophy.
'use strict';
// [name, short, shirt, shorts, pattern, country, level]
const FOREIGN = [
  ['Real Montoria', 'RMO', '#ffffff', '#6a2bbf', 0, 'Spain', 16.2], ['AC Venturo', 'VEN', '#d8242c', '#1a1a1a', 2, 'Italy', 16], ['FC Lindenau', 'LIN', '#d8242c', '#ffffff', 0, 'Germany', 15.8], ['Olympique Marveil', 'OLM', '#5fb8ff', '#ffffff', 1, 'France', 15.6],
  ['Sporting Valdora', 'SVA', '#2a9d3f', '#ffffff', 3, 'Portugal', 14.6], ['SV Delftwijk', 'DEL', '#ff8a1f', '#ffffff', 0, 'Netherlands', 14.5], ['Red Star Velgrad', 'RSV', '#d8242c', '#ffffff', 2, 'Yugoslavia', 14.3], ['Galatar SK', 'GAL', '#ffd23f', '#d8242c', 1, 'Turkey', 14.2],
  ['Dynamo Kravets', 'DYK', '#1d3fbf', '#ffffff', 3, 'Ukraine', 14], ['Panathos', 'PAN', '#2a9d3f', '#ffffff', 4, 'Greece', 13.8], ['Brøndal IF', 'BRO', '#ffd23f', '#1d3fbf', 0, 'Denmark', 13.6], ['Malmvik FF', 'MAL', '#5fb8ff', '#ffffff', 2, 'Sweden', 13.5],
  ['Rapid Brenz', 'RAP', '#2a9d3f', '#ffffff', 3, 'Austria', 13.3], ['Standard Liègeau', 'STL', '#d8242c', '#ffffff', 1, 'Belgium', 13.2], ['Spartak Volgin', 'SPV', '#d8242c', '#ffffff', 4, 'Russia', 13.4], ['FC Zürlen', 'ZUR', '#1d3fbf', '#ffffff', 0, 'Switzerland', 13],
];
const KO_DEFS = {
  vase: {name: 'Pixel Vase', short: 'VASE', prize: [4000, 8000, 15000, 30000, 60000], pts: 40},
  flood: {name: 'Floodlit Cup', short: 'FLC', prize: [20000, 40000, 80000, 160000], pts: 50},
  ecc: {name: 'Euro Champions Cup', short: 'ECC', euro: true, prize: [400000, 800000, 1600000], pts: 150},
  fairs: {name: 'Euro Fairs Trophy', short: 'EFT', euro: true, prize: [150000, 300000, 600000, 1200000], pts: 100},
};
const KO_WEEKS_COUNT = 5;

function addForeignClubs() {
  if (W.clubs.some(c => c.foreign)) return;
  NEXT_ID = W.nextId || NEXT_ID;
  FOREIGN.forEach((f, i) => {
    const club = {id: W.clubs.length, name: f[0], short: f[1], c1: f[2], c2: f[3], pat: f[4], country: f[5], level: f[6], foreign: true, div: 4,
      rep: 90 - i, cap: 30000 + (15 - i) * 2500, cash: 5e6, ticket: 20, style: pick(Object.keys(STYLES).filter(s => s !== 'bus')),
      formation: pick(['4-4-2', '4-3-3', '3-5-2', '4-5-1']), squad: [], xi: null, bench: null};
    ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW'].forEach((pos, k) => {
      const p = makePlayer(pos, f[6] + (k % 6 < 2 ? 1 : k % 6 < 4 ? 0 : -1.4) + (R() - .5), null, {div: 0});
      p.club = club.id; p.val = valueOf(p); W.players[p.id] = p; club.squad.push(p.id);
    });
    W.clubs.push(club); autoPick(club);
  });
  W.nextId = NEXT_ID;
}
// keep the European squads topped up as players retire
function topUpForeign(cl) {
  POS.forEach(pos => {
    const need = {GK: 2, DF: 6, MF: 6, FW: 4}[pos];
    while (cl.squad.map(P).filter(p => p && p.pos === pos).length < need) { const p = makePlayer(pos, cl.level - .5 + (R() - .5) * 2, ri(18, 23), {div: 0}); p.club = cl.id; W.players[p.id] = p; cl.squad.push(p.id); }
  });
  cl.squad.map(P).forEach(p => { if (p.con <= 0) p.con = ri(1, 3); p.wage = wageFor(p, 0); });
  autoPick(cl);
}
const divName = c => c.foreign ? c.country : DIVS[c.div];

function roundNames(first, byes) {
  const names = [], counts = [];
  let n = first;
  while (n >= 2) { counts.push(n); n = n / 2 + (counts.length === 1 ? byes : 0); }
  counts.forEach((c, i) => names.push(i === 0 && byes ? 'First Round' : c === 2 ? 'Final' : c === 4 ? 'Semi-final' : c === 8 ? 'Quarter-final' : byes && i === 1 ? 'Second Round' : 'Round of ' + c));
  return names;
}
function makeComp(key, entrants, byes) {
  const d = KO_DEFS[key], byeIds = entrants.slice(0, byes), alive = entrants.slice(byes);
  const rounds = roundNames(alive.length, byes);
  return {key, name: d.name, short: d.short, euro: !!d.euro, entrants: entrants.slice(), byes: byeIds, alive, ties: drawTies(alive), r: 0, rounds, start: KO_WEEKS_COUNT - rounds.length, log: [], winner: null};
}
function setupComps() {
  addForeignClubs();
  const rank = (a, b) => b.rep - a.rep;
  const lower = W.clubs.filter(c => !c.foreign && c.div >= 2).sort((a, b) => a.div - b.div || rank(a, b)).map(c => c.id);
  const d1 = W.clubs.filter(c => !c.foreign && c.div === 1).sort(rank).map(c => c.id);
  // the Premier sides, in the order they finished last season (promoted clubs last)
  const prev = W.prevPrem || [];
  const prem = W.clubs.filter(c => !c.foreign && c.div === 0).sort((a, b) => {
    const ia = prev.indexOf(a.id), ib = prev.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || rank(a, b);
  }).map(c => c.id);
  const foreign = W.clubs.filter(c => c.foreign).sort((a, b) => b.level - a.level).map(c => c.id);
  W.ko = {
    vase: makeComp('vase', lower, 8),
    flood: makeComp('flood', d1, 4),
    ecc: makeComp('ecc', shuffle(prem.slice(0, 4).concat(foreign.slice(0, 4))), 0),
    fairs: makeComp('fairs', shuffle(prem.slice(4).concat(foreign.slice(4, 12))), 0),
  };
}
const userComp = () => Object.values(W.ko || {}).find(cp => cp.entrants.includes(W.clubId)) || null;
function koFixtures(kr) {
  const out = [];
  Object.values(W.ko || {}).forEach(cp => {
    if (cp.winner != null || kr < cp.start || kr - cp.start !== cp.r) return;
    const fin = cp.r === cp.rounds.length - 1;
    cp.ties.forEach(([h, a]) => out.push({h, a, d: -1, cup: true, comp: cp.key, round: cp.r, label: `${cp.name} · ${cp.rounds[cp.r]}`, neutral: fin, final: fin, euro: cp.euro}));
  });
  return out;
}
function progressComps(results) {
  Object.values(W.ko || {}).forEach(cp => {
    const rs = results.filter(r => r.comp === cp.key); if (!rs.length) return;
    cp.log.push(rs.map(r => ({h: r.h, a: r.a, hg: r.hg, ag: r.ag, pens: r.pens, win: r.win})));
    const winners = rs.map(r => r.win);
    if (cp.r === cp.rounds.length - 1) { cp.winner = winners[0]; cp.r++; cp.ties = []; return; }
    cp.r++;
    cp.alive = (cp.r === 1 ? cp.byes : []).concat(winners);
    cp.ties = drawTies(cp.alive);
  });
}
const koPrize = (key, r) => (KO_DEFS[key].prize[r] || 0);
