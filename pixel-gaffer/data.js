// Pixel Gaffer '96: names, clubs, formations, styles and world generation.
'use strict';
const R = () => Math.random();
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wpick = (items, w) => { let t = 0; const ws = items.map(x => { const v = Math.max(0, w(x)); t += v; return v; }); let r = R() * t; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };

const FIRST = ['Gary', 'Steve', 'Lee', 'Darren', 'Paul', 'Mark', 'Ian', 'Craig', 'Dean', 'Wayne', 'Kevin', 'Neil', 'Stuart', 'Alan', 'Tony', 'Chris', 'Jamie', 'Ryan', 'Danny', 'Robbie',
  'Gareth', 'Rhys', 'Owain', 'Ewan', 'Fraser', 'Gavin', 'Callum', 'Liam', 'Declan', 'Niall', 'Shaun', 'Carl', 'Matt', 'Jason', 'Scott', 'Andy', 'Phil', 'Graham', 'Trevor', 'Barry',
  'Nigel', 'Keith', 'Colin', 'Terry', 'Russell', 'Lloyd', 'Marcus', 'Jermaine', 'Leon', 'Tom', 'Dale', 'Rob', 'Mick', 'Joe', 'Sam', 'Ollie', 'Archie', 'Billy', 'Kenny', 'Mo',
  'Jens', 'Marco', 'Pierre', 'Lars', 'Tomas', 'Sven', 'Luca', 'Bjorn', 'Rui', 'Dimi', 'Kwame', 'Femi', 'Yannick', 'Aldo'];
const LAST = ['Smith', 'Jones', 'Taylor', 'Brown', 'Walker', 'Wright', 'Hughes', 'Edwards', 'Clarke', 'Hall', 'Wood', 'Harris', 'Lewis', 'Robinson', 'Thompson', 'Bell', 'Parker', 'Morris',
  'Cooper', 'Ward', 'Kelly', 'Cox', 'Murray', 'McKay', 'McLeod', 'Pritchard', 'Price', 'Morgan', 'Davies', 'Evans', 'Ellis', 'Booth', 'Holt', 'Barlow', 'Kershaw', 'Pickles', 'Tunstall',
  'Dobbs', 'Higgins', 'Gallagher', 'Doyle', 'Quinn', 'Byrne', 'Fletcher', 'Spencer', 'Hartley', 'Lockwood', 'Ramsbottom', 'Sidebottom', 'Butterworth', 'Crabtree', 'Duckworth',
  'Entwistle', 'Fairclough', 'Greenhalgh', 'Haworth', 'Ingham', 'Jolly', 'Kilner', 'Lumb', 'Mottram', 'Nuttall', 'Openshaw', 'Platt', 'Royle', 'Shufflebottom', 'Tetley', 'Upton',
  'Varley', 'Whittaker', 'Yates', 'Ziegler', 'Okafor', 'Mensah', 'Van Dijkstra', 'Larsen', 'Moreau', 'Rossi', 'Novak', 'Silva', 'Andersson', 'Kovac', 'Dubois', 'Mbeki'];

