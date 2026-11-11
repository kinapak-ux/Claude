// Go rules engine and a simple computer player.
// A board is an array of size*size: 0 empty, 1 black, 2 white. Points are numbered row by row.
(function (root) {
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const other = c => 3 - c;

  function make(size) { return { size, b: new Array(size * size).fill(0), ko: -1, toPlay: BLACK, caps: [0, 0, 0], passes: 0, history: [] }; }

  function nbrs(size, i) {
    const r = Math.floor(i / size), c = i % size, out = [];
    if (r > 0) out.push(i - size);
    if (r < size - 1) out.push(i + size);
    if (c > 0) out.push(i - 1);
    if (c < size - 1) out.push(i + 1);
    return out;
  }

  // The group of stones connected to point i, and its liberties (empty neighbours).
  function group(b, size, i) {
    const col = b[i], stones = [i], libs = new Set(), seen = new Set([i]);
    for (let k = 0; k < stones.length; k++) {
      for (const n of nbrs(size, stones[k])) {
        if (b[n] === EMPTY) libs.add(n);
        else if (b[n] === col && !seen.has(n)) { seen.add(n); stones.push(n); }
      }
    }
    return { stones, libs, color: col };
  }

  // Try a move. Returns null and a reason if it's not allowed.
  function tryPlay(g, i, col = g.toPlay) {
    const { size } = g;
    if (g.b[i] !== EMPTY) return { error: 'occupied' };
    if (i === g.ko && col === g.toPlay) return { error: 'ko' };
    const b = g.b.slice();
    b[i] = col;
    const captured = [];
    for (const n of nbrs(size, i)) {
      if (b[n] === other(col)) {
        const gr = group(b, size, n);
        if (gr.libs.size === 0) for (const s of gr.stones) { b[s] = EMPTY; captured.push(s); }
      }
    }
    const mine = group(b, size, i);
    if (mine.libs.size === 0) return { error: 'suicide' };
    // Simple ko: capturing exactly one stone with a lone stone that is left with one liberty.
    const ko = (captured.length === 1 && mine.stones.length === 1 && mine.libs.size === 1) ? captured[0] : -1;
    return { b, captured, ko, group: mine };
  }

  function play(g, i) {
    const r = tryPlay(g, i);
    if (r.error) return r;
    g.history.push({ b: g.b, ko: g.ko, toPlay: g.toPlay, caps: g.caps.slice(), passes: g.passes, move: i });
    g.b = r.b; g.ko = r.ko; g.caps[g.toPlay] += r.captured.length; g.toPlay = other(g.toPlay); g.passes = 0;
    return r;
  }
  function pass(g) {
    g.history.push({ b: g.b, ko: g.ko, toPlay: g.toPlay, caps: g.caps.slice(), passes: g.passes, move: -1 });
    g.ko = -1; g.toPlay = other(g.toPlay); g.passes++;
  }
  function undo(g) {
    const h = g.history.pop();
    if (!h) return false;
    g.b = h.b; g.ko = h.ko; g.toPlay = h.toPlay; g.caps = h.caps; g.passes = h.passes;
    return true;
  }

  // An empty point completely surrounded by one colour's stones (or the edge) - a simple "eye".
  function isEye(b, size, i, col) {
    if (b[i] !== EMPTY) return false;
    for (const n of nbrs(size, i)) if (b[n] !== col) return false;
    // Check the diagonals so we don't call a false eye real.
    const r = Math.floor(i / size), c = i % size;
    let bad = 0, edge = false;
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) { edge = true; continue; }
      if (b[rr * size + cc] === other(col)) bad++;
    }
    return edge ? bad === 0 : bad < 2;
  }

  // Rough "who controls each point" map: stones radiate influence that fades with distance.
  function influence(b, size) {
    const inf = new Array(size * size).fill(0);
    const stones = [];
    for (let i = 0; i < b.length; i++) if (b[i]) stones.push(i);
    for (let i = 0; i < b.length; i++) {
      if (b[i]) { inf[i] = b[i] === BLACK ? 9 : -9; continue; }
      const r = Math.floor(i / size), c = i % size;
      let v = 0;
      for (const s of stones) {
        const d = Math.abs(Math.floor(s / size) - r) + Math.abs(s % size - c);
        if (d <= 4) v += (b[s] === BLACK ? 1 : -1) * [0, 1, .5, .25, .1][d];
      }
      inf[i] = v;
    }
    return inf;
  }
  // Estimated score (black minus white, no komi) from the influence map.
  function estimate(b, size) {
    const inf = influence(b, size);
    let s = 0;
    for (const v of inf) s += v > 0.2 ? 1 : v < -0.2 ? -1 : 0;
    return s;
  }

  // Area scoring: your stones plus empty areas that only touch your stones. `dead` is a Set of points to remove first.
  function score(b, size, dead = new Set(), komi = 6.5) {
    const bd = b.slice();
    const prisoners = [0, 0, 0];
    for (const d of dead) if (bd[d]) { prisoners[other(bd[d])]++; bd[d] = EMPTY; }
    const owner = new Array(size * size).fill(0);
    const area = [0, 0, 0];
    const seen = new Set();
    for (let i = 0; i < bd.length; i++) {
      if (bd[i]) { area[bd[i]]++; owner[i] = bd[i]; continue; }
      if (seen.has(i)) continue;
      const region = [i], touches = new Set();
      seen.add(i);
      for (let k = 0; k < region.length; k++) {
        for (const n of nbrs(size, region[k])) {
          if (bd[n] === EMPTY) { if (!seen.has(n)) { seen.add(n); region.push(n); } }
          else touches.add(bd[n]);
        }
      }
      if (touches.size === 1) {
        const c = [...touches][0];
        area[c] += region.length;
        for (const r of region) owner[r] = c;
      }
    }
    return { black: area[BLACK], white: area[WHITE] + komi, komi, owner, margin: area[BLACK] - area[WHITE] - komi };
  }

  // Guess which groups are dead at the end: weak groups sitting in the other side's area.
  function guessDead(b, size) {
    const inf = influence(b, size);
    const dead = new Set(), seen = new Set();
    for (let i = 0; i < b.length; i++) {
      if (!b[i] || seen.has(i)) continue;
      const g = group(b, size, i);
      g.stones.forEach(s => seen.add(s));
      // Count eyes the group owns.
      let eyes = 0;
      for (const l of g.libs) if (isEye(b, size, l, g.color)) eyes++;
      if (eyes >= 2) continue;
      // How much of the area around it does the opponent control?
      let around = 0;
      for (const l of g.libs) around += inf[l];
      const sign = g.color === BLACK ? 1 : -1;
      if (g.libs.size <= 1 || (around * sign < 0 && g.libs.size <= 3 && g.stones.length <= 6)) g.stones.forEach(s => dead.add(s));
    }
    return dead;
  }

  // Pick a move for the side to play. Returns a point, or -1 to pass.
  // level 0 = beginner (more random), 1 = normal.
  function bestMove(g, level = 1) {
    const { size, b } = g;
    const col = g.toPlay, opp = other(col), sign = col === BLACK ? 1 : -1;
    const base = estimate(b, size) * sign;
    const stoneCount = b.filter(x => x).length;
    // Our groups already in danger.
    const myAtari = [];
    const seen = new Set();
    for (let i = 0; i < b.length; i++) {
      if (b[i] !== col || seen.has(i)) continue;
      const gr = group(b, size, i);
      gr.stones.forEach(s => seen.add(s));
      if (gr.libs.size === 1) myAtari.push(gr);
    }
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < b.length; i++) {
      if (b[i] !== EMPTY) continue;
      if (isEye(b, size, i, col)) continue;
      const r = tryPlay(g, i, col);
      if (r.error) continue;
      let s = 0;
      // Captures are great, especially if they rescue our own stones.
      s += r.captured.length * 12;
      // Saving our own stones that were in atari.
      for (const gr of myAtari) {
        if (gr.libs.has(i) && r.group.libs.size >= 2) s += 10 * gr.stones.length + (r.group.libs.size >= 3 ? 6 : 0);
      }
      // Don't put our own stones in atari (unless it captures).
      if (r.group.libs.size === 1 && !r.captured.length) s -= 8 * r.group.stones.length + 6;
      else if (r.group.libs.size === 2 && r.group.stones.length > 2 && !r.captured.length) s -= 2;
      // Putting the opponent in atari, or reducing their liberties.
      const touched = new Set();
      for (const n of nbrs(size, i)) {
        if (r.b[n] !== opp || touched.has(n)) continue;
        const og = group(r.b, size, n);
        og.stones.forEach(t => touched.add(t));
        if (og.libs.size === 1 && r.group.libs.size >= 2) s += 4 + 3 * og.stones.length;
        else if (og.libs.size === 2) s += 1;
      }
      // Territory gained according to the influence estimate.
      s += (estimate(r.b, size) * sign - base) * 0.9;
      // Early on, prefer the 3rd and 4th lines and avoid the edge.
      const rr = Math.floor(i / size), cc = i % size;
      const edge = Math.min(rr, cc, size - 1 - rr, size - 1 - cc);
      if (stoneCount < size * 1.5) s += [-6, -3, 2, 2.5, 1][Math.min(edge, 4)];
      else if (edge === 0) s -= 1.5;
      s += Math.random() * (level === 0 ? 6 : 1.2);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    // Nothing worthwhile left: pass.
    if (best < 0 || bestScore < (level === 0 ? 0.5 : 1.2)) return -1;
    return best;
  }

  root.GO = { make, nbrs, group, tryPlay, play, pass, undo, isEye, influence, estimate, score, guessDead, bestMove, EMPTY, BLACK, WHITE, other };
})(typeof window !== 'undefined' ? window : globalThis);
