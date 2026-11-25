/* ---------- network: public MQTT relays, end-to-end encrypted with a key derived from the room code ----------
   Who does what
     host   the player whose device runs the game: it applies every action and publishes the whole state
     guest  sends its actions to the host and shows the state it receives
   Topics (per room): s = state (retained, so a newcomer gets it at once), a = actions, h = heartbeats
   Reliability
     - the room lives on every relay we can reach (both public brokers); each message goes out on all of them and
       receivers drop duplicates, so one relay failing mid-game changes nothing for the players
     - a guest resends an action until the host's state acknowledges it; the host republishes on every reconnect
     - a dead socket that never says so is caught by our own heartbeat not echoing back
     - if the host disappears, the first seated player still online takes over
   Size: the state is compressed before it is encrypted (about 5× smaller), unless someone in the room cannot
   decompress, in which case everybody gets it uncompressed. */
let S = null,
  snapPrev = null;
const BROKERS = window.BB_BROKERS || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const NET = {
  mode: null,
  code: null,
  bi: 0, // relay of the invite link (first one that worked)
  links: [], // {bi, c, rx}: one per relay we are connected to
  pending: [], // guest actions not yet acknowledged by the host
  online: new Map(), // cid -> last heartbeat time
  noZ: new Map(), // cid -> last time it said it cannot decompress
  err: '',
  busy: false,
  skew: 0,
  conn: true,
  timers: [],
  key: null,
  tid: null
};
const HAS_MQTT = () => !!window.mqtt;
const T_HB = 4000, // heartbeat period
  T_QUIET = 12000, // no echo for this long: the socket is dead
  T_GONE = 15000, // no heartbeat for this long: the player is offline
  T_RESEND = 3000; // unacknowledged action is sent again after this long

/* ----- encoding: JSON → (deflate) → AES-GCM → base64 ----- */
const enc = new TextEncoder(),
  dec = new TextDecoder();
const b64 = u => {
  let s = '';
  const a = new Uint8Array(u);
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const CAN_Z = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
const pipeBytes = async (u8, tf) =>
  new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(tf)).arrayBuffer());
async function deriveRoom(code) {
  const sub = crypto && crypto.subtle;
  if (!sub) {
    NET.key = null;
    NET.tid = 'p' + hash('t:' + code).toString(36) + hash('u:' + code).toString(36);
    return;
  }
  const h = new Uint8Array(await sub.digest('SHA-256', enc.encode('bb-topic:' + code)));
  NET.tid = [...h.slice(0, 10)].map(x => x.toString(16).padStart(2, '0')).join('');
  NET.key = await sub.importKey('raw', await sub.digest('SHA-256', enc.encode('bb-key:' + code)), 'AES-GCM', false, [
    'encrypt',
    'decrypt'
  ]);
}
// 'E' + iv + '.' + data: encrypted JSON; 'Z' + iv + '.' + data: encrypted deflated JSON; anything else: plain JSON
async function seal(o, z = false) {
  const js = JSON.stringify(o);
  if (!NET.key) return js;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let data = enc.encode(js);
  z = z && CAN_Z;
  if (z) data = await pipeBytes(data, new CompressionStream('deflate-raw'));
  return (z ? 'Z' : 'E') + b64(iv) + '.' + b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, NET.key, data));
}
async function unseal(s) {
  s = String(s);
  const t = s[0];
  if (t !== 'E' && t !== 'Z') return NET.key ? null : JSON.parse(s);
  if (!NET.key) return null;
  if (t === 'Z' && !CAN_Z) {
    sayNoZ();
    return null;
  }
  const [i, c] = s.slice(1).split('.');
  let data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(i) }, NET.key, unb64(c)));
  if (t === 'Z') data = await pipeBytes(data, new DecompressionStream('deflate-raw'));
  return JSON.parse(dec.decode(data));
}
// tell the host (once in a while) that we need uncompressed states
let noZSaid = 0;
function sayNoZ() {
  if (Date.now() - noZSaid < 3000 || !NET.key) return;
  noZSaid = Date.now();
  seal({ cid: CID, name: MYNAME, z: 0 }).then(m => pub(topic('h'), m));
}
const useZ = () => CAN_Z && ![...NET.noZ.values()].some(t => Date.now() - t < 60000);
const topic = x => `ballerbid/v1/${NET.tid}/${x}`;

