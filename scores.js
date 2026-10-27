// Family leaderboard: every game sends its results here, and they go to the family's
// Google Sheet (see leaderboard/apps-script.txt). Results wait on the phone while it's
// offline or before the sheet is set up, then send themselves later.
(function () {
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyu4xJr6AKWeN0rTNnAFsAYo_uPQNt0m9ZBUVmaYP9nFBBbAq8GWAZNUpi66C0OpZasQQ/exec';  // the family's Google Apps Script web app
  const QUEUE = 'family-scores-queue', NAME = 'family-name';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const queue = () => { try { return JSON.parse(get(QUEUE) || '[]'); } catch (e) { return []; } };
  const clean = n => String(n || '').trim().slice(0, 16);

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
    const batch = queue().slice(0, 20);
    if (!batch.length) return;
    sending = true;
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(batch) });
      const out = await res.json();
      if (out.ok) {
        const left = queue().filter(x => !batch.some(b => b.id === x.id));
        set(QUEUE, JSON.stringify(left));
        if (left.length) setTimeout(flush, 500);
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
    return out.rows;
  }

  window.FamilyScores = { ready: !!ENDPOINT, submit, list, name, setName: n => set(NAME, clean(n) || null), flush, waiting: () => queue().length };
  addEventListener('online', flush);
  setTimeout(flush, 2000);
})();