// [name, short, shirt, shorts, pattern]
const CLUBS = [
  ['Highbridge City', 'HBC', '#5fb8ff', '#ffffff', 0], ['Ashworth Albion', 'ASH', '#ffffff', '#1a1a1a', 1], ['Kettlemoor United', 'KET', '#d8242c', '#ffffff', 0], ['Port Haverly', 'POR', '#1d3fbf', '#ffffff', 2],
  ['Redcastle Rovers', 'RED', '#b3122a', '#1a1a1a', 3], ['Saltmarsh Athletic', 'SAL', '#ffd23f', '#1d3fbf', 0], ['Westbury Wanderers', 'WES', '#ff8a1f', '#1a1a1a', 4], ['Grimsdale Town', 'GRI', '#2f2f2f', '#ffd23f', 1],
  ['Fenwick Rangers', 'FEN', '#2a9d3f', '#ffffff', 2], ['Ironbridge Forest', 'IRO', '#7a1022', '#5fb8ff', 3], ['Dunmore Thistle', 'DUN', '#6a2bbf', '#ffffff', 0], ['Llanfair Dragons', 'LLA', '#d8242c', '#2a9d3f', 4],
  ['Thornfield United', 'THO', '#ffffff', '#d8242c', 3], ['Mossley Vale', 'MOS', '#2a9d3f', '#ffd23f', 1], ['Bramley Rovers', 'BRA', '#1d3fbf', '#ffd23f', 2], ['Coldharbour Athletic', 'COL', '#5fb8ff', '#1d3fbf', 1],
  ['Stanmore Borough', 'STA', '#ffd23f', '#1a1a1a', 2], ['Glenrothie Harriers', 'GLE', '#1a1a1a', '#ffffff', 4], ['Pennington North End', 'PEN', '#ffffff', '#1d3fbf', 0], ['Blackwater Albion', 'BLA', '#1a1a1a', '#d8242c', 1],
  ['Kingsmead Town', 'KIN', '#ff8a1f', '#ffffff', 2], ['Ravensford City', 'RAV', '#7a1022', '#ffffff', 0], ['Oakhurst United', 'OAK', '#2a9d3f', '#1a1a1a', 3], ["St Brannock's", 'STB', '#6a2bbf', '#ffd23f', 4],
  ['Hollowcroft Rovers', 'HOL', '#d8242c', '#1d3fbf', 2], ['Marlow Heath', 'MAR', '#5fb8ff', '#ffffff', 3], ['Ebbsworth Town', 'EBB', '#ffd23f', '#2a9d3f', 1], ['Cwmbrook Athletic', 'CWM', '#ffffff', '#2a9d3f', 4],
  ['Netherby Swifts', 'NET', '#1d3fbf', '#d8242c', 1], ['Whitcombe Wednesday', 'WHI', '#ffffff', '#5fb8ff', 2], ['Lowestead Rangers', 'LOW', '#ff8a1f', '#1d3fbf', 0], ['Stoneyford', 'STO', '#8a8a8a', '#d8242c', 3],
  ['Barrowdale United', 'BAR', '#d8242c', '#ffffff', 1], ['Fairhaven Town', 'FAI', '#5fb8ff', '#ffd23f', 0], ['Wickham Vale', 'WIC', '#2a9d3f', '#ffffff', 4], ['Ashby Colliery', 'ACO', '#1a1a1a', '#ffd23f', 2],
  ['Tidesend Mariners', 'TID', '#1d3fbf', '#5fb8ff', 3], ['Gorsley Heath', 'GOR', '#7a1022', '#ffd23f', 1], ['Quarry Lane', 'QUA', '#8a8a8a', '#1a1a1a', 0], ['Dunford Rovers', 'DFR', '#ffd23f', '#d8242c', 2],
  ['Brackenhill Athletic', 'BRK', '#6a2bbf', '#ffffff', 1], ['Millbeck Town', 'MIL', '#ffffff', '#7a1022', 4], ['Fellmoor United', 'FEL', '#d8242c', '#ffd23f', 3], ['Sutterby Borough', 'SUT', '#2a9d3f', '#1d3fbf', 0],
  ['Inverdale', 'INV', '#1d3fbf', '#ffffff', 4], ['Pontybridge Town', 'PON', '#ff8a1f', '#2a9d3f', 2], ['Shingle Bay', 'SHI', '#5fb8ff', '#d8242c', 1], ['Muddlecombe Town', 'MUD', '#7a5a2a', '#ffffff', 3],
];
const DIVS = ['Premier Division', 'Division One', 'Division Two', 'Division Three'];
const CUP_NAME = 'Old Tin Cup';
const CUP_ROUNDS = ['First Round', 'Second Round', 'Third Round', 'Quarter-final', 'Semi-final', 'Final'];
const POS = ['GK', 'DF', 'MF', 'FW'];
const POS_NAME = {GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward'};
const TRAITS = {
  engine: {n: 'Engine', d: 'Never seems to tire.'},
  poacher: {n: 'Poacher', d: 'Lives in the six-yard box. Extra goals.'},
  wall: {n: 'Brick Wall', d: 'Organises the back line.'},
  maestro: {n: 'Maestro', d: 'Makes everyone around him play better.'},
  hothead: {n: 'Hothead', d: 'Collects cards like stamps.'},
  glass: {n: 'Glass Ankles', d: 'Picks up knocks easily.'},
  deadball: {n: 'Dead-ball King', d: 'Deadly from free kicks and penalties.'},
  leader: {n: 'Captain Fantastic', d: 'Lifts morale when it matters.'},
  wonder: {n: 'Wonderkid', d: 'Learns fast.'},
  cat: {n: 'Cat-like', d: 'Saves the unsaveable. Great at penalties.'},
};

// Formations: slot list GK, DF..., MF..., FW... with pitch spots (x = up the pitch from own goal, y = across).
const FORMS = {
  '4-4-2': [[.05, .5], [.22, .14], [.19, .38], [.19, .62], [.22, .86], [.45, .14], [.41, .38], [.41, .62], [.45, .86], [.68, .36], [.68, .64]],
  '4-3-3': [[.05, .5], [.22, .14], [.19, .38], [.19, .62], [.22, .86], [.42, .28], [.39, .5], [.42, .72], [.68, .18], [.72, .5], [.68, .82]],
  '3-5-2': [[.05, .5], [.2, .24], [.17, .5], [.2, .76], [.46, .1], [.4, .3], [.36, .5], [.4, .7], [.46, .9], [.68, .38], [.68, .62]],
  '5-3-2': [[.05, .5], [.26, .1], [.2, .3], [.17, .5], [.2, .7], [.26, .9], [.42, .28], [.4, .5], [.42, .72], [.66, .38], [.66, .62]],
  '4-5-1': [[.05, .5], [.22, .14], [.19, .38], [.19, .62], [.22, .86], [.46, .1], [.42, .3], [.37, .5], [.42, .7], [.46, .9], [.7, .5]],
  '4-2-4': [[.05, .5], [.22, .14], [.19, .38], [.19, .62], [.22, .86], [.4, .38], [.4, .62], [.64, .12], [.68, .38], [.68, .62], [.64, .88]],
};
function formSlots(f) { const [d, m, a] = f.split('-').map(Number); return ['GK'].concat(Array(d).fill('DF'), Array(m).fill('MF'), Array(a).fill('FW')); }

const STYLES = {
  pass: {n: 'Passing', d: 'Keep it on the deck. Strong in midfield.', mid: 1.1, att: 1, def: 1, fat: 1, tempo: 1},
  long: {n: 'Long Ball', d: 'Hoof it to the big man. Skips the midfield.', mid: .86, att: 1.1, def: 1, fat: .9, tempo: 1.1},
  counter: {n: 'Counter', d: 'Sit deep, break fast. Hurts teams that attack.', mid: .94, att: 1.05, def: 1.1, fat: 1, tempo: .9},
  press: {n: 'High Press', d: 'Win it high. Great in midfield but tiring.', mid: 1.12, att: 1.04, def: .96, fat: 1.45, tempo: 1.05},
  bus: {n: 'Park the Bus', d: 'Ten men behind the ball. Hard to beat, hard to watch.', mid: .9, att: .62, def: 1.3, fat: .85, tempo: .75},
  attack: {n: 'All-out Attack', d: 'Everyone forward! Goals at both ends.', mid: 1, att: 1.3, def: .8, fat: 1.15, tempo: 1.2},
};
const BEATS = {pass: ['long', 'bus'], long: ['press', 'pass'], counter: ['attack', 'press'], press: ['pass', 'counter'], bus: ['attack', 'long'], attack: ['bus', 'counter']};
// (attack beats counter only when it is ahead on quality, so the engine halves that one: see styleEdge)

const TRAINING = {
  balanced: {n: 'Balanced', d: 'A bit of everything.', a: ['pac', 'tkl', 'pas', 'sho', 'gk']},
  attack: {n: 'Shooting', d: 'Finishing drills.', a: ['sho', 'sho', 'pac']},
  defence: {n: 'Defending', d: 'Tackling and shape.', a: ['tkl', 'tkl', 'gk']},
  passing: {n: 'Passing', d: 'Rondos and one-twos.', a: ['pas', 'pas', 'tkl']},
  fitness: {n: 'Fitness', d: 'Laps of the pitch. Faster recovery.', a: ['pac']},
  rest: {n: 'Rest', d: 'Feet up. Full recovery, morale up, no progress.', a: []},
};
const INTENSITY = ['Light', 'Normal', 'Hard'];

const START_YEAR = 1996;
function dateOf(season, week) {
  const d = new Date(Date.UTC(START_YEAR + season, 7, 17 + week * 7));
  return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
}

// ---------- players
let NEXT_ID = 1;
function ovrOf(p, pos) {
  const a = p.a; pos = pos || p.pos;
  if (pos === 'GK') return a.gk;
  if (pos === 'DF') return a.tkl * .55 + a.pac * .25 + a.pas * .2;
  if (pos === 'MF') return a.pas * .45 + a.tkl * .2 + a.sho * .15 + a.pac * .2;
  return a.sho * .5 + a.pac * .3 + a.pas * .2;
}
const ovr = (p, pos) => Math.round(ovrOf(p, pos) * 5);
// Make a player around a target level (1-20 scale).
function makePlayer(pos, level, age, opts) {
  opts = opts || {};
  const v = () => clamp(level + (R() - .5) * 5, 1, 20);
  const a = {pac: v(), tkl: v(), pas: v(), sho: v(), gk: ri(1, 4)};
  if (pos === 'GK') { a.gk = clamp(level + (R() - .5) * 2, 1, 20); a.sho = clamp(a.sho - 6, 1, 20); a.tkl = clamp(a.tkl - 4, 1, 20); }
  if (pos === 'DF') { a.tkl = clamp(a.tkl + 2.5, 1, 20); a.sho = clamp(a.sho - 4, 1, 20); }
  if (pos === 'MF') { a.pas = clamp(a.pas + 2, 1, 20); }
  if (pos === 'FW') { a.sho = clamp(a.sho + 2.5, 1, 20); a.tkl = clamp(a.tkl - 4.5, 1, 20); }
  for (const k in a) a[k] = Math.round(a[k] * 10) / 10;
  age = age || ri(18, 33);
  const p = {id: NEXT_ID++, fn: pick(FIRST), ln: pick(LAST), pos, age, a, club: null,
    pot: 0, form: 0, fit: 100, mor: 70, inj: 0, sus: 0, yc: 0, tr: null, wage: 0, con: ri(1, 4), listed: false,
    s: {ap: 0, gl: 0, as: 0, rt: 0}, xp: 0};
  // potential: young players can grow
  const cur = ovrOf(p);
  p.pot = Math.round(clamp(cur + (age <= 19 ? ri(1, 7) : age <= 23 ? ri(0, 4) : age <= 27 ? ri(0, 1.5) : 0), cur, 20) * 10) / 10;
  if (opts.pot) p.pot = Math.max(p.pot, opts.pot);
  if (R() < .28) {
    const t = pos === 'GK' ? pick(['cat', 'leader', 'glass', 'engine']) : pick(Object.keys(TRAITS).filter(k => k !== 'cat' && (k !== 'wonder' || age <= 21) && (k !== 'wall' || pos === 'DF') && (k !== 'poacher' || pos === 'FW')));
    p.tr = t;
  }
  if (age <= 19 && R() < .15) p.tr = 'wonder';
  p.wage = wageFor(p, opts.div || 2);
  return p;
}
function wageFor(p, div) {
  const o = ovr(p);
  return Math.max(150, Math.round(Math.pow(1.075, o) * 60 * [1.6, 1.1, .8, .6][div] / 10) * 10);
}
function valueOf(p) {
  const o = ovr(p), potBoost = p.age <= 23 ? Math.max(0, p.pot * 5 - o) * .6 : 0;
  const ageF = p.age <= 21 ? 1.3 : p.age <= 26 ? 1.15 : p.age <= 29 ? 1 : p.age <= 31 ? .7 : .4;
  const v = 1500 * Math.pow(1.105, o + potBoost) * ageF * (.85 + p.form * .05);
  const r = v > 1e6 ? 50000 : v > 1e5 ? 5000 : 1000;
  return Math.max(5000, Math.round(v / r) * r);
}
const money = v => (v < 0 ? '-' : '') + '£' + (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(Math.abs(v) >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M' : Math.abs(v) >= 1e3 ? Math.round(Math.abs(v) / 1e3) + 'K' : Math.abs(v));
const pname = p => p ? p.fn[0] + '. ' + p.ln : '?';

// ---------- the world
function newWorld(managerName) {
  NEXT_ID = 1;
  const W = {v: 1, name: managerName || 'Gaffer', season: 0, week: 0, clubId: null, clubs: [], players: {}, inbox: [], history: [], career: {pts: 0, seasons: 0, trophies: [], clubs: []},
    settings: {mini: true, sound: true, speed: 2, autoPick: true}, nextId: 0, results: [], news: []};
  CLUBS.forEach((c, i) => {
    const div = Math.floor(i / 12), rank = i % 12;
    const level = [14.2, 11.6, 9.4, 7.4][div] - rank * .17 + (R() - .5) * .6;
    const club = {id: i, name: c[0], short: c[1], c1: c[2], c2: c[3], pat: c[4], div, rep: Math.round(92 - i * 1.5),
      cap: Math.round(([32000, 17000, 9000, 5000][div] - rank * [900, 500, 250, 150][div]) / 100) * 100,
      cash: Math.round([4e6, 1.4e6, 5e5, 2e5][div] * (1.3 - rank * .04) / 1e4) * 1e4, style: pick(Object.keys(STYLES).filter(s => s !== 'bus' || div > 1)),
      formation: pick(['4-4-2', '4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-5-1', '4-2-4']), squad: [], xi: null, bench: null, morale: 70, ticket: [18, 12, 9, 7][div]};
    const plan = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW'];
    plan.forEach((pos, k) => {
      const lv = level + (k % 6 < 2 ? 1 : k % 6 < 4 ? 0 : -1.4) + (R() - .5);
      const p = makePlayer(pos, lv, null, {div});
      p.club = club.id; W.players[p.id] = p; club.squad.push(p.id);
    });
    W.clubs.push(club);
  });
  // free agents and a few transfer-listed players
  for (let i = 0; i < 24; i++) { const p = makePlayer(pick(POS), ri(5, 11), ri(19, 34), {div: 3}); p.club = -1; W.players[p.id] = p; }
  W.nextId = NEXT_ID;
  return W;
}