/* ----- validation: everything received from other players is untrusted ----- */
// strip characters that could break out of HTML and cap sizes, so a malicious participant cannot inject markup or script
function deepClean(o, d = 0) {
  if (d > 12) return null;
  if (typeof o === 'string') return o.replace(/[<>"`\\]/g, '').slice(0, 2000);
  if (typeof o === 'number') return isFinite(o) ? o : 0;
  if (typeof o === 'boolean' || o === null) return o;
  if (Array.isArray(o)) return o.slice(0, 400).map(x => deepClean(x, d + 1));
  if (typeof o === 'object') {
    const r = {};
    for (const k of Object.keys(o).slice(0, 400)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      r[k] = deepClean(o[k], d + 1);
    }
    return r;
  }
  return null;
}
// reject structurally wrong states
function validState(m) {
  if (!m || typeof m !== 'object' || typeof m.v !== 'number') return false;
  const g = m.game;
  if (g) {
    if (!Array.isArray(g.sides) || !g.sides.length || !g.sides.every(x => ALL.includes(x))) return false;
    if (!/^[a-z0-9]{1,12}$/.test(String(g.gid))) return false;
    if (!Array.isArray(g.items) || !g.rosters || typeof g.rosters !== 'object') return false;
  }
  if (m.phase && !['lobby', 'cards', 'mission', 'auction', 'lineup', 'results', 'season'].includes(m.phase))
    return false;
  return true;
}
const onlineSet = () => new Set([...NET.online].filter(([, t]) => Date.now() - t < T_GONE).map(([c]) => c));

/* ----- transport: one MQTT connection per relay ----- */
function mqttConnect(bi) {
  return new Promise((res, rej) => {
    let done = false,
      c;
    try {
      c = mqtt.connect(BROKERS[bi], {
        clientId: 'bb_' + CID + '_' + Math.random().toString(36).slice(2, 6),
        clean: true,
        connectTimeout: 7000,
        reconnectPeriod: 2500,
        keepalive: 30,
        timerVariant: 'native'
      });
    } catch (e) {
      return rej(e);
    }
    const to = setTimeout(() => {
      if (!done) {
        done = true;
        try {
          c.end(true);
        } catch (e) {}
        rej(new Error('timeout'));
      }
    }, 8000);
    c.once('connect', () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      res(c);
    });
  });
}
// connect to every relay at once; resolves with the first one up (null if none), the others join as they come up
function connectFirst() {
  return new Promise(res => {
    let failed = 0,
      got = false;
    BROKERS.forEach((_, bi) =>
      mqttConnect(bi).then(
        c => {
          const L = { bi, c, rx: Date.now() };
          if (got) return lateLink(L);
          got = true;
          res(L);
        },
        () => {
          if (++failed === BROKERS.length) res(null);
        }
      )
    );
  });
}
// a relay that came up after the room was set up (or came back later): add it, or drop it if we left meanwhile
function lateLink(L) {
  if (!NET.mode || offline() || NET.links.some(x => x.bi === L.bi)) {
    try {
      L.c.end(true);
    } catch (e) {}
    return;
  }
  addLink(L);
  if (NET.mode === 'host') publishState();
  heartbeat();
}
const linkUp = L => !!(L.c && L.c.connected);
// send on every relay that is up; a relay that is down gets the current state when it reconnects
function pub(t, payload, opts) {
  let sent = false;
  NET.links.forEach(L => {
    if (linkUp(L)) {
      L.c.publish(t, payload, opts);
      sent = true;
    }
  });
  return sent;
}
function connState() {
  if (!NET.mode) return;
  const up = NET.links.some(linkUp);
  if (up !== NET.conn) {
    NET.conn = up;
    render();
  }
}
// the same message arrives once per relay: drop the copies (the iv at the front is unique per message)
const seen = new Map();
function firstCopy(s) {
  if (s[0] !== 'E' && s[0] !== 'Z') return true;
  const k = s.slice(0, 18);
  if (seen.has(k)) return false;
  seen.set(k, Date.now());
  if (seen.size > 400) {
    const old = Date.now() - 60000;
    for (const [x, t] of seen) if (t < old) seen.delete(x);
  }
  return true;
}
function heartbeat() {
  NET.online.set(CID, Date.now());
  seal({ cid: CID, name: MYNAME, z: CAN_Z ? 1 : 0 }).then(m => pub(topic('h'), m));
}
function addLink(L) {
  const c = L.c;
  NET.links.push(L);
  c.subscribe([topic('s'), topic('a'), topic('h')], { qos: 1 });
  c.on('message', (t, buf) => {
    L.rx = Date.now();
    onMsg(t, buf);
  });
  c.on('reconnect', connState);
  c.on('offline', connState);
  c.on('close', connState);
  c.on('connect', () => {
    L.rx = Date.now();
    connState();
    if (NET.mode === 'host') publishState();
    heartbeat();
  });
  connState();
}
function wire(links) {
  links.forEach(addLink);
  heartbeat();
  NET.timers.push(setInterval(heartbeat, T_HB));
  // our own heartbeat echoes back every 4 s on each relay; silence means that socket died without telling us
  NET.timers.push(
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      NET.links.forEach(L => {
        if (Date.now() - L.rx > T_QUIET) {
          L.rx = Date.now();
          try {
            L.c.reconnect();
          } catch (e) {}
        }
      });
      connState();
    }, 3000)
  );
  // a relay that was unreachable when we joined: keep trying it in the background
  NET.timers.push(
    setInterval(async () => {
      const have = new Set(NET.links.map(L => L.bi));
      for (let bi = 0; bi < BROKERS.length; bi++) {
        if (have.has(bi) || !NET.mode) continue;
        try {
          lateLink({ bi, c: await mqttConnect(bi), rx: Date.now() });
        } catch (e) {}
      }
    }, 20000)
  );
  NET.timers.push(
    setInterval(() => {
      if (NET.mode !== 'guest') return;
      // resend unacknowledged actions
      const t = Date.now();
      NET.pending.forEach(x => {
        if (t - x.sent > T_RESEND) {
          x.sent = t;
          seal({ cid: CID, n: x.n, a: x.a }).then(m => pub(topic('a'), m, { qos: 1 }));
        }
      });
      // the host vanished: the first seated player still online takes over
      if (S && S.auth && NET.joinedAt && t - NET.joinedAt > T_GONE && t - (NET.online.get(S.auth) || 0) > T_GONE) {
        const on = onlineSet();
        const cand = ALL.map(k => S.seats[k] && S.seats[k].cid).filter(c => c && c !== S.auth && on.has(c))[0];
        if (cand === CID) {
          NET.mode = 'host';
          S.auth = CID;
          toast('房主斷線了，由你接手主持運算');
          commit();
        }
      }
    }, 2000)
  );
}

