// Backgammon rules engine and computer player.
//
// A position is an array of 28 numbers, always seen from the side whose turn it is
// (the "mover"). The mover's checkers are positive and move from point 24 down to 1.
//   [1..24]  the points: positive = mover's checkers, negative = opponent's
//   [25]     mover's checkers on the bar (they re-enter on points 24..19)
//   [0]      mover's checkers borne off
//   [26]     opponent's checkers on the bar
//   [27]     opponent's checkers borne off
// So a move is just {from, to}: from 25 means "from the bar", to 0 means "bear off".
(function (root) {
  const BAR = 25, OFF = 0, OBAR = 26, OOFF = 27;

  function start() {
    const p = new Array(28).fill(0);
    p[24] = 2; p[13] = 5; p[8] = 3; p[6] = 5;
    p[1] = -2; p[12] = -5; p[17] = -3; p[19] = -5;
    return p;
  }

  // The same position seen from the other side.
  function flip(p) {
    const q = new Array(28).fill(0);
    for (let i = 1; i <= 24; i++) q[i] = -p[25 - i];
    q[BAR] = p[OBAR]; q[OBAR] = p[BAR];
    q[OFF] = p[OOFF]; q[OOFF] = p[OFF];
    return q;
  }
  const flipMove = m => ({ from: m.from === BAR ? BAR : 25 - m.from, to: m.to === OFF ? OFF : 25 - m.to, die: m.die, hit: m.hit });

  function allHome(p) {
    if (p[BAR] > 0) return false;
    for (let i = 7; i <= 24; i++) if (p[i] > 0) return false;
    return true;
  }

  // Every way to use one die, ignoring the "use as many dice as you can" rule.
  function singleMoves(p, die) {
    const out = [];
    if (p[BAR] > 0) {
      const to = 25 - die;
      if (p[to] >= -1) out.push({ from: BAR, to, die, hit: p[to] === -1 });
      return out;
    }
    const home = allHome(p);
    let highest = 0;
    if (home) for (let i = 6; i >= 1; i--) if (p[i] > 0) { highest = i; break; }
    for (let i = 24; i >= 1; i--) {
      if (p[i] <= 0) continue;
      const to = i - die;
      if (to >= 1) {
        if (p[to] >= -1) out.push({ from: i, to, die, hit: p[to] === -1 });
      } else if (home && (to === 0 || i === highest)) {
        out.push({ from: i, to: OFF, die, hit: false });
      }
    }
    return out;
  }

  function apply(p, m) {
    const q = p.slice();
    q[m.from]--;
    if (m.to === OFF) { q[OFF]++; return q; }
    if (q[m.to] === -1) { q[m.to] = 0; q[OBAR]++; }
    q[m.to]++;
    return q;
  }

  const removeOne = (dice, d) => { const r = dice.slice(); r.splice(r.indexOf(d), 1); return r; };
  const uniq = a => [...new Set(a)];

  // The most dice that can be used from here.
  function maxUsable(p, dice, memo = new Map()) {
    if (!dice.length) return 0;
    const key = p.join(',') + '|' + dice.join('');
    if (memo.has(key)) return memo.get(key);
    let best = 0;
    for (const d of uniq(dice)) {
      for (const m of singleMoves(p, d)) {
        best = Math.max(best, 1 + maxUsable(apply(p, m), removeOne(dice, d), memo));
        if (best === dice.length) break;
      }
      if (best === dice.length) break;
    }
    memo.set(key, best);
    return best;
  }

  // The single moves the player may make next, given the dice still to play.
  // Enforces: use as many dice as possible, and if only one of two dice can be used, use the bigger one.
  function legalMoves(p, dice, fresh) {
    const memo = new Map();
    const M = maxUsable(p, dice, memo);
    if (!M) return [];
    let out = [];
    for (const d of uniq(dice)) {
      for (const m of singleMoves(p, d)) {
        if (maxUsable(apply(p, m), removeOne(dice, d), memo) === M - 1) out.push(m);
      }
    }
    if (fresh && M === 1 && dice.length === 2 && dice[0] !== dice[1]) {
      const big = Math.max(...dice);
      if (out.some(m => m.die === big)) out = out.filter(m => m.die === big);
    }
    return out;
  }

  // Every distinct position the mover can reach with a full, legal use of the dice.
  function allPlays(p, dice) {
    const results = new Map();
    const M = maxUsable(p, dice);
    if (!M) return [{ moves: [], pos: p }];
    const seen = new Set();
    (function walk(q, left, path) {
      if (path.length === M) {
        const k = q.join(',');
        if (!results.has(k)) results.set(k, { moves: path, pos: q });
        return;
      }
      const sk = q.join(',') + '|' + left.join('');
      if (seen.has(sk)) return;
      seen.add(sk);
      for (const m of legalMoves(q, left, path.length === 0)) walk(apply(q, m), removeOne(left, m.die), path.concat([m]));
    })(p, dice.slice(), []);
    return [...results.values()];
  }

  function pips(p) {
    let me = p[BAR] * 25, them = p[OBAR] * 25;
    for (let i = 1; i <= 24; i++) {
      if (p[i] > 0) me += p[i] * i;
      else if (p[i] < 0) them += -p[i] * (25 - i);
    }
    return [me, them];
  }

  function contact(p) {
    // Is any of the mover's checkers still behind any of the opponent's?
    if (p[BAR] > 0 || p[OBAR] > 0) return true;
    let myBack = 0, theirBack = 25;
    for (let i = 24; i >= 1; i--) if (p[i] > 0) { myBack = i; break; }
    for (let i = 1; i <= 24; i++) if (p[i] < 0) { theirBack = i; break; }
    return myBack > theirBack;
  }

  // How many of the 36 rolls hit a blot this many pips away (direct and combination shots, ignoring blocks).
  const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];

  // Score a position from the mover's point of view (bigger is better for the mover).
  function evaluate(p) {
    const [me, them] = pips(p);
    let s = (them - me) * 1.0;
    s += p[OFF] * 2 - p[OOFF] * 2;
    if (!contact(p)) return s * 2;

    // Points made: home board points block the opponent; the 5, 4 and 7 points are the best.
    const pointValue = [0, 1.2, 1.6, 2.2, 3, 4, 3.6, 3.2, 1.5, 1, 0.8, 0.6, 0.5, 0.4, 0, 0, 0, 0, 0, 1, 1, 1.2, 1.4, 1.2, 1];
    let run = 0, bestRun = 0;
    for (let i = 1; i <= 24; i++) {
      if (p[i] >= 2) { s += pointValue[i] * 2.2; run++; bestRun = Math.max(bestRun, run); }
      else run = 0;
    }
    s += [0, 0, 1, 3, 6, 10, 16][Math.min(bestRun, 6)];
    // Opponent checkers on the bar are worth more when our home board is strong.
    let homePts = 0;
    for (let i = 1; i <= 6; i++) if (p[i] >= 2) homePts++;
    s += p[OBAR] * (4 + homePts * 1.5);

    // Blots the opponent could hit.
    let theirs = [];
    if (p[OBAR] > 0) theirs.push(0);
    for (let i = 1; i <= 24; i++) if (p[i] < 0) theirs.push(i);
    let risk = 0;
    for (let i = 1; i <= 24; i++) {
      if (p[i] !== 1) continue;
      let miss = 1;
      for (const q of theirs) {
        const d = i - q;
        if (d >= 1 && d <= 24 && SHOTS[d]) miss *= 1 - SHOTS[d] / 36;
      }
      const hitChance = 1 - miss;
      if (hitChance > 0) {
        // Being hit costs the pips travelled so far, and hurts more when the opponent's board is strong.
        let theirHome = 0;
        for (let j = 19; j <= 24; j++) if (p[j] <= -2) theirHome++;
        risk += hitChance * ((25 - i) * 0.6 + 4 + theirHome * 2);
      }
    }
    s -= risk;
    // A checker on the bar against a strong home board is bad.
    if (p[BAR] > 0) {
      let closed = 0;
      for (let j = 19; j <= 24; j++) if (p[j] <= -2) closed++;
      s -= p[BAR] * closed * 3;
    }
    // Stacking lots of checkers on one point wastes them.
    for (let i = 1; i <= 24; i++) if (p[i] > 4) s -= (p[i] - 4) * 1.2;
    return s;
  }

  // The computer's choice for the mover. level 0 = easy (sometimes careless), 1 = normal.
  function bestPlay(p, dice, level = 1) {
    const plays = allPlays(p, dice);
    for (const pl of plays) {
      // Score after the move is from the opponent's viewpoint, so flip it.
      pl.score = evaluate(pl.pos) + (level === 0 ? Math.random() * 30 : Math.random() * 0.5);
    }
    plays.sort((a, b) => b.score - a.score);
    return plays[0];
  }

  function winner(p) {
    if (p[OFF] === 15) return 1;
    if (p[OOFF] === 15) return -1;
    return 0;
  }

  // 1 = single game, 2 = gammon, 3 = backgammon, for a mover who has just borne off their last checker.
  function winKind(p) {
    if (p[OOFF] > 0) return 1;
    // Loser still has a checker on the bar or in the winner's home board (points 1-6 for the mover).
    if (p[OBAR] > 0) return 3;
    for (let i = 1; i <= 6; i++) if (p[i] < 0) return 3;
    return 2;
  }

  root.BG = { start, flip, flipMove, singleMoves, apply, legalMoves, maxUsable, allPlays, evaluate, bestPlay, pips, winner, winKind, allHome, contact, BAR, OFF, OBAR, OOFF };
})(typeof window !== 'undefined' ? window : globalThis);
