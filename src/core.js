/* =========================================================
   BALLER BID 球星喊價
   Stats: Basketball-Reference (via sumitrodatta/bball-reference-datasets)

   One page, no server. bundle2.py joins the sources in this order into a single <script>:
     core.js      data loading, positions, chemistry, game state and the auction engine
     (game modules: mis, season, views2, legend, phase, bench, place, formats, cards, bot, sfx, views3, log, tactics)
     sim.js       matchup model: strength, tactics, takeovers, box scores, series
     net.js       online play: encrypted MQTT relay, state sync, host hand-over
     flow.js      dispatch, local/AI modes, phase transitions, sound/vibration cues, update check
     views.js     screens: home, lobby, auction, lineup
     playback.js  game-by-game text play-by-play and results
     events.js    taps, inputs, drag-and-drop and the action handlers
   All files share one global scope (S = game state, ui = screen-only state, NET = connection).
   ========================================================= */
const POS = ['PG', 'SG', 'SF', 'PF', 'C'],
  ALL = ['A', 'B', 'C'];
const T_NOBID = 20000,
  T_BID = 15000,
  T_LINEUP = 90000;
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const normName = s =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
function lsGet(k) {
  try {
    return JSON.parse(localStorage.getItem(k));
  } catch (e) {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
}
const LS = 'ballerbid_local_v1',
  LS_AI = 'ballerbid_ai_v1';
let CID = lsGet('bb_cid');
if (!CID) {
  CID = Math.random().toString(36).slice(2, 10);
  lsSet('bb_cid', CID);
}
let MYNAME = lsGet('bb_name') || '';
const clean = (s, n = 14) =>
  String(s || '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, n);
const APPV = '2026.11.26e';
const own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = s => {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
function shuffle(a, r = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const ALPH = 'abcdefghjkmnpqrstuvwxyz23456789';
const randCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPH[b % 31]).join('');
const vibe = ms => {
  try {
    navigator.vibrate && navigator.vibrate(ms);
  } catch (e) {}
};

/* ---------- data ---------- */
let THEMES = [],
  CAREER = null,
  LINKS = null,
  BIOS = null;
function careerFrom(j) {
  CAREER = new Map();
  j.rows.forEach(row => {
    const o = {};
    j.cols.forEach((c, i) => (o[c] = row[i]));
    o.est = o.est ? ['bpm'] : [];
    CAREER.set(normName(o.n), o);
  });
}
function themesFrom(j) {
  if (Array.isArray(j)) return addUsaAll(j);
  return addUsaAll(
    j.themes.map(t => ({
      ...t,
      items: t.items.map(r => {
        const o = {};
        j.cols.forEach((c, i) => {
          if (r[i] != null) o[c] = r[i];
        });
        o.est = o.est ? ['bpm'] : [];
        return o;
      })
    }))
  );
}
function addUsaAll(T) {
  THEMES = T;
  const ids = T.filter(t => t.cat === '夢幻隊').map(t => t.id);
  if (!ids.length) return T;
  T.splice(ids.length, 0, {
    id: 'usaall',
    name: '歷屆夢幻隊（1992–2024 全部）',
    tag: '九屆奧運美國隊合併・同一球員取數據最好的那屆',
    cat: '夢幻隊',
    y0: 1991,
    y1: 2023,
    items: pickPool(ids).items
  });
  // champion lineups grouped by decade, for the 指定 picker (individual champions stay in the random pool)
  const ch = T.filter(t => t.cat === '陣容' && t.y0 != null).sort((a, b) => a.y0 - b.y0),
    by = {};
  ch.forEach(t => {
    const d = Math.floor(t.y0 / 10) * 10;
    (by[d] = by[d] || []).push(t);
  });
  Object.keys(by)
    .sort()
    .forEach(d => {
      const ts = by[d],
        best = new Map();
      // only each champion's 8-man rotation (by minutes), so the pool is the players people remember
      ts.forEach(t =>
        t.items
          .slice()
          .sort((x, y) => num(y.mp, 0) * num(y.g, 0) - num(x.mp, 0) * num(x.g, 0))
          .slice(0, 8)
          .forEach(p => {
            const k = p.id || normName(p.n),
              v = num(p.obpm, 0) + num(p.dbpm, 0),
              o = best.get(k);
            if (!o || v > o.v) best.set(k, { p, v });
          })
      );
      const pp = { items: [...best.values()].map(x => x.p) };
      T.push({
        id: 'champ' + d,
        name: `${d} 年代冠軍隊`,
        tag: `${ts.length} 支冠軍隊合併：${ts.map(t => t.name.replace(/（.*）/, '')).join('、')}（各取上場時間最多的 8 人）・同一球員取數據最好的那季`,
        cat: '陣容',
        grp: 1,
        y0: +d,
        y1: +d + 9,
        items: pp.items
      });
    });
  return T;
}
async function loadData() {
  const inl = id => {
    const el = document.getElementById(id);
    return el ? JSON.parse(el.textContent) : null;
  };
  const t = inl('d-themes');
  if (t) {
    THEMES = themesFrom(t);
    careerFrom(inl('d-career'));
    LINKS = inl('d-links');
    BIOS = inl('d-bios');
    return;
  }
  THEMES = themesFrom(await (await fetch('data/themes.json')).json());
  careerFrom(await (await fetch('data/career.json')).json());
  LINKS = await (await fetch('data/links.json')).json();
  BIOS = await (await fetch('data/bios.json')).json();
}
function parseCustom(text) {
  return String(text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map(l => {
      const [n, p = ''] = l.split(/[,，]/).map(s => s.trim());
      if (!n) return null;
      const hit = CAREER && CAREER.get(normName(n));
      const o = hit ? { ...hit, n } : { n, pos: '', nostat: true };
      const P = p.toUpperCase();
      if (POS.includes(P)) {
        o.pos = P;
        if (!hit) {
          o.pe = POS.indexOf(P) + 1;
          o.lo = o.pe;
          o.hi = o.pe;
        }
      }
      return o;
    })
    .filter(Boolean);
}
const CATS = ['夢幻隊', '陣容', '年代', '隊史', '特別'];
const BENCH = ['B1', 'B2', 'B3', 'B4', 'B5'];
const SLOTS = g => (g && g.size === 10 ? POS.concat(BENCH) : POS);
const isBench = x => BENCH.includes(x),
  slotLab = x => (isBench(x) ? '替補' + x[1] : x);
const starters = R => R.filter(p => !isBench(p.slot)),
  benchOf = R => R.filter(p => isBench(p.slot));

/* ---------- positions ---------- */
const PNUM = { PG: 1, G: 1.5, SG: 2, GF: 2.5, SF: 3, F: 3.5, PF: 4, FC: 4.5, C: 5 };
const peOf = p => (typeof p.pe === 'number' ? p.pe : PNUM[String(p.pos || '').split('-')[0]] || 3);
function posInfo(p, slot) {
  const i = POS.indexOf(slot);
  if (i < 0) return { tier: 0, lab: '', x: 0, dir: 0 };
  const s = i + 1,
    pe = peOf(p),
    lo = num(p.lo, pe),
    hi = num(p.hi, pe);
  if (s >= lo - 0.01 && s <= hi + 0.01) {
    const off = Math.max(0, Math.abs(s - pe) - 0.5),
      dir = s > pe ? 1 : -1;
    return off < 0.6 ? { tier: 0, lab: '本位', x: 0, dir } : { tier: 1, lab: '可打', x: 0.15 * off, dir };
  }
  const d = s < lo ? lo - s : s - hi,
    dir = s > hi ? 1 : -1,
    x = Math.min(3, d);
  return d <= 1.01 ? { tier: 2, lab: '勉強', x, dir } : { tier: 3, lab: '不適合', x, dir };
}
const canPlay = p => POS.filter(s => posInfo(p, s).tier <= 1);

/* ---------- chemistry ---------- */
const FEUDS = [
  {
    a: 'onealsh01',
    b: 'bryanko01',
    lv: 2,
    t: '1996–2004 湖人：三連霸期間不和公開化，2004 年 Shaq 被交易到熱火。',
    u: 'https://www.wikipedia.org/wiki/Shaq-Kobe_feud'
  },
  {
    a: 'bryanko01',
    b: 'howardw01',
    lv: 2,
    t: '2012–13 湖人：隊內會議當面起衝突，Howard 球季結束就離隊；後來的湖人教練直言兩人互看不順眼。',
    u: 'https://abc7.com/post/elbow-causes-kobe-dwight-tussle/370891/'
  },
  {
    a: 'allenra02',
    b: 'rondora01',
    lv: 2,
    t: '2007–12 塞爾提克：隊友透露兩人曾戴拳套在重訓室「解決恩怨」；Allen 2012 年轉投熱火。',
    u: 'https://www.cbssports.com/nba/news/kendrick-perkins-says-celtics-made-ray-allen-and-rajon-rondo-box-each-other-to-settle-their-beef'
  },
  {
    a: 'hardeja01',
    b: 'paulch01',
    lv: 1,
    t: '2017–19 火箭：媒體報導關係「無法挽回」，Paul 隔年被交易（Harden 否認不合）。',
    u: 'https://sports.yahoo.com/sources-relationship-between-rockets-stars-james-harden-chris-paul-termed-unsalvageable-200951028.html'
  },
  {
    a: 'embiijo01',
    b: 'simmobe01',
    lv: 1,
    t: '2017–21 76 人：Simmons 自己說兩人「從沒真正說過話」，2021 年鬧到被交易。',
    u: 'https://www.si.com/nba/2022/10/14/ben-simmons-on-joel-embiid-relationship-we-never-really-spoke-nets-76ers'
  },
  {
    a: 'irvinky01',
    b: 'jamesle01',
    lv: 1,
    t: '2014–17 騎士：Kyrie 2017 年要求交易，報導指他想走出 LeBron 的光環。',
    u: 'https://www.nba.com/news/report-kyrie-irving-seeks-trade-cleveland-cavaliers'
  },
  {
    a: 'greendr01',
    b: 'duranke01',
    lv: 1,
    t: '2016–19 勇士：2018 年場上爭執延燒到更衣室，Draymond 被球隊禁賽一場。',
    u: 'https://www.nba.com/article/2018/11/13/report-durant-green-exchange-carries-over-locker-room'
  },
  {
    a: 'thomais01',
    b: 'dantlad01',
    lv: 1,
    t: '1986–89 活塞：Dantley 認定是 Isiah 主導把他交易走（球隊高層否認）。',
    u: 'https://www.nba.com/pistons/features/truebluepistons_110801.html'
  },
  {
    a: 'marbust01',
    b: 'garneke01',
    lv: 1,
    t: '1996–99 灰狼：球隊高層表示 Marbury 因嫉妒 Garnett 的合約要求交易。',
    u: 'https://www.espn.com/nba/2000/20000220/recap/njnmin.html'
  },
  {
    a: 'onealsh01',
    b: 'hardaan01',
    lv: 1,
    t: '1993–96 魔術：兩人關係冷卻，Shaq 1996 年離隊，Penny 是從媒體得知。',
    u: 'https://www.nba.com/magic/news/reflecting-back-shaqs-magic-and-nba-career-20160908'
  },
  {
    a: 'butleji01',
    b: 'townska01',
    lv: 1,
    t: '2017–19 灰狼：Butler 2018 年練球時公開痛批 Towns 不夠拚。',
    u: 'https://global.espn.com/nba/story/_/id/24950981/jimmy-butler-heated-practice-timberwolves'
  },
  {
    a: 'butleji01',
    b: 'wiggian01',
    lv: 1,
    t: '2017–19 灰狼：Butler 2018 年練球時公開痛批 Wiggins 不夠拚。',
    u: 'https://global.espn.com/nba/story/_/id/24950981/jimmy-butler-heated-practice-timberwolves'
  }
];
const tsCache = new Map();
function tsOf(id) {
  if (!id || !LINKS) return null;
  if (tsCache.has(id)) return tsCache.get(id);
  const s = own(LINKS.p, id) ? LINKS.p[id] : null;
  let set = null;
  if (typeof s === 'string') {
    set = new Set();
    for (let i = 0; i < s.length; i += 3) set.add(s.substr(i, 3));
  }
  tsCache.set(id, set);
  return set;
}
function shared(a, b) {
  const A = tsOf(a.id),
    B = tsOf(b.id);
  if (!A || !B) return 0;
  let k = 0;
  for (const x of A) if (B.has(x)) k++;
  return k;
}
const feudOf = (a, b) =>
  a.id && b.id ? FEUDS.find(f => (f.a === a.id && f.b === b.id) || (f.a === b.id && f.b === a.id)) : null;
const tmOn = g => !(g.theme && g.theme.cat === '陣容');
function chem(roster, g) {
  const pairs = [],
    feuds = [];
  for (let i = 0; i < roster.length; i++)
    for (let j = i + 1; j < roster.length; j++) {
      const a = roster[i],
        b = roster[j];
      const k = tmOn(g) ? shared(a, b) : 0;
      if (k >= 2) pairs.push({ a: a.n, b: b.n, k, v: Math.min(1, 0.2 * k) });
      const f = feudOf(a, b);
      if (f) feuds.push({ a: a.n, b: b.n, lv: f.lv, t: f.t, u: f.u, v: f.lv === 2 ? 1.5 : 0.8 });
    }
  const tm = Math.min(
      2.5,
      pairs.reduce((s, p) => s + p.v, 0)
    ),
    fd = Math.min(
      3,
      feuds.reduce((s, p) => s + p.v, 0)
    );
  const swN = starters(roster).filter(p => canPlay(p).length >= 3).length;
  const sw = swN >= 5 ? 1.5 : swN === 4 ? 0.8 : 0;
  const lg = legendsOf(roster),
    lgv = Math.min(
      2.5,
      lg.reduce((t, x) => t + x.v, 0)
    );
  return { pairs, feuds, tm, fd, sw, swN, lg, lgv };
}

/* ---------- state & engine ---------- */
function newState() {
  return {
    v: 0,
    t: 0,
    phase: 'lobby',
    auth: null,
    code: null,
    cfg: {
      players: 2,
      budget: 15,
      size: 5,
      theme: 'random',
      cards: false,
      cats: [...CATS],
      era: null,
      teams: [],
      picks: [],
      pcat: '夢幻隊',
      draw: 12,
      showStats: false,
      hints: false,
      mis: false,
      season: 0,
      bal: true,
      fmt: 'open',
      nom: false,
      custom: { name: '', text: '' }
    },
    seats: { A: null, B: null, C: null },
    names: { A: '玩家 A', B: '玩家 B', C: '玩家 C' },
    game: null,
    acks: {},
    scores: {},
    sim: null,
    err: '',
    by: null,
    season: null,
    lastSeason: null
  };
}
const sidesOf = n => ALL.slice(0, n);
const openSlots = (g, s) => {
  const u = g.rosters[s].map(r => r.slot);
  return SLOTS(g).filter(x => !u.includes(x));
};
const openN = (g, s) => openSlots(g, s).length;
const left = (g, s) => (g.bud && g.bud[s] != null ? g.bud[s] : g.budget) - g.spent[s];
const maxBid = (g, s) => (openN(g, s) ? left(g, s) - (openN(g, s) - 1) : 0);
/* when every other team is full, the last team no longer bids: each next card costs $1 and it may skip only a few,
   so it cannot flip through the whole pool for free */
const fmtBusy = g => !!(g.stage || g.sb || g.price != null);
const soloOf = g => {
  if (g.sides.length < 2) return null;
  const e = g.sides.filter(s => openN(g, s) > 0);
  return e.length === 1 ? e[0] : null;
};
const remain = g => g.items.length - g.idx;
const isOver = g => g.sides.every(s => openN(g, s) === 0) || g.idx >= g.items.length;
const cur = g => g.items[g.idx];
const eligible = g => g.sides.filter(s => openN(g, s) > 0);
const nm = (S, s) => (offline() ? S.names[s] : S.seats[s] && S.seats[s].name) || '玩家 ' + s;
// no network: pass-and-play ('local') or against the computer ('ai', the human is always seat A)
function offline() {
  return NET.mode === 'local' || NET.mode === 'ai';
}
function roleOf(S, cid) {
  if (NET.mode === 'local') return 'all';
  if (NET.mode === 'ai') return 'A';
  for (const k of ALL) if (S.seats[k] && S.seats[k].cid === cid) return k;
  return 'spec';
}
const scoreKey = (S, s) => (offline() ? 'L' + s + ':' + S.names[s] : S.seats[s] ? S.seats[s].cid : s);
const now = () => Date.now() + (NET.skew || 0);
function themeOk(t, cfg) {
  return t.items.length >= cfg.players * (cfg.size || 5);
}
// several themes merged into one pool; a player who appears more than once keeps his best version
function pickPool(ids) {
  const ts = (ids || []).map(id => THEMES.find(t => t.id === id)).filter(Boolean),
    best = new Map();
  ts.forEach(t =>
    t.items.forEach(p => {
      const k = p.id || normName(p.n),
        v = num(p.obpm, 0) + num(p.dbpm, 0),
        o = best.get(k);
      if (!o || v > o.v) best.set(k, { p, v });
    })
  );
  return { ts, items: [...best.values()].map(x => x.p) };
}
const FRZH = {
  ATL: '老鷹',
  BOS: '塞爾提克',
  BRK: '籃網',
  CHO: '黃蜂',
  CHI: '公牛',
  CLE: '騎士',
  DAL: '獨行俠',
  DEN: '金塊',
  DET: '活塞',
  GSW: '勇士',
  HOU: '火箭',
  IND: '溜馬',
  LAC: '快艇',
  LAL: '湖人',
  MEM: '灰熊',
  MIA: '熱火',
  MIL: '公鹿',
  MIN: '灰狼',
  NOP: '鵜鶘',
  NYK: '尼克',
  OKC: '雷霆・超音速',
  ORL: '魔術',
  PHI: '76人',
  PHO: '太陽',
  POR: '拓荒者',
  SAC: '國王',
  SAS: '馬刺',
  TOR: '暴龍',
  UTA: '爵士',
  WAS: '巫師・子彈'
};
const DECS = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
// a theme fits the era filter when at least half of its years fall inside the chosen decades
function eraOk(t, c) {
  const e = c.era;
  if (!e) return true;
  if (t.y0 == null) return false;
  const a = e[0],
    b = e[1] + 9,
    y0 = t.y0,
    y1 = t.y1;
  const ov = Math.min(y1, b) - Math.max(y0, a) + 1;
  return ov >= Math.max(1, 0.5 * (y1 - y0 + 1));
}
/* random mode = union of the ticked categories, optionally narrowed by decade (特別 ignores the decade).
   Choosing particular teams/seasons lives in 指定, which can also draw one of the chosen themes in secret. */
const CATNAME = { 夢幻隊: '夢幻隊', 陣容: '冠軍隊', 年代: '年代全明星', 隊史: '球隊', 特別: '特別' };
const CATDESC = {
  夢幻隊: '歷屆奧運美國隊',
  陣容: '歷屆 NBA 冠軍隊陣容',
  年代: '某個年代的全明星',
  隊史: '某隊某年代，或隊史傳奇',
  特別: 'MVP、狀元、國際球星、選秀梯隊'
};
const ERA_ON = k => k !== '特別',
  TEAM_ON = k => k === '陣容' || k === '隊史';
/* A theme smaller than the rosters need (common in 10-man mode: most themes have 12-17 players) is not dropped:
   when it is drawn, the closest themes of the same category are merged in (same team first, then nearest years)
   until the pool is big enough. So the theme count does not depend on 5- or 10-man mode. */
const catCands = (c, k) => THEMES.filter(t => !t.grp && t.cat === k && (!ERA_ON(k) || eraOk(t, c)));
const needOf = c => c.players * (c.size || 5);
const catPool = (c, k) => {
  const cs = catCands(c, k);
  return cs.some(t => themeOk(t, c)) || pickPool(cs.map(t => t.id)).items.length >= needOf(c) ? cs : [];
};
const randPool = c => CATS.filter(k => c.cats.includes(k)).flatMap(k => catPool(c, k));
function autoMerge(th, c) {
  const need = needOf(c);
  if (th.items.length >= need + 2) return th;
  const near = catCands(c, th.cat)
    .filter(t => t.id !== th.id)
    .sort(
      (x, y) =>
        (x.fr && x.fr === th.fr ? 0 : 1) - (y.fr && y.fr === th.fr ? 0 : 1) ||
        Math.abs((x.y0 || 0) - (th.y0 || 0)) - Math.abs((y.y0 || 0) - (th.y0 || 0))
    );
  const ids = [th.id];
  for (const t of near) {
    if (pickPool(ids).items.length >= need + 2) break;
    ids.push(t.id);
  }
  const pp = pickPool(ids);
  if (pp.ts.length === 1) return th;
  const ts = [...pp.ts].sort((x, y) => (x.y0 || 0) - (y.y0 || 0));
  const name =
    th.cat === '夢幻隊'
      ? '夢幻隊 ' + ts.map(t => t.name.slice(0, 4)).join('、')
      : ts
          .slice(0, 3)
          .map(t => t.name)
          .join(' ＋ ') + (ts.length > 3 ? ` 等 ${ts.length} 個` : '');
  return {
    id: 'mix',
    name,
    tag: `主題人數不夠，自動合併 ${ts.length} 個相近的主題（同一球員取數據最好的版本）`,
    cat: th.cat,
    items: pp.items,
    random: true
  };
}
function poolLenFor(cfg) {
  if (cfg.theme === 'random') return 0;
  if (cfg.theme === 'pick')
    return cfg.pmode === 'one' && (cfg.picks || []).length > 1 ? 0 : pickPool(cfg.picks).items.length;
  if (cfg.theme === 'custom') return parseCustom(cfg.custom.text).length;
  const t = THEMES.find(t => t.id === cfg.theme);
  return t ? t.items.length : 0;
}
function defaultDraw(cfg) {
  const need = cfg.players * (cfg.size || 5),
    L = poolLenFor(cfg);
  return L ? Math.min(L, need + 2) : need + 2;
}
/* how much of a name a card is: value plus honors and signature traits. Used to put stars into the deck. */
function starScore(p) {
  const b = (p && !p.fa && bioOf(p)) || {};
  return (
    pval(p) +
    2 * (b.mvp > 0) +
    (1.2 * Math.min(3, b.all1 || 0)) / 3 +
    0.15 * Math.min(10, b.as || 0) +
    (b.hof ? 1 : 0) +
    (sigOf(p) ? 1.5 : 0) +
    (b.fmvp ? 0.8 : 0)
  );
}
// weighted shuffle (Efraimidis–Spirakis): stars come up more often, but any card can still appear
function starShuffle(items, r = Math.random) {
  return items
    .map(p => ({ p, k: Math.pow(r(), 1 / (1 + Math.max(0, starScore(p)) / 3)) }))
    .sort((a, b) => b.k - a.k)
    .map(x => x.p);
}
const EXTRA_MAX = 3;
// a card nobody wanted is replaced by one of the best players still in the reserve, at most EXTRA_MAX times per game
/* the replacement comes up soon (one to three cards later), not at the bottom of the deck: a star parked at the end
   would only reach whoever kept spots open the longest */
function addExtra(g) {
  if ((g.extra || 0) >= EXTRA_MAX) return false;
  const used = new Set(g.items.map(p => p.n));
  const res = g.pool
    .filter(p => !used.has(p.n))
    .sort((a, b) => pubStar(b) - pubStar(a))
    .slice(0, 3);
  if (!res.length) return false;
  const p = res[Math.floor(Math.random() * res.length)],
    at = Math.min(g.items.length, g.idx + 1 + Math.floor(Math.random() * 3));
  g.items.splice(at, 0, { ...p, extra: 1 });
  g.extra = (g.extra || 0) + 1;
  return true;
}
/* deck order. The cards beyond the number of roster spots are the weakest ones (by what the card face shows) and go
   to the bottom, so nothing strong is left waiting for whoever keeps spots open. The rest is shuffled with a lean
   toward the stars: a top card is about three times as likely as the weakest to come up at any point, so stars
   usually show while everyone still has money and spots, yet any card can still turn up early or late. */
function orderDeck(picked, need) {
  const sc = p => pubStar(p),
    srt = picked.slice().sort((a, b) => sc(b) - sc(a)),
    tailN = Math.max(0, picked.length - need);
  const head = srt.slice(0, srt.length - tailN),
    tail = shuffle(srt.slice(srt.length - tailN)),
    H = head.length;
  const keyed = head.map((p, i) => ({ p, k: Math.pow(Math.random(), 1 / (1 + 2 * (H > 1 ? 1 - i / (H - 1) : 1))) }));
  return keyed
    .sort((x, y) => y.k - x.k)
    .map(x => x.p)
    .concat(tail);
}
function drawItems(items, n, k, need) {
  const pool = starShuffle(items),
    picked = [],
    used = new Set();
  for (const s of shuffle(POS)) {
    let c = picked.filter(p => posInfo(p, s).tier <= 1).length;
    for (const p of pool) {
      if (c >= k) break;
      if (used.has(p.n)) continue;
      if (posInfo(p, s).tier <= 1) {
        picked.push(p);
        used.add(p.n);
        c++;
      }
    }
  }
  for (const p of pool) {
    if (picked.length >= n) break;
    if (!used.has(p.n)) {
      picked.push(p);
      used.add(p.n);
    }
  }
  return orderDeck(picked, need || picked.length);
}
function waitingFor() {
  if (!S.last || offline()) return [];
  const on = onlineSet();
  on.add(CID);
  return sidesOf(S.cfg.players)
    .filter(k => S.seats[k] && on.has(S.seats[k].cid) && !(S.back && S.back[S.seats[k].cid]))
    .map(k => S.seats[k].name);
}
const isBack = () => !S.last || (S.back && S.back[CID]) || ui.backGid === S.last.game.gid;
const lastView = () =>
  !!(S && (S.phase === 'lobby' || S.phase === 'season') && S.last && NET.mode && !offline() && !isBack());
function withView(fn) {
  if (!lastView()) return fn();
  const g = S.game,
    sm = S.sim,
    ph = S.phase;
  S.game = S.last.game;
  S.sim = S.last.sim;
  S.phase = 'results';
  try {
    return fn();
  } finally {
    S.game = g;
    S.sim = sm;
    S.phase = ph;
  }
}
function startGame(S) {
  const c = S.cfg;
  S.err = '';
  const n = c.players,
    size = c.size === 10 ? 10 : 5,
    need = n * size;
  let th;
  const used = new Set(S.season ? S.season.used : []),
    fresh = L => {
      const f = L.filter(t => !used.has(t.id));
      return f.length ? f : L;
    };
  let baseId = null;
  if (c.theme === 'random') {
    const ok = randPool(c);
    if (!ok.length) {
      S.err = '沒有可以抽的主題：請多勾幾個類別，或放寬篩選';
      return true;
    }
    const f = fresh(ok),
      t0 = f[Math.floor(Math.random() * f.length)];
    baseId = t0.id;
    th = autoMerge(t0, c);
  } else if (c.theme === 'custom') {
    if (!CAREER) {
      S.err = '資料還在載入';
      return true;
    }
    th = {
      id: 'custom',
      name: clean(c.custom.name, 30) || '自訂主題',
      tag: '生涯巔峰 5 季',
      cat: '自訂',
      items: parseCustom(c.custom.text)
    };
  } else if (c.theme === 'pick') {
    const pp = pickPool(c.picks);
    if (!pp.ts.length) {
      S.err = '請先選主題';
      return true;
    }
    if (pp.ts.length === 1) th = pp.ts[0];
    else if (c.pmode === 'one') {
      const ok = pp.ts.filter(t => themeOk(t, c));
      if (!ok.length) {
        S.err = `選的主題都不到 ${need} 人`;
        return true;
      }
      const f = fresh(ok);
      th = f[Math.floor(Math.random() * f.length)];
      baseId = th.id;
      th = { ...th, random: true };
    } else {
      const cats = [...new Set(pp.ts.map(t => t.cat))],
        ts = [...pp.ts].sort((x, y) => (x.y0 || 0) - (y.y0 || 0)),
        usa = cats.length === 1 && cats[0] === '夢幻隊';
      const nm = usa
        ? ts.some(t => t.id === 'usaall') || ts.length >= 9
          ? '歷屆夢幻隊（全部）'
          : '夢幻隊 ' + ts.map(t => t.name.slice(0, 4)).join('、')
        : ts
            .slice(0, 4)
            .map(t => t.name)
            .join(' ＋ ') + (ts.length > 4 ? ` 等 ${ts.length} 個主題` : '');
      th = {
        id: 'mix',
        name: nm,
        tag: '多主題合併（同一球員取數據最好的那個版本）',
        cat: cats.length === 1 ? cats[0] : '混合',
        items: pp.items
      };
    }
  } else th = THEMES.find(t => t.id === c.theme);
  if (!th) {
    S.err = '找不到主題';
    return true;
  }
  if (c.budget < size) {
    S.err = `每人要標 ${size} 位，預算至少要 $${size}`;
    return true;
  }
  if (th.items.length < need) {
    S.err = `卡池只有 ${th.items.length} 位，${n} 人玩${size === 10 ? '夢幻隊模式' : ''}至少需要 ${need} 位，請多選幾個主題／年份`;
    return true;
  }
  const sides = sidesOf(n);
  if (!offline() && !sides.every(s => S.seats[s])) {
    S.err = `還要等 ${n} 位玩家都入座`;
    return true;
  }
  const w = waitingFor();
  if (w.length) {
    S.err = `還有人在看結算：${w.join('、')}`;
    return true;
  }
  const draw =
    c.theme === 'random' || th.random ? Math.min(th.items.length, need + 2) : clamp(c.draw | 0, need, th.items.length);
  const t = now();
  S.game = {
    gid: Math.random().toString(36).slice(2, 9),
    theme: {
      id: th.id,
      name: th.name,
      tag: th.tag,
      cat: th.cat || '自訂',
      random: c.theme === 'random' || !!th.random
    },
    pool: th.items,
    items: drawItems(th.items, draw, (n * size) / 5, n * size),
    extra: 0,
    idx: 0,
    sides,
    size,
    rosters: {},
    spent: {},
    bid: { who: null, amt: 0 },
    deadline: t + T_NOBID,
    pass: {},
    log: [],
    budget: c.budget,
    showStats: !!c.showStats,
    showYr: c.showYr !== false,
    ovr: c.ovr !== false,
    read: READ_OPTS.includes(c.read) ? c.read : 5,
    hints: !!c.hints,
    ready: {},
    lineupEnd: 0
  };
  sides.forEach(s => {
    S.game.rosters[s] = [];
    S.game.spent[s] = 0;
  });
  S.game.base = S.game.items.length;
  if (c.season && !S.season)
    S.season = {
      sid: Math.random().toString(36).slice(2, 8),
      n: c.season,
      bal: c.bal !== false,
      mis: !!c.mis,
      sides: sides.slice(),
      rounds: [],
      used: [],
      done: false,
      fmt0: Math.floor(Math.random() * FMT_ROT.length)
    };
  const se = S.season;
  S.game.fmt = fmtFor(S);
  S.game.nom = !!c.nom;
  if (se) {
    if (baseId) se.used.push(baseId);
    S.game.round = se.rounds.length + 1;
    S.game.rounds = se.n;
  }
  const bb = seasonBudgets(S);
  S.game.bud = bb.b;
  S.game.budAdj = bb.adj;
  S.sim = null;
  S.last = null;
  S.back = {};
  S.sready = {};
  if (c.cards) {
    S.game.cards = dealCards(S.game);
    S.game.cardEnd = t + T_CARD * (NET.mode === 'local' ? n : 1);
    S.phase = 'cards';
    return true;
  }
  prepNext(S);
  return true;
}
function beginAuction(S) {
  const g = S.game;
  S.phase = 'auction';
  if (!window.BB_FAST) g.gapEnd = now() + 1300;
  startCard(S);
} // the first card waits for the 競標開始 title to clear
function autoPick(g, s) {
  const M = g.mis[s];
  if (M.pick != null) return;
  const i = M.opts.findIndex(x => x.tier === 2);
  M.pick = i >= 0 ? i : 0;
  M.auto = 1;
}
function finish(S) {
  const g = S.game;
  g.sides.forEach(s => benchFix(g, s));
  g.misRes = misFinal(g);
  S.sim = simulate(S);
  S.phase = 'results';
  const ch = S.sim.champ;
  if (ch) {
    const k = scoreKey(S, ch);
    const o = S.scores[k] || { n: nm(S, ch), w: 0 };
    o.n = nm(S, ch);
    o.w++;
    S.scores[k] = o;
  }
  seasonRecord(S);
}
/* bidding order: 2 players alternate who opens each card (A,B,A,B…);
   3 players use a snake: A,B,C then C,B,A then A,B,C… Inside a card the turn keeps cycling in that direction. */
function cardOrder(g) {
  const sd = g.sides,
    N = sd.length,
    k = g.idx;
  if (N === 2) {
    const st = k % 2;
    return [sd[st], sd[1 - st]];
  }
  const seq = Math.floor(k / N) % 2 === 0 ? sd.slice() : sd.slice().reverse(),
    p = k % N;
  return seq.slice(p).concat(seq.slice(0, p));
}
const canAct = (g, s) => openN(g, s) > 0 && !g.pass[s] && g.bid.who !== s && maxBid(g, s) > g.bid.amt;
function advance(S) {
  const g = S.game,
    o = g.order || g.sides,
    n = o.length;
  let i = o.indexOf(g.turn);
  if (i < 0) i = n - 1;
  for (let k = 1; k <= n; k++) {
    const s = o[(i + k) % n];
    if (canAct(g, s)) {
      g.turn = s;
      g.deadline = t0(g) + (g.bid.who ? T_BID : T_NOBID);
      return;
    }
  }
  g.turn = null;
  if (g.bid.who) sell(S, g.bid.who, g.bid.amt);
  else skipCard(S);
}
function startCard(S) {
  const g = S.game;
  g.bid = { who: null, amt: 0 };
  g.pass = {};
  g.order = cardOrder(g);
  g.turn = null;
  const so = soloOf(g);
  if (so && (!g.solo || g.solo.who !== so)) g.solo = { who: so };
  if (fmtStart(S)) return;
  advance(S);
}
/* deck runs out: free agents fill whatever is left (see addExtra for passed cards) */
const FA = {
  obpm: -2,
  dbpm: -0.5,
  usg: 16,
  astp: 12,
  trbp: 10,
  blkp: 1,
  stlp: 1.5,
  mp: 18,
  g: 60,
  pts: 6,
  trb: 3,
  ast: 1,
  stl: 0.5,
  blk: 0.3,
  tov: 0.9
};
function fillFA(g) {
  g.sides.forEach(s =>
    openSlots(g, s).forEach(x => {
      const i = isBench(x) ? 3 : POS.indexOf(x) + 1;
      g.items.push({
        ...FA,
        n: `自由球員（${slotLab(x)}）`,
        pos: isBench(x) ? '' : x,
        pe: i,
        lo: isBench(x) ? 1 : i,
        hi: isBench(x) ? 5 : i,
        fa: 1
      });
      const k = g.items.length - 1;
      g.rosters[s].push({ slot: x, k, price: 0 });
      g.log.push({ n: g.items[k].n, who: s, amt: 0, slot: x, fa: 1 });
    })
  );
  g.sides.forEach(s => autoPlace(g, s));
}
function nextCard(S) {
  const g = S.game;
  g.gapEnd = now() + gapMs(g);
  g.idx++;
  g.bid = { who: null, amt: 0 };
  g.pass = {};
  g.turn = null;
  if (!g.sides.every(s => openN(g, s) === 0) && g.idx >= g.items.length) fillFA(g); // deck (plus at most 3 extra cards) is used up: free agents fill the rest
  if (isOver(g)) {
    g.sides.forEach(s => benchFix(g, s));
    S.phase = 'lineup';
    g.ready = {};
    g.lineupEnd = now() + T_LINEUP * (g.size === 10 ? 4 / 3 : 1);
    return;
  }
  startCard(S);
}
/* a short authoritative pause after each card so everyone sees the result (SOLD stamp, sealed-bid reveal) before the
   next card's clock starts; actions inside the pause are ignored */
const gapMs = g => {
  if (window.BB_FAST) return 0;
  const v = g.reveal && g.reveal.idx === g.idx ? g.reveal : null,
    sold = g.log.length && g.log[g.log.length - 1].who;
  return v && v.win && !v.grab ? 3600 : sold ? 2800 : 1400;
}; // sealed reveal (bars, then the winner) / any sale / a pass
/* reading time: after the pause, each new card is shown with its clock stopped for a few seconds (lobby: 看牌時間) so
   people can take in the card before anyone may bid; bots wait it out too. Everyone still bidding can end it early. */
const READ_OPTS = [0, 3, 5, 8],
  readMs = g => (window.BB_FAST ? 0 : (g.read == null ? 5 : g.read) * 1000);
const t0 = g => Math.max(now(), g.gapEnd || 0, g.readEnd || 0),
  inGap = g => now() < Math.max(g.gapEnd || 0, g.readEnd || 0) - 200,
  inPause = g => now() < (g.gapEnd || 0) - 200,
  inRead = g => now() < (g.readEnd || 0) - 200;
function readDone(S, who, all) {
  const g = S.game;
  if (S.phase !== 'auction' || !inRead(g)) return false;
  g.rd = g.rd || {};
  g.rd[who] = 1;
  const need = g.sides.filter(
    s =>
      !(typeof isBot === 'function' && isBot(s)) &&
      openN(g, s) > 0 &&
      !(g.stage === 'left' && g.solo && g.solo.who !== s)
  );
  if (!all && !need.every(s => g.rd[s])) return true;
  const d = Math.max(0, g.readEnd - Math.max(now(), g.gapEnd || 0));
  ['deadline', 'openAt'].forEach(k => {
    if (g[k]) g[k] -= d;
  });
  g.readEnd = Math.max(now(), g.gapEnd || 0);
  return true;
}
// a won card goes straight onto the roster (see autoPlace); every card ends here or in skipCard
function sell(S, who, amt) {
  const g = S.game;
  g.turn = null;
  const pay = couponPay(g, who, amt);
  g.rosters[who].push({ slot: null, k: g.idx, price: pay });
  g.spent[who] += pay;
  autoPlace(g, who);
  g.log.push({ n: cur(g).n, who, amt: pay, slot: placeNote(g, who, g.idx), ...(pay < amt ? { full: amt } : {}) });
  nextCard(S);
}
function skipCard(S) {
  const g = S.game;
  g.log.push({ n: cur(g).n, who: null });
  if (g.sides.some(s => openN(g, s) > 0)) addExtra(g);
  nextCard(S);
}
/* timers run only on the device that owns the game state */
function tickAuth() {
  if (!S || !S.game || !(offline() || NET.mode === 'host')) return;
  const g = S.game,
    t = now();
  let changed = false;
  // seated players who dropped offline are auto-passed so the game keeps moving
  const off = new Set();
  if (NET.mode === 'host' && NET.joinedAt && Date.now() - NET.joinedAt > 15000) {
    const on = onlineSet();
    g.sides.forEach(s => {
      const c = S.seats[s] && S.seats[s].cid;
      if (c && c !== CID && !on.has(c)) off.add(s);
    });
  }
  if (S.phase === 'auction' && off.size) {
    if (!inGap(g) && !fmtBusy(g)) {
      for (const s of off)
        if (openN(g, s) > 0 && !g.pass[s] && g.bid.who !== s) {
          g.pass[s] = true;
          changed = true;
        }
      if (changed && (!g.turn || g.pass[g.turn])) advance(S);
    }
  }
  if (S.phase === 'cards' && g.cards) {
    g.sides.forEach(s => {
      if (!g.cards[s].pick && (off.has(s) || t > g.cardEnd)) {
        autoCards(g, s);
        changed = true;
      }
    });
    if (changed && g.sides.every(s => g.cards[s].pick)) prepNext(S);
  }
  if (S.phase === 'mission' && g.mis) {
    g.sides.forEach(s => {
      if (g.mis[s].pick == null && (off.has(s) || t > g.misEnd)) {
        autoPick(g, s);
        changed = true;
      }
    });
    if (changed && g.sides.every(s => g.mis[s].pick != null)) beginAuction(S);
  }
  if (S.phase === 'lineup' && off.size) {
    for (const s of off)
      if (!g.ready[s]) {
        g.ready[s] = true;
        changed = true;
      }
    if (changed && g.sides.every(s => g.ready[s])) {
      finish(S);
    }
  }
  if (S.phase === 'auction') {
    if (inGap(g)) {
      // the sold card is still on screen: no clock runs
    } else if (fmtBusy(g)) {
      if (fmtTick(S, off)) changed = true;
    } else if (t > g.deadline) {
      if (g.turn) g.pass[g.turn] = true;
      advance(S);
      changed = true;
    }
  } else if (S.phase === 'lineup' && t > g.lineupEnd) {
    finish(S);
    changed = true;
  }
  if (changed) {
    fx(snapPrev);
    commit();
  }
}
function apply(S, a, actor) {
  const r = actor.role,
    g = S.game;
  if (!a || typeof a.a !== 'string') return false;
  const who = r === 'all' ? a.who : r;
  const isP = r === 'all' || ALL.includes(r);
  switch (a.a) {
    case 'seat': {
      if (offline() || S.phase !== 'lobby' || S.season) return false;
      const seat = a.seat;
      if (![...ALL, 'spec'].includes(seat)) return false;
      if (seat !== 'spec' && S.seats[seat] && S.seats[seat].cid !== actor.cid) return false;
      for (const k of ALL) if (S.seats[k] && S.seats[k].cid === actor.cid && k !== seat) S.seats[k] = null;
      if (seat !== 'spec') S.seats[seat] = { cid: actor.cid, name: clean(a.name) || '無名氏' };
      return true;
    }
    case 'aist': {
      if (
        NET.mode !== 'ai' ||
        S.phase !== 'lobby' ||
        S.season ||
        !S.bots ||
        !S.bots[a.s] ||
        !(own(BOT_STYLE, a.v) || a.v === 'rand' || a.v === 'mix')
      )
        return false;
      const B = S.bots[a.s];
      B.st = a.v;
      delete B.play;
      delete B.mix;
      aiAssign(S);
      return true;
    }
    case 'ailv': {
      if (NET.mode !== 'ai' || S.phase !== 'lobby' || S.season || !own(BOT_LV, a.v)) return false;
      S.botLv = a.v;
      return true;
    }
    case 'names': {
      if (!offline() || S.season) return false;
      ALL.forEach(s => {
        if (a[s] != null && !(S.bots && S.bots[s])) S.names[s] = clean(a[s]) || '玩家 ' + s;
      });
      return true;
    }
    case 'cfg': {
      if (!isP || S.phase !== 'lobby' || !a.cfg || S.season) return false;
      const c = S.cfg,
        n = a.cfg;
      if (n.fmt != null && (own(FMTS, n.fmt) || n.fmt === 'rotate')) c.fmt = n.fmt;
      if (n.nom != null) c.nom = !!n.nom;
      if (n.mis != null) c.mis = !!n.mis;
      if (n.showYr != null) c.showYr = !!n.showYr;
      if (n.ovr != null) c.ovr = !!n.ovr;
      if (n.read != null && READ_OPTS.includes(n.read | 0)) c.read = n.read | 0;
      if (n.cards != null) c.cards = !!n.cards;
      if (n.season != null) c.season = SEASON_N.includes(n.season) ? n.season : 0;
      if (n.bal != null) c.bal = !!n.bal;
      if (n.players === 2 || n.players === 3) {
        c.players = n.players;
        if (n.players === 2 && S.seats.C && NET.mode !== 'local') S.seats.C = null;
      }
      if (n.budget != null) c.budget = clamp(n.budget | 0, 5, 999);
      if (
        typeof n.theme === 'string' &&
        (['random', 'custom', 'pick'].includes(n.theme) || THEMES.some(t => t.id === n.theme))
      )
        c.theme = n.theme;
      if ('era' in n)
        c.era =
          Array.isArray(n.era) && n.era.length === 2 && n.era.every(x => DECS.includes(x))
            ? [Math.min(...n.era), Math.max(...n.era)]
            : null;
      if (Array.isArray(n.teams)) c.teams = [...new Set(n.teams.filter(k => own(FRZH, k)))].slice(0, 30);
      if (n.size === 5 || n.size === 10) {
        if (n.size === 10 && c.size !== 10 && c.budget < 25) c.budget = 25;
        if (n.size === 5 && c.size === 10 && c.budget === 25) c.budget = 15;
        c.size = n.size;
      }
      if (Array.isArray(n.picks))
        c.picks = [...new Set(n.picks.filter(id => typeof id === 'string' && THEMES.some(t => t.id === id)))].slice(
          0,
          12
        );
      if (typeof n.pcat === 'string' && CATS.includes(n.pcat)) c.pcat = n.pcat;
      if (n.pmode === 'merge' || n.pmode === 'one') c.pmode = n.pmode;
      if (Array.isArray(n.cats)) c.cats = n.cats.filter(x => CATS.includes(x));
      if (n.custom) c.custom = { name: clean(n.custom.name, 30), text: String(n.custom.text || '').slice(0, 1500) };
      if (n.showStats != null) c.showStats = !!n.showStats;
      if (n.hints != null) c.hints = !!n.hints;
      if (n.draw != null) c.draw = n.draw | 0;
      else if (n.theme || n.players || n.custom || n.picks || n.size) c.draw = defaultDraw(c);
      const L = poolLenFor(c),
        need = c.players * (c.size || 5);
      if (L) c.draw = clamp(c.draw, Math.min(need, L), L);
      S.err = '';
      S.by = actor.cid;
      return true;
    }
    case 'start': {
      if (!isP || !((S.phase === 'lobby' && !S.season) || (S.phase === 'season' && S.season && !S.season.done)))
        return false;
      if (NET.mode === 'ai') aiAssign(S);
      return startGame(S);
    }
    case 'sready': {
      if (
        S.phase !== 'season' ||
        !S.season ||
        S.season.done ||
        offline() ||
        !ALL.includes(r) ||
        !S.season.sides.includes(r)
      )
        return false;
      S.sready = S.sready || {};
      S.sready[r] = !!a.v;
      if (S.season.sides.every(x => S.sready[x]) && !waitingFor().length) return startGame(S) || true;
      return true;
    }
    case 'card': {
      if (!g || !g.sides.includes(who)) return false;
      return useCard(S, who, a);
    }
    case 'rdone': {
      if (!g || !g.sides.includes(who)) return false;
      return readDone(S, who, r === 'all' && NET.mode === 'local');
    }
    case 'mpick': {
      if (S.phase !== 'mission' || !g || !g.mis || !g.sides.includes(who)) return false;
      const M = g.mis[who],
        i = a.i | 0;
      if (i < 0 || i >= M.opts.length) return false;
      M.pick = i;
      M.auto = 0;
      if (g.sides.every(s => g.mis[s].pick != null)) beginAuction(S);
      return true;
    }
    case 'endSeason': {
      if (!isP || S.phase !== 'season' || !S.season || S.season.done) return false;
      if (!S.season.rounds.length) {
        S.season = null;
        S.phase = 'lobby';
        return true;
      }
      seasonEnd(S);
      return true;
    }
    case 'closeSeason': {
      if (!isP || S.phase !== 'season' || !S.season || !S.season.done) return false;
      S.lastSeason = S.season;
      S.season = null;
      S.phase = 'lobby';
      return true;
    }
    case 'nominate':
    case 'sbid':
    case 'grab':
    case 'spass':
    case 'lpick':
    case 'lnone':
      return g.sides.includes(who) ? fmtApply(S, a, who) : false;
    case 'bid': {
      if (S.phase !== 'auction' || inGap(g) || !g.sides.includes(who) || fmtBusy(g)) return false;
      if (a.idx != null && a.idx !== g.idx) return false;
      const amt = a.amt | 0;
      if (g.turn !== who || g.pass[who] || g.bid.who === who || amt <= g.bid.amt || amt < 1 || amt > maxBid(g, who))
        return false;
      g.bid = { who, amt };
      if (eligible(g).length === 1) sell(S, who, amt);
      else advance(S);
      return true;
    }
    case 'pass': {
      if (S.phase !== 'auction' || inGap(g) || !g.sides.includes(who) || g.bid.who === who || g.pass[who] || fmtBusy(g))
        return false;
      if (a.idx != null && a.idx !== g.idx) return false;
      g.pass[who] = true;
      if (g.turn === who || !g.turn) advance(S);
      return true;
    }
    case 'tac': {
      if (S.phase !== 'lineup' || !g.sides.includes(who) || g.ready[who]) return false;
      const k = a.k,
        v = a.v;
      if (!(k === 'o' && TAC_O[v]) && !(k === 'd' && TAC_D[v])) return false;
      g.tac = g.tac || {};
      const cur = tacOf(g, who);
      g.tac[who] = { o: cur.o, d: cur.d, [k]: v };
      return true;
    }
    case 'swap': {
      if (S.phase !== 'lineup' || !g.sides.includes(who) || g.ready[who]) return false;
      const R = g.rosters[who],
        x = R.find(q => q.slot === a.x),
        y = R.find(q => q.slot === a.y);
      if (!x || !y || x === y) return false;
      [x.slot, y.slot] = [y.slot, x.slot];
      [x.role, y.role] = [y.role, x.role];
      return true;
    }
    case 'brole': {
      if (S.phase !== 'lineup' || !g.sides.includes(who) || g.ready[who] || !own(BROLE, a.role)) return false;
      const R = g.rosters[who],
        e = R.find(q => q.slot === a.slot && isBench(q.slot));
      if (!e) return false;
      if (a.role === 'X')
        R.forEach(q => {
          if (q !== e && q.role === 'X') q.role = natRole(g.items[q.k]);
        });
      e.role = a.role;
      return true;
    }
    case 'ready': {
      if (S.phase !== 'lineup' || !g.sides.includes(who)) return false;
      if (a.v && !benchOK(g, who)) return false;
      g.ready[who] = !!a.v;
      if (g.sides.every(s => g.ready[s])) finish(S);
      return true;
    }
    case 'again': {
      if (!isP) return false;
      // the first player back keeps the finished game in S.last so the others can keep watching it
      if (S.phase === 'results') {
        S.last = { game: S.game, sim: S.sim };
        S.phase = S.season ? 'season' : 'lobby';
        S.game = null;
        S.sim = null;
        S.back = {};
      } else if (!((S.phase === 'lobby' || S.phase === 'season') && S.last)) return false;
      if (r === 'all' || offline()) {
        S.last = null;
        S.back = {};
        return true;
      }
      S.back = S.back || {};
      S.back[actor.cid] = 1;
      return true;
    }
    case 'quit': {
      if (!isP || S.phase === 'lobby' || S.phase === 'season') return false;
      S.phase = S.season ? 'season' : 'lobby';
      S.game = null;
      S.sim = null;
      S.last = null;
      S.back = {};
      return true;
    }
    case 'resetScores': {
      if (!isP) return false;
      S.scores = {};
      return true;
    }
  }
  return false;
}
