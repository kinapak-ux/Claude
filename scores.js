// Family leaderboard: every game sends its results here, and they go to the family's
// Google Sheet (see leaderboard/apps-script.txt). Results wait on the phone while it's
// offline or before the sheet is set up, then send themselves later.
(function () {
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyu4xJr6AKWeN0rTNnAFsAYo_uPQNt0m9ZBUVmaYP9nFBBbAq8GWAZNUpi66C0OpZasQQ/exec';  // the family's Google Apps Script web app
  const QUEUE = 'family-scores-queue', NAME = 'family-name', V2 = 'family-scores-v2';
  // The first version of the sheet's script only knew these games. Scores from newer games
  // wait on the phone until the sheet runs version 2, which accepts any game.
  const FIRST_GAMES = ['cardbattler', 'hoopshot', 'echowheel', 'scootcity', 'chess'];
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const queue = () => { try { return JSON.parse(get(QUEUE) || '[]'); } catch (e) { return []; } };
  const clean = n => String(n || '').trim().slice(0, 16);
  let v2 = get(V2) === '1';
  const noteVersion = out => { if (out && out.v >= 2 && !v2) { v2 = true; set(V2, '1'); } };

  function name(fallback) { return clean(get(NAME) || get('mt_name') || fallback); }
  function askName(fallback) {
    let n = name(fallback);
    if (!n) {
      n = clean(prompt('What name should go on the family leaderboard?'));
      if (n) set(NAME, n);
    }
    return n;
  }

  let sending = false;
  async function flush() {
    if (!ENDPOINT || sending || navigator.onLine === false) return;
    const q = queue(), old = q.filter(x => FIRST_GAMES.includes(x.g)), newer = q.filter(x => !FIRST_GAMES.includes(x.g));
    const batch = (v2 ? q : old.concat(newer.slice(0, 1))).slice(0, 20);   // one newer score checks whether the sheet has been updated
    if (!batch.length) return;
    sending = true;
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(batch) });
      const out = await res.json();
      if (out.ok) {
        noteVersion(out);
        const done = v2 ? batch : batch.filter(b => FIRST_GAMES.includes(b.g));
        const left = queue().filter(x => !done.some(b => b.id === x.id));
        set(QUEUE, JSON.stringify(left));
        if (done.length && left.length) setTimeout(flush, 500);
      }
    } catch (e) {
      setTimeout(flush, 30000);
    } finally {
      sending = false;
    }
  }

  // game: cardbattler | hoopshot | echowheel | scootcity | chess. board: which table within the game.
  function submit(game, board, score, opts) {
    opts = opts || {};
    const p = clean(opts.player) || askName(opts.fallbackName);
    if (!p || !(score >= 0)) return;
    const q = queue();
    q.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), g: game, b: String(board), p, s: score, d: String(opts.detail || '') });
    set(QUEUE, JSON.stringify(q.slice(-300)));
    flush();
  }

  async function list() {
    if (!ENDPOINT) throw new Error('not-set-up');
    const res = await fetch(ENDPOINT + '?t=' + Date.now());
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'failed');
    noteVersion(out);
    return out.rows;
  }

  window.FamilyScores = { ready: !!ENDPOINT, submit, list, name, setName: n => set(NAME, clean(n) || null), flush, waiting: () => queue().length, sheetUpdated: () => v2 };
  addEventListener('online', flush);
  setTimeout(flush, 2000);
})();
