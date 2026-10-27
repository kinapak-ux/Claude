// Party: play a game across phones with a 4-letter code. One phone hosts and decides
// everything; the others join and send what their player does. Phones talk directly
// over PeerJS. A joining phone that drops out reconnects by itself and is recognised
// by its device id, so it keeps its place in the game.
(function () {
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const pid = get('family-pid') || ('d' + Math.random().toString(36).slice(2, 10));
  set('family-pid', pid);
  const NET_TROUBLE = ['network', 'server-error', 'socket-error', 'browser-incompatible', 'ssl-unavailable'];
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

  function name() { return String(get('family-name') || get('mt_name') || '').trim().slice(0, 16); }
  function setName(n) { n = String(n || '').trim().slice(0, 16); if (n) set('family-name', n); return n; }

  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    const urls = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
    return urls.reduce((p, u) => p.catch(() => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = u; s.onload = () => (window.Peer ? res() : rej()); s.onerror = rej;
      document.head.appendChild(s);
    })), Promise.reject());
  }

  // Host a game. h: {onOpen(code), onJoin(pid, hello) -> true or a reason to refuse,
  // onConnect(pid), onMessage(pid, msg), onLeave(pid), onError(text)}
  async function host(prefix, h) {
    await loadPeer();
    const room = {
      code: null, peer: null, conns: new Map(), closed: false,
      send(id, m) { const c = room.conns.get(id); if (c && c.open) try { c.send(m); } catch (e) {} },
      isOn(id) { const c = room.conns.get(id); return !!(c && c.open); },
      close() { room.closed = true; try { room.peer && room.peer.destroy(); } catch (e) {} },
    };
    const open = attempt => {
      let code = '';
      for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
      const peer = new Peer(prefix + code, { debug: 0 });
      room.peer = peer;
      peer.on('open', () => { room.code = code; h.onOpen && h.onOpen(code); keepAwake(); });
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && attempt < 6) { peer.destroy(); open(attempt + 1); }
        else if (NET_TROUBLE.includes(e.type)) h.onError && h.onError('Connection trouble. Retrying…');
      });
      peer.on('disconnected', () => { if (!peer.destroyed && !room.closed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
      peer.on('connection', conn => {
        conn.on('data', d => {
          if (!d || typeof d !== 'object') return;
          if (d.t === 'hello') {
            const id = String(d.pid || '').slice(0, 40);
            if (!id) return;
            const ok = h.onJoin ? h.onJoin(id, d) : true;
            if (ok !== true) { try { conn.send({ t: 'refused', msg: ok || 'Sorry, you can’t join this game.' }); } catch (e) {} setTimeout(() => conn.close(), 300); return; }
            const old = room.conns.get(id);
            if (old && old !== conn) try { old.close(); } catch (e) {}
            conn.pid = id; room.conns.set(id, conn);
            h.onConnect && h.onConnect(id);
            return;
          }
          if (conn.pid && room.conns.get(conn.pid) === conn) h.onMessage && h.onMessage(conn.pid, d);
        });
        conn.on('close', () => { if (conn.pid && room.conns.get(conn.pid) === conn) { room.conns.delete(conn.pid); h.onLeave && h.onLeave(conn.pid); } });
        conn.on('error', () => {});
      });
    };
    open(0);
    return room;
  }

  // Join a game. h: {onMessage(msg), onStatus('ok' | 'lost'), onFail(text)}
  async function join(prefix, code, h, hello) {
    await loadPeer();
    const c = {
      closed: false, joined: false, conn: null, tries: 0, retryT: null,
      send(m) { if (c.conn && c.conn.open) { try { c.conn.send(m); return true; } catch (e) {} } return false; },
      close() { c.closed = true; clearTimeout(c.retryT); try { c.peer && c.peer.destroy(); } catch (e) {} },
    };
    const peer = new Peer({ debug: 0 });
    c.peer = peer;
    const connect = () => {
      if (c.closed) return;
      const conn = peer.connect(prefix + code, { reliable: true });
      c.conn = conn;
      conn.on('open', () => { c.tries = 0; conn.send(Object.assign({ t: 'hello', pid, name: name() }, hello || {})); });
      conn.on('data', d => {
        if (conn !== c.conn || !d || typeof d !== 'object') return;
        if (d.t === 'refused') { h.onFail && h.onFail(d.msg); c.close(); return; }
        if (!c.joined) { c.joined = true; keepAwake(); }
        h.onStatus && h.onStatus('ok');
        h.onMessage && h.onMessage(d);
      });
      conn.on('close', () => { if (conn === c.conn && !c.closed && c.joined) retry(); });
      conn.on('error', () => {});
    };
    const retry = () => {
      if (c.retryT || c.closed) return;
      h.onStatus && h.onStatus('lost');
      c.retryT = setTimeout(() => {
        c.retryT = null; c.tries++;
        if (peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch (e) {}
        connect();
      }, Math.min(2000 + c.tries * 1000, 6000));
    };
    peer.on('open', connect);
    peer.on('error', e => {
      if (c.closed) return;
      if (e.type === 'peer-unavailable') {
        if (c.joined) retry();
        else { h.onFail && h.onFail(`No game found with code ${code}. Check the letters!`); c.close(); }
      } else if (!c.joined && NET_TROUBLE.includes(e.type)) { h.onFail && h.onFail('Could not connect. Check your internet and try again.'); c.close(); }
    });
    peer.on('disconnected', () => { if (!c.closed && !peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && c.joined && !c.closed && (!c.conn || !c.conn.open)) retry();
    });
    return c;
  }

  let wake = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wake === null && (window.__partyActive)) keepAwake(); });

  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  window.Party = {
    pid, name, setName, host, join, keepAwake, cleanCode,
    inviteLink: code => location.origin + location.pathname + '?join=' + code,
    codeFromUrl: () => cleanCode(new URLSearchParams(location.search).get('join')),
  };
})();