/* ----- state sync ----- */
function commit() {
  if (!S) return;
  S.v = (S.v || 0) + 1;
  S.t = Date.now();
  S.app = APPV;
  if (NET.mode === 'local') lsSet(LS, S);
  if (NET.mode === 'ai') lsSet(LS_AI, S);
  if (NET.mode === 'host') publishState();
  render();
}
/* the state is a full snapshot, so only the newest one matters: while one is being encoded and sent, further commits
   just mark it dirty and the latest state goes out next (a burst of actions costs one or two messages, not one each) */
let pubBusy = false,
  pubDirty = false;
function publishState() {
  pubDirty = true;
  if (!pubBusy) flushState();
}
async function flushState() {
  pubBusy = true;
  try {
    while (pubDirty) {
      pubDirty = false;
      if (!S || NET.mode !== 'host') break;
      const m = await seal(S, useZ());
      pub(topic('s'), m, { qos: 1, retain: true });
    }
  } catch (e) {
  } finally {
    pubBusy = false;
  }
}
async function onMsg(t, buf) {
  const raw = buf.toString();
  if (!firstCopy(raw)) return;
  let m;
  try {
    m = deepClean(await unseal(raw));
  } catch (e) {
    return;
  }
  if (!m) return;
  if (t === topic('h')) {
    if (typeof m.cid === 'string') {
      const cid = m.cid.slice(0, 16),
        was = onlineSet().has(cid);
      NET.online.set(cid, Date.now());
      if (m.z !== 1) {
        // cannot decompress (an older browser, or an older copy of the game)
        const fresh = !NET.noZ.has(cid);
        NET.noZ.set(cid, Date.now());
        if (fresh && NET.mode === 'host') publishState(); // resend the state in a form it can read
      }
      if (!was) render();
    }
    return;
  }
  if (t === topic('a')) {
    if (NET.mode !== 'host' || !S) return;
    if (typeof m.cid !== 'string' || typeof m.n !== 'number' || !m.a) return;
    const cid = m.cid.slice(0, 16);
    NET.online.set(cid, Date.now());
    if (m.n <= (S.acks[cid] || 0)) return;
    const prev = snapOf();
    apply(S, m.a, { cid, role: roleOf(S, cid) });
    S.acks[cid] = m.n;
    fx(prev);
    commit();
    return;
  }
  if (t === topic('s')) {
    if (!validState(m)) return;
    if (NET.mode === 'host') {
      if (m.auth !== CID && m.v > S.v) {
        NET.mode = 'guest';
        takeState(m);
        toast('另一位玩家接手了房主');
      }
      return;
    }
    if (S && m.v <= S.v) return;
    takeState(m);
  }
}
function takeState(m) {
  const prev = snapOf();
  if (m.app && m.app !== APPV) ui.verWarn = true;
  S = m;
  NET.skew = (m.t || Date.now()) - Date.now();
  if (Math.abs(NET.skew) < 1500) NET.skew = 0;
  if (S.auth === CID && NET.mode === 'guest') {
    NET.mode = 'host';
  }
  const ack = (S.acks && S.acks[CID]) || 0;
  NET.pending = NET.pending.filter(x => x.n > ack);
  fx(prev);
  render();
}
let lastN = 0;
async function sendAct(a) {
  let n = Date.now();
  if (n <= lastN) n = lastN + 1;
  lastN = n;
  NET.pending.push({ a, n, sent: Date.now() });
  NET.pending = NET.pending.slice(-8);
  render();
  pub(topic('a'), await seal({ cid: CID, n, a }), { qos: 1 });
}

/* ----- rooms ----- */
function netReady() {
  if (!MYNAME) {
    toast('先輸入你的名字');
    return false;
  }
  if (!HAS_MQTT()) {
    NET.err = '連線元件載入失敗，請確認網路後重新整理';
    render();
    return false;
  }
  return true;
}
async function createRoom() {
  if (!netReady()) return;
  const code = randCode();
  NET.err = '';
  NET.busy = true;
  render();
  try {
    await deriveRoom(code);
    const first = await connectFirst();
    if (!first) throw new Error('連不上連線伺服器，請確認網路');
    S = newState();
    S.auth = CID;
    S.code = code;
    S.seats.A = { cid: CID, name: MYNAME };
    S.v = 1;
    S.t = Date.now();
    NET.bi = first.bi;
    NET.code = code;
    NET.mode = 'host';
    NET.joinedAt = Date.now();
    wire([first]);
    publishState();
    lsSet('bb_room', code + '-' + NET.bi);
    setHash();
    wakeLock();
  } catch (e) {
    NET.err = '開房失敗：' + ((e && e.message) || e);
    leaveNet();
    S = null;
  }
  NET.busy = false;
  render();
}
// connect to every relay and take the room's retained state from whichever delivers it first
function findRoom() {
  return new Promise(res => {
    const links = [];
    let best = null,
      left = BROKERS.length,
      finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(cap);
      links.forEach(L => L.c.removeAllListeners('message'));
      res({ st: best, links });
    };
    const cap = setTimeout(finish, 13000); // 8 s to connect + time for the retained state
    let wait = null;
    const settle = () => {
      if (--left > 0) return;
      if (!links.length) return finish();
      if (!best) wait = setTimeout(finish, 4500); // all relays answered: give the state a moment to arrive
    };
    BROKERS.forEach((_, bi) =>
      mqttConnect(bi).then(
        c => {
          const L = { bi, c, rx: Date.now() };
          if (finished) return lateLink(L);
          links.push(L);
          c.subscribe([topic('s'), topic('h')], { qos: 1 });
          c.on('message', async (t, buf) => {
            if (t !== topic('s') || finished) return;
            const raw = buf.toString();
            // the room's state is compressed and this browser cannot decompress: ask the host for a plain copy
            if (raw[0] === 'Z' && !CAN_Z) {
              seal({ cid: CID, name: MYNAME, z: 0 }).then(m => c.publish(topic('h'), m));
              return;
            }
            try {
              const m = deepClean(await unseal(raw));
              if (m && validState(m) && (!best || m.v > best.v)) {
                best = m;
                L.had = true;
                clearTimeout(wait);
                // a moment for the other relay, then go with the newest state
                setTimeout(finish, links.length < BROKERS.length && left > 0 ? 600 : 150);
              }
            } catch (e) {}
          });
          settle();
        },
        () => settle()
      )
    );
  });
}
async function joinRoom(code, bi) {
  code = String(code || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (code.length !== 6) {
    toast('房號是 6 個字');
    return;
  }
  if (!netReady()) return;
  NET.err = '';
  NET.busy = true;
  render();
  try {
    await deriveRoom(code);
    const { st, links } = await findRoom();
    if (!st) {
      links.forEach(L => {
        try {
          L.c.end(true);
        } catch (e) {}
      });
      throw new Error('找不到房間 ' + code.toUpperCase() + '（房號錯了，或房間已經沒人）');
    }
    // the invite link names the relay the host started on; keep it if we reached it
    NET.bi = bi != null && links.some(L => L.bi === bi) ? bi : (links.find(L => L.had) || links[0]).bi;
    NET.code = code;
    NET.mode = st.auth === CID ? 'host' : 'guest';
    S = null;
    takeState(st);
    NET.joinedAt = Date.now();
    wire(links);
    lsSet('bb_room', code + '-' + NET.bi);
    setHash();
    wakeLock();
  } catch (e) {
    NET.err = (e && e.message) || '加入失敗';
    leaveNet();
    S = null;
  }
  NET.busy = false;
  render();
}
function leaveNet() {
  NET.timers.forEach(clearInterval);
  NET.timers = [];
  NET.links.forEach(L => {
    try {
      L.c.end(true);
    } catch (e) {}
  });
  NET.links = [];
  NET.pending = [];
  NET.mode = null;
  NET.code = null;
  NET.online = new Map();
  NET.noZ = new Map();
  NET.skew = 0;
  NET.conn = true;
  try {
    wl && wl.release();
  } catch (e) {}
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {}
}

/* ----- device ----- */
let wl = null;
async function wakeLock() {
  try {
    if (navigator.wakeLock && document.visibilityState === 'visible') wl = await navigator.wakeLock.request('screen');
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !NET.mode || offline()) return;
  wakeLock();
  // back from the lock screen / another app: reconnect sockets that went quiet, then say we are here
  NET.links.forEach(L => {
    if (Date.now() - L.rx > 6000) {
      L.rx = Date.now();
      try {
        L.c.reconnect();
      } catch (e) {}
    }
  });
  heartbeat();
});
function setHash() {
  try {
    history.replaceState(null, '', location.pathname + location.search + '#room-' + NET.code + '-' + NET.bi);
  } catch (e) {}
}
function inviteLink() {
  return location.href.split('#')[0] + '#room-' + NET.code + '-' + NET.bi;
}
