/* ---------- game-by-game playback ----------
 Built on each device from S.sim with seeded randomness, so every player sees the same games
 without sending anything extra over the network. Final scores and series results are the simulation's own. */
let pbCache = { gid: null, d: null };
const lastN_ = p =>
  String(p.n || '')
    .split(' ')
    .slice(-1)[0];
const callN = (p, r) => {
  const k = nickOf(p);
  return k && r() < 0.5 ? k.split('・')[0] : lastN_(p);
};
function splitInt(total, parts, r, sd = 0.18) {
  const w = [...Array(parts)].map(() => Math.max(0.4, 1 + gauss(r) * sd));
  return alloc(total, w);
}
function periods(sa, sb, ot, r) {
  const oa = [],
    ob = [];
  for (let i = 0; i < ot; i++) {
    if (i < ot - 1) {
      const x = 4 + Math.floor(r() * 8);
      oa.push(x);
      ob.push(x);
    } else {
      const lo = 4 + Math.floor(r() * 7),
        d = Math.abs(sa - sb);
      oa.push(sa > sb ? lo + d : lo);
      ob.push(sb > sa ? lo + d : lo);
    }
  }
  const ra = sa - oa.reduce((t, x) => t + x, 0),
    rb = sb - ob.reduce((t, x) => t + x, 0);
  return [splitInt(ra, 4, r).concat(oa), splitInt(rb, 4, r).concat(ob)];
}
function styleOf(p) {
  const b = bioOf(p),
    f = String((b && b.sk) || ''),
    pe = peOf(p);
  return {
    three: f.includes('3') || spc(p) >= 0.5,
    mid: f.includes('m'),
    rim: f.includes('r'),
    big: pe >= 4,
    guard: pe <= 2.5,
    pass: num(p.astp, 0) >= 25,
    blk: num(p.blkp, 0) >= 3.5,
    stl: num(p.stlp, 0) >= 2.2,
    star: num(p.obpm, 0) + num(p.dbpm, 0) >= 5
  };
}
function pickW(arr, w, r) {
  const W = w.reduce((a, b) => a + b, 0);
  let x = r() * W;
  for (let i = 0; i < arr.length; i++) {
    x -= w[i];
    if (x <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}
const PICK = (a, r) => a[Math.floor(r() * a.length)];
const KTXT = {
  three: ['{n} 底角三分，刷！', '{n} 接球就投，三分入網', '{n} 運球拉開，三分命中！', '{n} 頂著防守投進三分'],
  logo: ['{n} 中場 Logo 超遠三分！全場沸騰'],
  mid: ['{n} 後仰中距離，進！', '{n} 急停跳投命中', '{n} 罰球線跳投得手', '{n} 轉身後仰，空心入網'],
  rim: ['{n} 一步過人直搗籃下', '{n} 歐洲步上籃得手', '{n} 切入拋投進球'],
  and1: ['{n} 切入硬擠，打進還加罰！'],
  dunk: ['{n} 雙手暴扣！', '{n} 單手戰斧劈扣！', '{n} 隔人爆扣！籃框還在晃'],
  post: ['{n} 禁區轉身強攻得手', '{n} 背框單打，勾射進球', '{n} 夢幻腳步晃開防守'],
  putback: ['{n} 搶下進攻籃板補進', '{n} 補籃得手'],
  ankle: ['{n} 一記變向把防守者晃倒 😵 輕鬆上籃'],
  alley: ['{a} 拋出空中接力，{n} 接球灌籃！'],
  assist: ['{a} 不看人妙傳，{n} 輕鬆得分', '{a} 精準長傳，{n} 快攻上籃'],
  block: ['{n} 送出大火鍋！', '{n} 把球搧到場邊！'],
  steal: ['{n} 抄截，一路快攻！', '{n} 預判傳球路線，抄截成功']
};
const KPTS = {
  three: 3,
  logo: 3,
  and1: 3,
  mid: 2,
  rim: 2,
  dunk: 2,
  post: 2,
  putback: 2,
  ankle: 2,
  alley: 2,
  assist: 2,
  block: 0,
  steal: 0
};
const KICO = {
  boom: '💥',
  takeover: '👑',
  tac: '📋',
  three: '🎯',
  logo: '🎯',
  mid: '🏀',
  rim: '🏀',
  and1: '💪',
  dunk: '💥',
  post: '🏀',
  putback: '🏀',
  ankle: '😵',
  alley: '🚀',
  assist: '🤝',
  block: '🚫',
  steal: '🧤',
  timeout: '⏸',
  run: '🔥',
  hot: '🔥',
  tech: '😤',
  ot: '⏱',
  clutch: '🏆',
  rest: '🪑',
  foul: '⚠️',
  foulout: '❌',
  eject: '🟥'
};
/* signature traits of well-known stars (from widely cited "signature moves" lists and highlights).
   They change how a play is shown and nudge which play type a player picks; how often they happen is still
   tied to his numbers: chase-down blocks scale with block rate, swats only replace blocks the stats produce,
   clutch shooters get a bigger share of game-winners. */
const SIG = {
  jamesle01: { lab: '追魂鍋', chase: 1 },
  wadedw01: { lab: '閃電切入', chase: 1, k: { rim: ['{n} 閃電切入，空中換手上籃'] } },
  pippesc01: { lab: '全能防守', chase: 1, stl: ['{n} 長臂抄截，一路快攻'] },
  wembavi01: {
    lab: '長臂封阻',
    kl: { three: '外星人三分' },
    swat: ['{n} 長臂一揮，把切入的上籃直接搧飛！', '外星人 {n} 的臂展太誇張，上籃被搧到場邊'],
    k: { three: ['{n} 7 呎 4 的高度投三分，根本蓋不到'] }
  },
  mutomdi01: { lab: '搖手指', swat: ['{n} 大火鍋！還對對手搖搖手指 ☝️'] },
  howardw01: {
    lab: '超人灌籃',
    sl: '超人封阻',
    k: { dunk: ['{n} 超人起飛，雙手暴扣！'] },
    swat: ['{n} 從籃下飛出來，把球搧出界']
  },
  wallabe01: { lab: '大本鐘', swat: ['{n} 大火鍋！大本鐘響了 🔔'] },
  robinda01: { lab: '海軍上將', swat: ['{n} 海軍上將補防，把上籃蓋掉'] },
  garneke01: { lab: '狼王怒吼', swat: ['{n} 火鍋之後對著籃框怒吼'] },
  olajuha01: {
    lab: '夢幻舞步',
    sl: '歷史火鍋王',
    k: { post: ['{n} 夢幻舞步晃翻防守，輕鬆放進'], mid: ['{n} 夢幻舞步接後仰跳投'] },
    swat: ['{n} 退回禁區把上籃蓋掉']
  },
  abdulka01: { lab: '天勾', k: { post: ['{n} 招牌天勾，沒人蓋得到'], mid: ['{n} 招牌天勾，空心入網'] } },
  nowitdi01: {
    lab: '金雞獨立',
    k: { mid: ['{n} 金雞獨立後仰跳投，進！'], post: ['{n} 背框單腳後仰，籃框都沒碰到'] },
    clutch: 1
  },
  jordami01: {
    lab: '後仰跳投',
    kl: { dunk: '罰球線灌籃' },
    k: { mid: ['{n} 招牌後仰跳投，防守再好也沒用'], dunk: ['{n} 罰球線起跳，空中飛人灌籃！'] },
    clutch: 1
  },
  bryanko01: {
    lab: '曼巴後仰',
    k: { mid: ['{n} 曼巴式後仰跳投，被包夾照樣進'], three: ['{n} 高難度後仰三分'] },
    clutch: 1
  },
  lillada01: {
    lab: 'Dame Time',
    k: { three: ['{n} 超遠距離三分，指著手腕 ⌚'], logo: ['{n} Logo 三分！Dame Time ⌚'] },
    clutch: 1,
    ctxt: 'Dame Time！⌚ {n} 超遠三分殺死比賽'
  },
  curryst01: {
    lab: 'Logo 三分',
    kl: { three: '超遠三分' },
    k: {
      three: ['{n} 運球晃開，超遠三分刷網', '{n} 球還沒進就轉身慶祝，Night Night 😴'],
      logo: ['{n} 中場 Logo 附近出手——刷！']
    },
    clutch: 1
  },
  iversal01: {
    lab: 'Crossover',
    k: { ankle: ['{n} 招牌 crossover 把防守者晃倒，還跨過去 😏'], rim: ['{n} 胯下運球加速，撞進人群上籃'] }
  },
  hardeja01: {
    lab: '後撤步三分',
    kl: { rim: '歐洲步' },
    k: { three: ['{n} 招牌後撤步三分！'], rim: ['{n} 歐洲步騙過防守，上籃得手'] }
  },
  ginobma01: { lab: '歐洲步', k: { rim: ['{n} 招牌歐洲步，閃過兩個人上籃'], and1: ['{n} 歐洲步硬切，打進還加罰！'] } },
  duncati01: { lab: '擦板跳投', k: { mid: ['{n} 招牌 45 度擦板跳投'], post: ['{n} 低位轉身擦板進球'] } },
  jokicni01: {
    lab: 'Sombor Shuffle',
    kl: { post: '背框單打' },
    pl: '不看人妙傳',
    k: { mid: ['{n} 單腳後仰 Sombor Shuffle，進！'], post: ['{n} 背框慢慢磨，轉身放進'] },
    pass: ['{a} 不看人背後傳球，{n} 空檔得分', '{a} 全場長傳妙傳，{n} 快攻上籃']
  },
  johnsma02: {
    lab: '不看人傳球',
    kl: { post: '小天勾' },
    k: { post: ['{n} 招牌小天勾！'] },
    pass: ['{a} 不看人傳球，{n} 快攻得分', '{a} 魔術般的妙傳，{n} 輕鬆上籃']
  },
  nashst01: { lab: '穿針引線', pass: ['{a} 鑽進禁區再穿針引線，{n} 輕鬆得分'] },
  stockjo01: { lab: '經典擋拆', pass: ['{a} 經典擋拆，把球塞給 {n} 輕鬆得分'] },
  paulch01: {
    lab: '控衛之神',
    kl: { mid: '罰球線中距離' },
    pass: ['{a} 擋拆後擊地傳球，{n} 接球得分'],
    k: { mid: ['{n} 招牌罰球線中距離'] }
  },
  malonka01: {
    lab: '擋拆順下',
    kl: { post: '低位背打' },
    k: { mid: ['{n} 擋拆後接球中距離，郵差送達 📮'], post: ['{n} 背打轉身強硬得分'] }
  },
  onealsh01: {
    lab: '大鯊魚灌籃',
    k: {
      dunk: ['{n} 背框轉身暴扣，籃架都在晃！', '{n} 雙手暴扣，差點把籃框扯下來'],
      post: ['{n} 低位硬頂進禁區，強吃得分']
    }
  },
  cartevi01: { lab: '飛人灌籃', k: { dunk: ['{n} 起跳越過防守者，半人半神暴扣！'] } },
  antetgi01: { lab: '歐洲步暴扣', k: { dunk: ['{n} 三分線起步，兩步就到籃下暴扣！'], rim: ['{n} 歐洲步長驅直入'] } },
  leonaka01: {
    lab: '大手抄截',
    kl: { mid: '後仰跳投' },
    stl: ['{n} 大手一伸，直接把球摸走'],
    k: { mid: ['{n} 底角後仰跳投——彈框四下，進了！'] },
    clutch: 1
  },
  allenra02: {
    lab: '底角三分',
    k: { three: ['{n} 底角三分，教科書般的投籃'] },
    clutch: 1,
    ctxt: '{n} 退到底角接球——三分進！救命一擊'
  },
  millere01: { lab: 'Miller Time', k: { three: ['{n} 連續三分，還對觀眾比割喉手勢'] }, clutch: 1 },
  horryro01: { lab: '關鍵先生', clutch: 1, ctxt: '關鍵先生 {n} 接球出手，致勝三分！' },
  irvinky01: {
    lab: '魔術運球',
    k: { rim: ['{n} 魔術般運球，打板挑籃進'], ankle: ['{n} 連續胯下，晃倒防守者'] },
    clutch: 1
  },
  duranke01: { lab: '死神跳投', k: { mid: ['{n} 7 呎身高急停跳投，誰都蓋不到'] } },
  westbru01: { lab: '全速推進', k: { dunk: ['{n} 全速推進，一路衝刺暴扣！'], rim: ['{n} 坦克式衝刺上籃'] } },
  thompkl01: { lab: '手感爆發', k: { three: ['{n} 接球就投，三分連發'] } },
  butleji01: { lab: 'Playoff Jimmy', clutch: 1 },
  rodmade01: { lab: '籃板蟲', k: { putback: ['{n} 拼命搶下進攻籃板，補進'] } }
};
// shared trait: the league's famous tomahawk / power dunkers (from all-time best-dunker lists: Wilkins, Carter, Dr. J, Kemp, Drexler...)
const TOMA = new Set([
  'jamesle01',
  'cartevi01',
  'wilkido01',
  'ervinju01',
  'kempsh01',
  'drexlcl01',
  'thompda01',
  'mcgratr01',
  'griffbl01',
  'moranja01',
  'westbru01',
  'edwaran01',
  'willizi01',
  'lavinza01',
  'richaja01',
  'smithjo03'
]);
const TOMA_TXT = [
  '{n} 高高舉起單手，戰斧暴扣！',
  '{n} 空中把球拉到腦後，戰斧式重扣，籃框還在晃 🪓',
  '{n} 衝進禁區起飛，頂著防守者戰斧暴扣！',
  '{n} 快攻一路殺到底，戰斧劈扣，全場起立 🪓'
];
const sigOf = p => (p && own(SIG, p.id) ? SIG[p.id] : null);
// movement shooters: they run off screens for their threes
const MOVERS = new Set([
  'curryst01',
  'thompkl01',
  'allenra02',
  'millere01',
  'redicjj01',
  'korveky01',
  'hamilri01',
  'robindu01'
]);
const OFFBALL_TXT = [
  '{n} 無球跑動，繞過兩道掩護，接球三分刷！',
  '{n} 從底線一路跑到側翼，接球就投，進！',
  '{n} 繞掩護甩開防守，空檔三分！'
];
function sigText(p, kind, a, r) {
  const g = sigOf(p);
  if (g && g.k && g.k[kind] && r() < 0.85)
    return { txt: fill(PICK(g.k[kind], r), p, a, r), sig: (g.kl && g.kl[kind]) || g.lab, sp: p.n, sid: p.id };
  const ga = sigOf(a);
  if (a && ga && ga.pass && (kind === 'assist' || kind === 'alley') && r() < 0.8)
    return { txt: fill(PICK(ga.pass, r), p, a, r), sig: ga.pl || ga.lab, sp: a.n, sid: a.id };
  return { txt: fill(PICK(KTXT[kind], r), p, a, r) };
}
const SIGICO = {
  jamesle01: '👑',
  wadedw01: '⚡',
  pippesc01: '🦇',
  wembavi01: '👽',
  mutomdi01: '☝️',
  howardw01: '🦸',
  wallabe01: '🔔',
  robinda01: '⚓',
  garneke01: '🐺',
  olajuha01: '🌀',
  abdulka01: '🪝',
  nowitdi01: '🦩',
  jordami01: '🐐',
  bryanko01: '🐍',
  lillada01: '⌚',
  curryst01: '😴',
  iversal01: '😵',
  hardeja01: '🧔',
  ginobma01: '🔀',
  duncati01: '🪨',
  jokicni01: '🃏',
  johnsma02: '🪄',
  nashst01: '🧵',
  stockjo01: '🤝',
  paulch01: '🧠',
  malonka01: '📮',
  onealsh01: '🦈',
  cartevi01: '🚀',
  antetgi01: '🦌',
  leonaka01: '🤖',
  allenra02: '🍬',
  millere01: '🔪',
  horryro01: '🎯',
  irvinky01: '🪄',
  duranke01: '💀',
  westbru01: '🏎️',
  thompkl01: '🔥',
  butleji01: '😤',
  rodmade01: '🪱'
};
function offKind(p, mates, r, tac) {
  const st = styleOf(p),
    c = [],
    w = [];
  const add = (k, x) => {
    const i = c.indexOf(k);
    if (i >= 0) w[i] += x;
    else {
      c.push(k);
      w.push(x);
    }
  };
  add(st.big ? 'post' : 'rim', 2);
  if (st.three) add('three', st.big ? 2 : 4);
  if (st.mid) add('mid', 3);
  add('mid', 1);
  if (st.rim) add('and1', 1.2);
  if (st.big || st.rim) add('dunk', st.big ? 2 : 1.2);
  if (st.big) add('putback', 1);
  if (st.guard) add('ankle', 0.35);
  if (st.three && st.star) add('logo', 0.15);
  if (TOMA.has(p.id)) {
    const i = c.indexOf('dunk');
    if (i >= 0) w[i] *= 2;
    else add('dunk', 1.5);
  }
  const g = sigOf(p);
  if (g && g.k)
    Object.keys(g.k).forEach(k => {
      const i = c.indexOf(k);
      if (i >= 0) w[i] *= 3;
      else if (k === 'logo' && st.three) add('logo', 0.7);
    });
  // the team's offense shapes the shot diet: five-out lives at the arc, inside-out in the paint, the break at the rim
  const TW = {
    five: { three: 1.8, logo: 1.5, post: 0.5 },
    post: { post: 2, putback: 2, three: 0.6 },
    run: { dunk: 1.6, rim: 1.4, and1: 1.2 }
  }[tac];
  if (TW)
    c.forEach((x, i) => {
      if (TW[x]) w[i] *= TW[x];
    });
  const k = pickW(c, w, r),
    passers = mates.filter(q => q !== p && styleOf(q).pass);
  if (passers.length && k !== 'putback' && k !== 'ankle' && k !== 'logo' && r() < (tac === 'motion' ? 0.55 : 0.3)) {
    const a = PICK(passers, r);
    return { k: (k === 'dunk' || k === 'rim') && r() < 0.5 ? 'alley' : k === 'three' ? 'three' : 'assist', a };
  }
  return { k, a: null };
}
function fill(t, p, a, r) {
  return t.replace('{n}', callN(p, r)).replace('{a}', a ? callN(a, r) : '');
}
function gameEvents(z, game, boxA, boxB, R, r, inc, bo, tk, tgm) {
  inc = inc || [];
  bo = bo || {};
  tk = tk || {};
  const TO = s => (z.tac && z.tac[s] ? z.tac[s].o : null),
    TDf = s => (z.tac && z.tac[s] ? z.tac[s].d : null);
  const [sa, sb, ot] = game,
    [qa, qb] = game.q,
    P = qa.length,
    ev = [];
  const teams = { [z.a]: { box: boxA, R: R[z.a] }, [z.b]: { box: boxB, R: R[z.b] } },
    other = s => (s === z.a ? z.b : z.a),
    tn = s => nm(S, s);
  const ptsOf = (T, x) => {
    const b = T.box.find(y => y.n === x.n);
    return b ? b.pts : 2;
  };
  let toDone = false,
    techDone = !!(S.game && S.game.size === 10);
  const hot = {};
  // a player who fouled out / was ejected disappears from later highlights
  const gone = (n, q, t) =>
    inc.some(i => i.n === n && (i.kind === 'eject' || i.kind === 'foulout') && q + t > i.q + i.t);
  const avail = (T, q, t) => {
    const a = T.R.filter(p => !gone(p.n, q, t));
    return a.length ? a : T.R;
  };
  for (let q = 0; q < P; q++) {
    const n = q < 4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const frac = (i + 0.35 + r() * 0.4) / n,
        len = q < 4 ? 12 : 5,
        mm = Math.max(0, len * (1 - frac)),
        clk = `${Math.floor(mm)}:${String(Math.floor((mm % 1) * 60)).padStart(2, '0')}`;
      const side = r() < qa[q] / (qa[q] + qb[q] || 1) ? z.a : z.b,
        T0 = teams[side],
        O0 = teams[other(side)],
        T = { ...T0, R: avail(T0, q, frac) },
        O = { ...O0, R: avail(O0, q, frac) };
      const x = r();
      let e;
      if (!toDone && (q === 1 || q === 2) && x < 0.12) {
        toDone = true;
        e = { kind: 'timeout', side: other(side), txt: `${tn(other(side))} 叫暫停，教練氣得跳腳` };
      } else if (!techDone && x < 0.16 && T.R.some(p => HOT.has(p.id))) {
        techDone = true;
        const p = PICK(
          T.R.filter(p => HOT.has(p.id)),
          r
        );
        e = { kind: 'tech', side, p: p.n, txt: `${callN(p, r)} 跟裁判理論，吃到技術犯規 😤` };
      } else if (x < 0.16 + 0.11 * ({ drop: 1.5, zone: 1.4 }[TDf(side)] || 1)) {
        const c = T.R.filter(y => styleOf(y).blk),
          p =
            c.length && r() < 0.7
              ? PICK(c, r)
              : pickW(
                  T.R,
                  T.R.map(y => num(y.blk, 0.3) + 0.1),
                  r
                ),
          sh = pickW(
            O.R,
            O.R.map(y => ptsOf(O, y) + 1),
            r
          );
        const gs = sigOf(p),
          useS = gs && gs.swat && r() < 0.9;
        e = {
          kind: 'block',
          side,
          p: p.n,
          d: sh.n,
          txt: useS ? fill(PICK(gs.swat, r), p, null, r) : fill(PICK(KTXT.block, r), p, null, r)
        };
        if (useS) {
          e.sig = gs.sl || gs.lab;
          e.sp = p.n;
          e.sid = p.id;
        }
      } else if (
        x <
        0.16 +
          0.11 * ({ drop: 1.5, zone: 1.4 }[TDf(side)] || 1) +
          0.09 * (TDf(side) === 'blitz' ? 1.7 : TO(side) === 'run' ? 1.3 : 1)
      ) {
        const p = pickW(
            T.R,
            T.R.map(y => num(y.stl, 0.5) + 0.1),
            r
          ),
          gs = sigOf(p);
        const useS = gs && gs.stl && r() < 0.7;
        e = {
          kind: 'steal',
          side,
          p: p.n,
          txt: useS ? fill(PICK(gs.stl, r), p, null, r) : fill(PICK(KTXT.steal, r), p, null, r)
        };
        if (useS) {
          e.sig = gs.lab;
          e.sp = p.n;
          e.sid = p.id;
        }
        // chase-down block: a trait player on the beaten team, chance scaled by his block rate
        const ch = O.R.filter(y => sigOf(y) && sigOf(y).chase);
        if (ch.length) {
          const c2 = PICK(ch, r),
            pc = 0.35 * clamp(num(c2.blkp, 1) / 2.2, 0.3, 1);
          if (r() < pc) {
            e.chase = c2.n;
            e.txt += `……${callN(c2, r)} 從後面追上來，追魂鍋！🚫`;
            e.sig = '追魂鍋';
            e.sp = c2.n;
            e.sid = c2.id;
          }
        }
      } else {
        const hs = TO(side) === 'helio' && z.tac[side].F.star,
          p = pickW(
            T.R,
            T.R.map(y => (ptsOf(T, y) + 1) * (y.n === hs ? 1.6 : 1)),
            r
          ),
          o = offKind(p, T.R, r, TO(side));
        if (o.k === 'three' && MOVERS.has(p.id) && r() < 0.55) {
          e = { kind: 'three', side, p: p.n, play: 'offball', txt: fill(PICK(OFFBALL_TXT, r), p, null, r) };
        } else if (o.k === 'dunk' && TOMA.has(p.id) && r() < 0.65) {
          e = {
            kind: 'dunk',
            side,
            p: p.n,
            txt: fill(PICK(TOMA_TXT, r), p, null, r),
            sig: '戰斧暴扣',
            sp: p.n,
            sid: p.id,
            ico: '🪓'
          };
        } else {
          const st2 = sigText(p, o.k, o.a, r);
          e = { kind: o.k, side, p: p.n, a: o.a && o.a.n, txt: st2.txt };
          if (st2.sig) {
            e.sig = st2.sig;
            e.sp = st2.sp;
            e.sid = st2.sid;
          }
        }
        const hk = side + p.n;
        hot[hk] = (hot[hk] || 0) + 1;
        if (hot[hk] === 3)
          ev.push({
            q,
            t: Math.min(0.99, frac + 0.02),
            clk,
            side,
            kind: 'hot',
            txt: `${callN(p, r)} 手感發燙！已經投進好幾球 🔥`
          });
      }
      e.q = q;
      e.t = frac;
      e.clk = clk;
      ev.push(e);
    }
  }
  const N = nm2 => {
    const p = [...teams[z.a].R, ...teams[z.b].R].find(x => x.n === nm2);
    return p ? callN(p, r) : String(nm2).split(' ').slice(-1)[0];
  };
  inc.forEach(i => {
    const len = i.q < 4 ? 12 : 5,
      mm = Math.max(0, len * (1 - i.t)),
      clk = `${Math.floor(mm)}:${String(Math.floor((mm % 1) * 60)).padStart(2, '0')}`,
      sub = i.sub ? `，${N(i.sub)} 替補上場` : '';
    if (i.kind === 'tech')
      ev.push({
        q: i.q,
        t: i.t,
        clk,
        side: i.side,
        kind: 'tech',
        p: i.n,
        txt: `${N(i.n)} 跟裁判理論，吃到技術犯規 😤`
      });
    if (i.kind === 'trouble')
      ev.push({
        q: i.q,
        t: i.t,
        clk,
        side: i.side,
        kind: 'foul',
        p: i.n,
        txt: `${N(i.n)} ${i.q < 2 ? '上半場就三犯' : '第四次犯規'}，被換下場休息${sub}`
      });
    if (i.kind === 'foulout')
      ev.push({
        q: i.q,
        t: i.t,
        clk,
        side: i.side,
        kind: 'foulout',
        p: i.n,
        txt: `${N(i.n)} 六犯畢業，犯滿離場 ❌${sub}`
      });
    if (i.kind === 'eject') {
      ev.push({
        q: i.q,
        t: Math.max(0, i.t - 0.08),
        clk,
        side: i.side,
        kind: 'tech',
        p: i.n,
        txt: `${N(i.n)} 情緒失控，吃到第一次技術犯規 😤`
      });
      ev.push({
        q: i.q,
        t: i.t,
        clk,
        side: i.side,
        kind: 'eject',
        p: i.n,
        txt: `${N(i.n)} 第二次技術犯規，被驅逐出場 🟥${sub}`
      });
    }
  });
  if (z.tac) {
    const A = z.tac[z.a],
      B = z.tac[z.b];
    ev.push({
      q: 0,
      t: 0.01,
      clk: '11:59',
      side: z.a,
      kind: 'tac',
      txt: `${tn(z.a)} 打${TAC_O[A.o].nm}＋${TAC_D[A.d].nm}，${tn(z.b)} 打${TAC_O[B.o].nm}＋${TAC_D[B.d].nm}`
    });
    if (tgm) {
      const xs = [
          [tgm.ca, z.a, z.b],
          [tgm.cb, z.b, z.a]
        ].sort((u, v) => Math.abs(v[0]) - Math.abs(u[0]))[0],
        [c, of, df] = xs;
      if (Math.abs(c) >= 0.5)
        ev.push({
          q: Math.min(P - 1, 2),
          t: 0.4,
          clk: '7:12',
          side: c > 0 ? of : df,
          kind: 'tac',
          txt:
            c > 0
              ? `${tn(of)} 的${TAC_O[z.tac[of].o].nm}打穿 ${tn(df)} 的${TAC_D[z.tac[df].d].nm}`
              : `${tn(df)} 的${TAC_D[z.tac[df].d].nm}鎖住 ${tn(of)} 的${TAC_O[z.tac[of].o].nm}`
        });
    }
  }
  Object.entries(bo).forEach(([s, n]) => {
    const b = teams[s] && teams[s].box.find(x => x.n === n);
    if (!b) return;
    const q = Math.min(P - 1, 2),
      t = 0.55 + 0.3 * r(),
      mm = 12 * (1 - t),
      clk = `${Math.floor(mm)}:${String(Math.floor((mm % 1) * 60)).padStart(2, '0')}`;
    ev.push({
      q,
      t,
      clk,
      side: s,
      kind: 'boom',
      p: n,
      txt: `${N(n)} 打出生涯之夜，第三節就拿了 ${Math.max(12, Math.round(b.pts * 0.7))} 分 🔥`
    });
  });
  Object.entries(tk).forEach(([s, n]) => {
    const b = teams[s] && teams[s].box.find(x => x.n === n);
    if (!b) return;
    const q = Math.min(P - 1, 3),
      t = 0.3 + 0.25 * r(),
      mm = 12 * (1 - t),
      clk = `${Math.floor(mm)}:${String(Math.floor((mm % 1) * 60)).padStart(2, '0')}`;
    const p = teams[s].R.find(x => x.n === n);
    ev.push({
      q,
      t,
      clk,
      side: s,
      kind: 'takeover',
      p: n,
      sp: n,
      sid: p && p.id,
      txt: `${N(n)} 接管比賽！球隊連續 ${3 + Math.floor(r() * 3)} 波進攻都交給他，全場 ${b.pts} 分`
    });
    // he takes the next couple of scoring plays of his team
    let k = 0;
    ev.forEach(e => {
      if (k < 2 && e.side === s && KPTS[e.kind] > 0 && e.q === q && e.t > t && e.p !== n && p) {
        const st2 = sigText(p, e.kind === 'three' ? 'three' : e.kind === 'dunk' ? 'dunk' : 'mid', null, r);
        e.p = n;
        e.a = null;
        e.play = null;
        e.txt = st2.txt;
        delete e.sig;
        if (st2.sig) {
          e.sig = st2.sig;
          e.sp = st2.sp;
          e.sid = st2.sid;
        }
        e.kind = e.kind === 'three' ? 'three' : e.kind === 'dunk' ? 'dunk' : 'mid';
        k++;
      }
    });
  });
  ev.sort((x, y) => x.q + x.t - (y.q + y.t));
  // scoring runs: three scoring plays in a row by one team
  let run = 0,
    last = null;
  const runs = [];
  ev.forEach((e, i) => {
    if (KPTS[e.kind] > 0) {
      if (e.side === last) run++;
      else {
        last = e.side;
        run = 1;
      }
      if (run === 3)
        runs.push({
          q: e.q,
          t: Math.min(0.995, e.t + 0.01),
          clk: e.clk,
          side: e.side,
          kind: 'run',
          txt: `${tn(e.side)} 打出一波 ${8 + Math.floor(r() * 6)}–0 攻勢 🔥`
        });
    }
  });
  ev.push(...runs);
  const win = sa > sb ? z.a : z.b,
    diff = Math.abs(sa - sb),
    W = teams[win],
    top = avail(W, P - 1, 0.97)
      .slice()
      .sort((x, y) => ptsOf(W, y) - ptsOf(W, x))
      .slice(0, 5),
    star =
      diff <= 4
        ? pickW(
            top,
            top.map(x => (ptsOf(W, x) + 2) * (sigOf(x) && sigOf(x).clutch ? 3 : 1)),
            r
          )
        : top[0];
  if (ot) ev.push({ q: 3, t: 0.999, clk: '0:00', side: null, kind: 'ot', txt: '平手！比賽進入延長賽' });
  if (diff >= 15)
    ev.push({
      q: P - 1,
      t: 0.75,
      clk: '3:' + String(10 + Math.floor(r() * 49)),
      side: win,
      kind: 'rest',
      txt: `${callN(star, r)} 坐上板凳休息，比賽提前分出勝負`
    });
  else
    ev.push({
      q: P - 1,
      t: 0.97,
      clk: '0:0' + (2 + Math.floor(r() * 7)),
      side: win,
      kind: diff <= 4 ? 'clutch' : 'mid',
      p: star.n,
      sig: diff <= 4 && sigOf(star) && sigOf(star).clutch ? sigOf(star).lab : undefined,
      sp: star.n,
      sid: star.id,
      txt:
        diff <= 4
          ? sigOf(star) && sigOf(star).ctxt
            ? fill(sigOf(star).ctxt, star, null, r)
            : `關鍵時刻！${callN(star, r)} 投進致勝球！`
          : `${callN(star, r)} 連拿分數，鎖定勝局`
    });
  return ev.sort((x, y) => x.q + x.t - (y.q + y.t));
}
function pbData() {
  const g = S.game,
    sim = S.sim;
  if (pbCache.gid === g.gid + sim.champ) return pbCache.d;
  const ro = {},
    base = {};
  g.sides.forEach(s => {
    ro[s] = rosterOf(g, s);
    base[s] = baseRate(ro[s], g, left(g, s));
  });
  const list = [];
  sim.series.forEach((z, si) => {
    const ra = pairRate(base[z.a], ro[z.a], ro[z.b]),
      rb = pairRate(base[z.b], ro[z.b], ro[z.a]);
    const pa0 = withBench(ro[z.a], ra.per),
      pb0 = withBench(ro[z.b], rb.per);
    const r = rng(hash(g.gid + z.a + z.b + 'pb'));
    let wa = 0,
      wb = 0;
    z.games.forEach((gm, gi) => {
      const [sa, sb, ot] = gm,
        last = gi === z.games.length - 1,
        inc = (z.inc && z.inc[gi]) || [],
        pa = withMins(pa0, inc),
        pbb = withMins(pb0, inc);
      const bg = (z.bo && z.bo[gi]) || {},
        tg = (z.tk && z.tk[gi]) || {},
        bA = last
          ? z.box[z.a]
          : boxFor(
              pa.map(x => x.p),
              pa,
              sa,
              r,
              bg[z.a],
              tg[z.a]
            ),
        bB = last
          ? z.box[z.b]
          : boxFor(
              pbb.map(x => x.p),
              pbb,
              sb,
              r,
              bg[z.b],
              tg[z.b]
            );
      const game = [sa, sb, ot];
      game.q = periods(sa, sb, ot, r);
      const ev = gameEvents(
        z,
        game,
        bA,
        bB,
        { [z.a]: pa.map(x => x.p), [z.b]: pbb.map(x => x.p) },
        r,
        inc,
        bg,
        tg,
        z.tg && z.tg[gi]
      );
      sa > sb ? wa++ : wb++;
      const all = bA.map(x => ({ ...x, s: z.a })).concat(bB.map(x => ({ ...x, s: z.b })));
      const pog = all.sort(
        (x, y) =>
          y.pts +
          1.2 * y.reb +
          1.5 * y.ast +
          2 * y.stl +
          2 * y.blk -
          (x.pts + 1.2 * x.reb + 1.5 * x.ast + 2 * x.stl + 2 * x.blk)
      )[0];
      list.push({ si, gi, z, sa, sb, ot, q: game.q, ev, wa, wb, pog, last, bA, bB, inc, bo: bg, tk: tg });
    });
  });
  pbCache = { gid: g.gid + sim.champ, d: list };
  return list;
}
const PB_Q = 6000,
  PB_HOLD = 2600,
  PB_SEG = 1150,
  PB_POST = 550;
function pbDur(G) {
  return G.q[0].length * PB_Q + PB_HOLD;
}
const pbDefSp = () => 1;
/* playback clock: virtual game time advances at the chosen speed, but slows down around key moments
   (close game late, lead changes, game winners) and a little for highlight plays, so they can be followed */
function scoreAt(G, pe) {
  const qa = G.q[0],
    qb = G.q[1],
    P = qa.length,
    full = Math.floor(pe);
  let a = 0,
    b = 0;
  for (let i = 0; i < P; i++) {
    if (i < full) {
      a += qa[i];
      b += qb[i];
    } else if (i === full) {
      const f = pe - full;
      a += Math.floor(qa[i] * f);
      b += Math.floor(qb[i] * f);
    }
  }
  return a - b;
}
function slowWins(G) {
  if (G.slow) return G.slow;
  const W = [];
  const P = G.q[0].length;
  G.ev.forEach(x => {
    if (DEAD.has(x.kind) && x.kind !== 'ot') return;
    const T = (x.q + x.t) * PB_Q,
      pe = x.q + x.t,
      d0 = scoreAt(G, Math.max(0, pe - 0.3)),
      d1 = scoreAt(G, Math.min(P, pe + 0.02)),
      late = (x.q >= 3 && x.t > 0.45) || x.q >= 4;
    let w = null;
    if (x.kind === 'clutch') w = { rate: 0.3, zoom: 1, lab: '🎬 致勝球' };
    else if (x.chase) w = { rate: 0.35, zoom: 1, lab: '🎬 追魂鍋' };
    else if (x.sig) w = { rate: 0.5, zoom: 1, lab: `⭐ 招牌：${x.sig}` };
    else if (x.q >= 2 && Math.sign(d0) !== Math.sign(d1) && d1 !== 0 && d0 !== 0)
      w = { rate: 0.4, zoom: 1, lab: '🎬 逆轉！' };
    else if (late && Math.abs(d1) <= 5) w = { rate: 0.4, zoom: 1, lab: '🎬 關鍵時刻' };
    else if (x.kind === 'ot') w = { rate: 0.5, zoom: 0, lab: '⏱ 延長賽' };
    else if (['dunk', 'alley', 'logo', 'block', 'ankle'].includes(x.kind)) w = { rate: 0.6, zoom: 0, lab: '' };
    if (w) W.push({ a: T - 1500, b: T + PB_POST + 300, ...w });
  });
  return (G.slow = W);
}
const warpAt = (G, vt) => {
  let r = 1,
    w = null;
  for (const x of slowWins(G))
    if (vt >= x.a && vt <= x.b && x.rate < r) {
      r = x.rate;
      w = x;
    }
  return { r, w };
};
function pbAdvance() {
  const p = ui.pb;
  if (!p) return;
  const now = Date.now(),
    dt = Math.min(250, now - (p.last || now));
  p.last = now;
  const G = pbData()[p.k];
  if (!G) return;
  p.vt += dt * p.sp * warpAt(G, p.vt).r;
}
function pbState() {
  const L = pbData(),
    p = ui.pb;
  if (!p || p.gid !== S.game.gid) return null;
  const G = L[p.k];
  if (!G) return null;
  const e = p.vt,
    P = G.q[0].length,
    pe = Math.min(P, e / PB_Q);
  return { L, G, e, P, pe, done: e >= P * PB_Q, next: e >= pbDur(G) };
}
function pbStart() {
  ui.pb = { gid: S.game.gid, k: 0, vt: 0, last: Date.now(), sp: ui.pbSp || pbDefSp() };
}
// the title moment: final buzzer, then the crowd. A cheer and fanfare when you (or anyone, on a shared phone) win; polite applause when you lose
function champSound(d) {
  const ch = S.sim && S.sim.champ,
    me = myRole(),
    won = me === 'all' || me === 'spec' || me === ch,
    t = d || 0;
  sfx('horn', t);
  if (won) {
    sfx('cheer', t + 0.55);
    sfx('champ', t + 1.2);
  } else sfx('applause', t + 0.6);
}
function pbNext() {
  const L = pbData();
  if (ui.pb.k + 1 >= L.length) {
    ui.pbDone.add(S.game.gid);
    champSound();
    ui.pbFast = true;
    ui.pb = null;
  } else {
    ui.pb.k++;
    ui.pb.vt = 0;
    ui.pb.last = Date.now();
  }
  render();
  scrollTo(0, 0);
}
setInterval(() => {
  if (!S) return;
  withView(() => {
    if (S.phase !== 'results' || !S.sim || !ui.pb || ui.pbDone.has(S.game.gid)) return;
    pbAdvance();
    const st = pbState();
    if (st && st.next && ui.pb.auto !== false) return pbNext();
    render();
  });
}, 150);

/* ---------- play-by-play ----------
 Dead-ball lines (timeouts, runs, fouls, tactic notes …): shown in the feed, never scoring plays. */
const DEAD = new Set([
  'timeout',
  'run',
  'hot',
  'tech',
  'foul',
  'foulout',
  'eject',
  'ot',
  'rest',
  'boom',
  'takeover',
  'tac'
]);
function vPlayback() {
  const g = S.game,
    st = pbState();
  if (!st) {
    pbStart();
    return vPlayback();
  }
  const { L, G, P, pe, done } = st,
    z = G.z,
    two = g.sides.length === 2,
    ns = S.sim.series.length;
  const qa = G.q[0],
    qb = G.q[1],
    shown = () => {
      const full = Math.floor(pe);
      let a = 0,
        b = 0;
      for (let i = 0; i < P; i++) {
        if (i < full) {
          a += qa[i];
          b += qb[i];
        } else if (i === full) {
          const f = pe - full;
          a += Math.floor(qa[i] * f);
          b += Math.floor(qb[i] * f);
        }
      }
      return [a, b];
    };
  const [ca, cb] = done ? [G.sa, G.sb] : shown();
  const per = Math.min(P - 1, Math.floor(pe)),
    pf = pe - Math.floor(pe),
    plen = per < 4 ? 12 : 5,
    left_ = done ? 0 : Math.max(0, plen * (1 - pf));
  const perLab = i => (i < 4 ? `第 ${i + 1} 節` : P > 5 ? `延長 ${i - 3}` : '延長賽');
  const clk = done
    ? '終場'
    : `${perLab(per)}・${Math.floor(left_)}:${String(Math.floor((left_ % 1) * 60)).padStart(2, '0')}`;
  const evs = G.ev
    .filter(x => x.q + x.t <= pe)
    .slice()
    .reverse()
    .slice(0, 4);
  const prevW = L.filter(x => x.z === z && x.gi < G.gi),
    wa = prevW.filter(x => x.sa > x.sb).length + (done && G.sa > G.sb ? 1 : 0),
    wb = prevW.filter(x => x.sb > x.sa).length + (done && G.sb > G.sa ? 1 : 0);
  const dots = s =>
    [0, 1, 2, 3].map(i => `<i class="${i < (s === z.a ? wa : wb) ? 'on' : ''}" style="--c:${col(s)}"></i>`).join('');
  const qt = `<table class="qt"><tr><th></th>${qa.map((_, i) => `<th>${i < 4 ? i + 1 : 'OT'}</th>`).join('')}<th>總</th></tr>
    ${[
      [z.a, qa, ca],
      [z.b, qb, cb]
    ]
      .map(
        ([s, q, c]) =>
          `<tr><td style="color:${col(s)}">${esc(nm(S, s))}</td>${q.map((x, i) => `<td>${i < Math.floor(pe) || done ? x : ''}</td>`).join('')}<td><b>${c}</b></td></tr>`
      )
      .join('')}</table>`;
  const win = G.sa > G.sb ? z.a : z.b,
    over = Math.max(G.wa, G.wb) === 4;
  const final = done
    ? `<div class="pbfin" id="fin-${g.gid}-${G.si}-${G.gi}">
      <div class="small mut">本場最佳</div><div class="pog"><b style="color:${col(G.pog.s)}">${esc(G.pog.n)}</b> ${G.pog.pts} 分 ${G.pog.reb} 籃板 ${G.pog.ast} 助攻${G.pog.blk >= 3 ? ` ${G.pog.blk} 阻攻` : ''}${G.pog.stl >= 3 ? ` ${G.pog.stl} 抄截` : ''}</div>
      <div class="ser">${over ? `🏁 系列賽結束：<b style="color:${col(win)}">${esc(nm(S, win))}</b> ${Math.max(G.wa, G.wb)}–${Math.min(G.wa, G.wb)} 勝出` : G.wa === G.wb ? `系列賽 ${G.wa}–${G.wb} 平手` : `<b style="color:${col(G.wa > G.wb ? z.a : z.b)}">${esc(nm(S, G.wa > G.wb ? z.a : z.b))}</b> 系列賽 ${Math.max(G.wa, G.wb)}–${Math.min(G.wa, G.wb)} 領先`}</div></div>`
    : '';
  const isLast = ui.pb.k === L.length - 1,
    gNo = ui.pb.k + 1;
  return `<div class="pb">
    <div class="pbh"><span class="small mut">${two ? '七戰四勝系列賽' : `循環賽 第 ${G.si + 1}/${ns} 組`}・第 ${G.gi + 1} 場</span><button class="skipall" data-act="pbskip">跳過全部 ⏭</button></div>
    <div class="sb2"><div class="tm"><div class="tn" style="color:${col(z.a)}">${esc(nm(S, z.a))}</div><div class="dots">${dots(z.a)}</div></div>
      <div class="mid"><div class="scr"><span style="color:${col(z.a)}">${ca}</span><i>:</i><span style="color:${col(z.b)}">${cb}</span></div><div class="clk ${done ? 'end' : ''}">${clk}</div></div>
      <div class="tm"><div class="tn" style="color:${col(z.b)}">${esc(nm(S, z.b))}</div><div class="dots">${dots(z.b)}</div></div></div>
    ${done ? final : `<div class="feed">${evs.map(x => `<div class="ev ${x.sig ? 'sigev' : ''}" id="ev-${g.gid}-${G.si}-${G.gi}-${G.ev.indexOf(x)}" style="${x.side ? `border-left-color:${col(x.side)}` : ''}"><span class="t">${x.q < 4 ? 'Q' + (x.q + 1) : 'OT'} ${x.clk}</span><span class="ic">${x.sig ? x.ico || SIGICO[x.sid] || '⭐' : KICO[x.kind] || '🏀'}</span>${x.sig ? `<b class="sgl">⭐ ${esc(x.sig)}</b>` : ''}${esc(x.txt)}</div>`).join('') || '<div class="small mut" style="text-align:center;padding:12px">跳球，比賽開始！</div>'}</div>`}
    ${qt}
    <div class="pbc"><button class="ghost" data-act="pbsp">⏩ ${ui.pb.sp}x</button>
      <button class="big" data-act="pbnext">${done ? (isLast ? '看最終結算 →' : '下一場 →') : '⏭ 跳過這場'}</button></div>
    <div class="small mut" style="text-align:center;margin-top:6px">第 ${gNo} / ${L.length} 場</div></div>`;
}
/* who could take over: each team's 爆發型 players, the chance per game that one of them takes over, and how often it
   happened, so a run with no takeovers reads as the dice it is rather than as something rigged */
/* after the games: the card's 攻守貢獻 next to what that season actually played like, so a surprise (Wade's injured
   2007-08 shows 88 on the card and plays like a 75) is visible instead of feeling rigged */
// the card already showed its season's 攻守貢獻; only when the number was hidden is it revealed after the games
function ovrShift(p, g) {
  if (!p || p.fa || g.ovr !== false) return '';
  return `<i class="tag ovs">本季貢獻 ${seasonOvr(p)}</i>`;
}
function tkSummary(g, sim) {
  const rows = g.sides.map(s => {
    const R = rosterOf(g, s).filter(p => tkRate(p) > 0),
      ch = 1 - R.reduce((t, p) => t * (1 - tkRate(p)), 1);
    let n = 0,
      gp = 0;
    sim.series.forEach(z => {
      if (z.a !== s && z.b !== s) return;
      gp += z.games.length;
      (z.tk || []).forEach(t => {
        if (t[s]) n++;
      });
    });
    return `<span style="color:${col(s)}">${esc(nm(S, s))}</span> ${R.length ? `${R.length} 人・每場約 ${Math.round(ch * 100)}%・實際 ${n}/${gp} 場` : '沒有爆發型球員'}`;
  });
  return `<div class="small mut" style="margin-top:6px;line-height:1.6">爆發型：${rows.join('<br>')}</div>`;
}
function boLine(z, k) {
  const has = A => A && A.some(x => x && Object.keys(x).length);
  if (!has(z.bo) && !has(z.tk)) return '';
  let L = [];
  try {
    L = pbData().filter(G => G.si === k);
  } catch (e) {}
  const row = (A, lab) => {
    if (!has(A)) return '';
    const items = [];
    A.forEach((bg, gi) =>
      Object.entries(bg || {}).forEach(([s, n]) => {
        const G = L.find(x => x.gi === gi),
          b = G && (s === z.a ? G.bA : G.bB).find(x => x.n === n);
        items.push(
          `<span style="color:${col(s)}">G${gi + 1} ${esc(String(n).split(' ').slice(-1)[0])}${b ? ` ${b.pts} 分` : ''}</span>`
        );
      })
    );
    return `<div class="small" style="margin-top:4px">${lab}：${items.join('・')}</div>`;
  };
  return row(z.tk, '球星接管') + row(z.bo, '爆發之夜');
}
function vResults() {
  const g = S.game,
    sim = S.sim,
    r = myRole();
  if (!sim) return `<div class="center mut" style="margin-top:60px"><span class="spin"></span> 模擬中…</div>`;
  if (!ui.pbDone.has(g.gid)) return vPlayback();
  const id = g.gid,
    sides = g.sides,
    T = sim.teams,
    N = s => `<b style="color:${col(s)}">${esc(nm(S, s))}</b>`;
  const champ = sim.champ,
    two = sides.length === 2,
    z0 = sim.series[0];
  const head = two
    ? `<div class="champ rs" style="--d:1.5s"><div class="t">CHAMPION</div><div class="w">🏆 ${N(champ)}</div><div class="small mut">七戰四勝系列賽 ${Math.max(z0.wa, z0.wb)}–${Math.min(z0.wa, z0.wb)}${z0.upset ? '・😱 爆冷！' : ''}</div></div>`
    : `<div class="champ rs" style="--d:1.5s"><div class="t">CHAMPION</div><div class="w">🏆 ${N(champ)}</div><div class="small mut">三隊循環賽，系列賽勝場最多</div></div>`;
  const ser = sim.series
    .map((z, k) => {
      const pA = Math.round(z.p * 100);
      return `<div class="series"><div class="grow">${N(z.a)} <span class="mut small">vs</span> ${N(z.b)}
      <div class="gms">${z.games.map(([x, y, ot]) => `<span style="color:${x > y ? col(z.a) : col(z.b)}">${x}–${y}${ot ? ' OT' : ''}</span>`).join('')}</div>
      ${(z.inc || []).some(x => x.some(i => i.kind !== 'tech' && i.kind !== 'trouble')) ? `<div class="small" style="margin-top:4px;color:#ffb4a8">${z.inc.flatMap((x, gi) => x.filter(i => i.kind === 'eject' || i.kind === 'foulout').map(i => `${i.kind === 'eject' ? '🟥' : '❌'} G${gi + 1} ${esc(String(i.n).split(' ').slice(-1)[0])} ${i.kind === 'eject' ? '被驅逐' : '犯滿'}`)).join('・')}</div>` : ''}
      ${boLine(z, k)}${tacLine(z)}<div class="small mut" style="margin-top:2px">單場勝率 ${pA}% : ${100 - pA}%・系列賽 ${Math.round(z.pser * 100)}% : ${100 - Math.round(z.pser * 100)}%${z.upset ? '・<b style="color:var(--gold)">爆冷</b>' : ''}</div></div>
      <div class="sc"><span id="s${k}a-${id}" data-count="${z.wa}" data-delay="${ui.pbFast ? 0.5 : 2.0}" style="color:${col(z.a)}">${z.wa}</span>–<span id="s${k}b-${id}" data-count="${z.wb}" data-delay="${ui.pbFast ? 0.5 : 2.0}" style="color:${col(z.b)}">${z.wb}</span></div></div>`;
    })
    .join('');
  const std = two
    ? ''
    : `<table class="std"><tr><th>排名</th><th>系列勝</th><th>場次</th><th>實力</th></tr>${sim.order.map((s, i) => `<tr><td>${i + 1}. ${N(s)}</td><td>${T[s].sw}</td><td>${T[s].gw}–${T[s].gl}</td><td>${T[s].grade}</td></tr>`).join('')}</table>`;
  const board = `<div class="board rs" style="--d:1.8s"><div class="lab">${two ? '系列賽' : '循環賽'}</div><div style="text-align:left;margin-top:6px">${ser}</div>${std}
    ${sim.mvp ? `<div class="small mut" style="margin-top:8px">冠軍 MVP：${esc(sim.mvp.n)}（決勝場 ${sim.mvp.pts} 分 ${sim.mvp.reb} 籃板 ${sim.mvp.ast} 助攻）</div>` : ''}${tkSummary(g, sim)}</div>`;
  const teamBlock = (s, d0) => {
    const R = rosterOf(g, s),
      t = T[s];
    const rows = R.map((p, i) => {
      const pi = posInfo(p, p.slot);
      return `<div class="srow ${s} rs ${isBench(p.slot) ? 'bench' : ''}" style="--d:${(d0 + 0.1 * i).toFixed(2)}s"><div class="sl">${isBench(p.slot) ? roleLab(p.role, true) : esc(p.slot)}</div><div class="bd"><span class="pr">$${p.price}</span><div class="nm">${esc(p.n)}</div>
      <div class="sb">${esc(sub(p))}${p.est && p.est.length ? ' · 估' : ''}${pi.tier > 0 ? `<i class="tag t${pi.tier}">${pi.lab}</i>` : ''}${ovrShift(p, g)}</div>
      <div class="st">${[
        ['pts', 'PPG'],
        ['trb', 'RPG'],
        ['ast', 'APG'],
        ['stl', 'SPG'],
        ['blk', 'BPG']
      ]
        .map(([k, l]) => `<div><b>${fmt(p[k])}</b><i>${l}</i></div>`)
        .join('')}</div></div></div>`;
    }).join('');
    return `<div class="teamhead ${s} rs" style="--d:${(d0 - 0.1).toFixed(2)}s"><span class="nm">${esc(nm(S, s))}</span><span class="grow small mut">花 $${g.spent[s]}・剩 $${left(g, s)}</span><span class="grade">${t.grade}</span><span class="pct">贏過本主題 ${t.pct}% 的隨機陣容</span></div>${rows}`;
  };
  let d = 2.6;
  const blocks = sim.order
    .map(s => {
      const h = teamBlock(s, d);
      d += 0.6;
      return h;
    })
    .join('');
  const chemCard = `<section class="card rs" style="--d:${d}s"><h2>🧪 化學反應</h2>${sides
    .map(s => {
      const c = T[s].chem,
        L = [];
      const ps = [...c.pairs].sort((x, y) => y.k - x.k);
      (c.lg || []).forEach(x =>
        L.push(
          `<div class="lgline">${x.ic} <b>傳奇組合・${esc(x.nm)}</b> <b class="lgv">+${x.v}</b><div class="small mut">${x.ns.map(esc).join('・')}</div></div>`
        )
      );
      ps.slice(0, 3).forEach(p => L.push(`<div>🤝 ${esc(p.a)} ＋ ${esc(p.b)}：真實隊友 ${p.k} 季</div>`));
      if (ps.length > 3)
        L.push(`<div class="small mut">…還有 ${ps.length - 3} 組${c.tm >= 2.5 ? '（已達上限）' : ''}</div>`);
      if (c.sw) L.push(`<div>🔄 全員換防：${c.swN} 人能守 3 個以上位置</div>`);
      c.feuds.forEach(f =>
        L.push(
          `<div>⚡ ${esc(f.a)} ✕ ${esc(f.b)}${f.lv === 2 ? '（嚴重）' : ''}<div class="small mut">${esc(f.t)} ${FEUDS.some(x => x.u === f.u) ? `<a href="${esc(f.u)}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}</div></div>`
        )
      );
      return `<div class="chemt">${N(s)}${L.join('') || '<div class="small mut">沒有特別的化學反應</div>'}</div>`;
    })
    .join(
      ''
    )}${!tmOn(g) ? '<div class="small mut" style="margin-top:6px">單季陣容主題大家本來就是隊友，不計隊友默契。</div>' : ''}</section>`;
  const pc = v => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  const why = (n, m) => {
    const L = [];
    if (m.why.includes('speed')) L.push(`速度優勢 得分 <b class="up">${pc(m.pts)}</b>`);
    if (m.why.includes('post'))
      L.push(`體型優勢 得分 <b class="up">${pc(m.pts)}</b>、籃板 <b class="up">${pc(m.reb)}</b>`);
    if (m.why.includes('speed') && m.reb < 0.99) L.push(`籃板 <b class="dn">${pc(m.reb)}</b>`);
    if (m.why.includes('size')) L.push(`守禁區吃力、阻攻 <b class="dn">${pc(m.blk)}</b>`);
    if (m.why.includes('handle')) L.push(`運球推進失誤 <b class="dn">${pc(m.tov)}</b>`);
    if (m.why.includes('stretch'))
      L.push(`外線拉開空間 得分 <b class="up">${pc(m.pts)}</b>、少搶進攻籃板 <b class="dn">${pc(m.reb)}</b>`);
    if (m.why.includes('pulled'))
      L.push(`被拉出禁區 阻攻 <b class="dn">${pc(m.blk)}</b>、離開籃下籃板 <b class="dn">${pc(m.reb)}</b>`);
    return L.length ? `<div class="small">${esc(n)}：${L.join('、')}</div>` : '';
  };
  const muCard = sim.series.some(z => z.mu.length)
    ? `<section class="card rs" style="--d:${d + 0.1}s"><h2>🆚 位置與對位</h2>${sim.series
        .map(z =>
          z.mu.length
            ? `<details ${sim.series.length === 1 ? 'open' : ''} style="margin-top:6px"><summary class="small">${esc(nm(S, z.a))} vs ${esc(nm(S, z.b))}</summary>${z.mu
                .map(m => {
                  const v = m.fa - m.fb;
                  return `<div class="mis"><div><b>${m.slot}</b>｜<span style="color:${col(z.a)}">${esc(m.a)}</span> vs <span style="color:${col(z.b)}">${esc(m.b)}</span> <i class="tag t1">${Math.abs(v) < 0.5 ? '互有勝負' : esc(nm(S, v > 0 ? z.a : z.b)) + ' 佔上風'}</i></div>${why(m.a, m.ma)}${why(m.b, m.mb)}</div>`;
                })
                .join('')}</details>`
            : ''
        )
        .join('')}</section>`
    : '';
  const rowT = (lab, expl, f) => {
    const vals = sides.map(f),
      mx = Math.max(...vals);
    return `<tr><td>${lab}<small>${expl}</small></td>${vals.map(v => `<td class="${Math.abs(v - mx) < 0.05 && vals.some(x => Math.abs(x - v) > 0.05) ? 'w' : ''}">${(v > 0 ? '+' : '') + v.toFixed(1)}</td>`).join('')}</tr>`;
  };
  const cmp = `<section class="card rs" style="--d:${d + 0.2}s"><h2>⚖️ 實力拆解（每 100 回合淨勝分）</h2><table class="cmp"><tr><th></th>${sides.map(s => `<th style="color:${col(s)}">${esc(nm(S, s))}</th>`).join('')}</tr>
    ${rowT('進攻影響力', '得分效率、助攻、失誤、進攻籃板（OBPM）', s => T[s].base.O)}
    ${rowT('防守影響力', '抄截、阻攻、防守籃板（DBPM）', s => T[s].base.D)}
    ${rowT('球權重疊', `使用率合計 ${sides.map(s => Math.round(T[s].base.U) + '%').join(' / ')}`, s => T[s].base.usgAdj)}
    ${rowT('位置與對位', '平均每場對位結果', s => T[s].posAdj)}
    ${rowT('隊友默契', '真實當過隊友', s => T[s].base.tmAdj)}
    ${sides.some(s => T[s].base.lgAdj) ? rowT('傳奇組合', '三巨頭／王朝核心', s => T[s].base.lgAdj || 0) : ''}
    ${rowT('全員換防', '五人都能守多位置', s => T[s].base.swAdj)}
    ${rowT('更衣室不合', '有記錄的隊內不合', s => T[s].base.fdAdj)}
    ${g.size === 10 ? rowT('替補深度', '5 位替補比起板凳等級球員', s => T[s].base.benchAdj || 0) : ''}
    ${rowT('省錢紅利', '剩下的錢', s => T[s].base.savAdj)}
    ${rowT('戰術契合', `${sides.map(s => (T[s].tac ? TAC_O[T[s].tac.o].nm : '')).join(' / ')}（克制看各系列賽）`, s => T[s].tacAdj || 0)}
    ${S.game.cards ? rowT('🏟️ 主場優勢', '能力卡', s => T[s].base.hcAdj || 0) : ''}
    ${g.misRes ? rowT('任務獎勵', '完成任務的加成', s => T[s].base.misAdj || 0) : ''}
    ${rowT('<b>總評</b>', '', s => T[s].base.net + T[s].posAdj + (T[s].tacAdj || 0))}</table>
    <div class="small mut" style="margin-top:8px">每 1 分總評差距 ≈ 每場多贏 0.8 分（用 1,230 支真實球隊校正）。單場有約 ±13 分的運氣，所以系列賽也可能爆冷。</div></section>`;
  const boxT = (z, s) =>
    `<table class="box"><tr><th>${esc(nm(S, s))}</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th></tr>${z.box[s].map(x => `<tr><td>${esc(isBench(x.slot) ? '替' : x.slot)} ${esc(x.n)}</td><td>${x.pts}${ar(x, 'pts')}</td><td>${x.reb}${ar(x, 'reb')}</td><td>${x.ast}${ar(x, 'ast')}</td><td>${x.stl}${ar(x, 'stl')}</td><td>${x.blk}${ar(x, 'blk')}</td><td>${x.tov}${ar(x, 'tov', 1)}</td></tr>`).join('')}</table>`;
  const owned = new Set(sides.flatMap(s => g.rosters[s].map(x => g.items[x.k].n)));
  const leftover = g.pool.map(p => p.n).filter(n => !owned.has(n));
  const isP = r === 'all' || ALL.includes(r);
  return `  <div class="reveal rs" style="--d:1.3s"><div class="lab">THE THEME WAS</div><div class="tn">${esc(g.theme.name)}</div>${g.theme.tag ? `<div class="tt">${esc(g.theme.tag)}</div>` : ''}<div class="tt" style="margin-top:6px">比的是各自在當年的統治力（以當年聯盟平均為基準）</div></div>
  ${head}${seasonGain(g, sim)}${board}${misResults(g, 2.4)}${blocks}${chemCard}${muCard}${cmp}
  <section class="card rs" style="--d:${d + 0.3}s">${sim.series.map(z => `<details style="margin-top:6px"><summary>📊 決勝場 Box Score：${esc(nm(S, z.a))} ${z.games[z.games.length - 1][0]}–${z.games[z.games.length - 1][1]} ${esc(nm(S, z.b))}</summary>${boxT(z, z.a)}${boxT(z, z.b)}<div class="small mut" style="margin-top:4px">▲▼ 代表因為位置或對位，比他平常明顯多／少。</div></details>`).join('')}
  <details style="margin-top:12px"><summary>🧾 競標紀錄（${g.log.length} 張）</summary><div class="log">${g.log.map((l, k) => `<div><span>${k + 1}. ${esc(l.n)}</span><span style="color:${l.who ? col(l.who) : 'var(--mut)'}">${l.who ? esc(nm(S, l.who)) + ' $' + l.amt : '流標'}</span></div>`).join('')}</div></details>
  ${leftover.length ? `<details style="margin-top:12px"><summary>👀 主題裡沒被標走的 ${leftover.length} 位</summary><div class="small" style="margin-top:8px;color:#3d4458">${leftover.map(esc).join('、')}</div></details>` : ''}</section>
  <div class="rs" style="--d:${d + 0.4}s"><button class="ghost" data-act="copy">📋 複製結果（貼到群組）</button>${logBtn()}
  ${g.round ? seasonWaitNote() : ''}${isP ? `<button class="big" data-act="again">${g.round ? (S.season && S.season.done ? '🏆 看季賽頒獎 →' : '🏁 看季賽積分榜 →') : '回到大廳 →'}</button>` : `<button class="big" data-act="specback">${g.round ? '看季賽積分榜 →' : '回到大廳 →'}</button>`}</div>`;
}
function seasonGain(g, sim) {
  if (!g.round) return '';
  const se = S.season || S.lastSeason;
  if (!se) return '';
  const R = se.rounds.find(x => x.k === g.round);
  if (!R) return '';
  return `<div class="sgainc rs" style="--d:1.65s"><div class="small mut">🏁 季賽 第 ${g.round}/${g.rounds} 局・本局積分</div><div class="sgain">${g.sides
    .map(s => {
      const p = R.pts[s];
      return `<span style="border-color:${col(s)}"><b style="color:${col(s)}">${esc(nm(S, s))} +${p.t}</b>${p.b ? ` <small>${p.b === 3 ? '冠軍' : sim.order.indexOf(s) === 1 && g.sides.length === 3 ? '第二' : '打滿七場'} +${p.b}</small>` : ''}${p.m ? ` <small>🎯 +${p.m}</small>` : ''}</span>`;
    })
    .join('')}</div></div>`;
}
function summaryText() {
  const g = S.game,
    sim = S.sim;
  let t = `🏀 BALLER BID 球星喊價｜主題：${g.theme.name}\n🏆 冠軍：${nm(S, sim.champ)}\n`;
  sim.series.forEach(z => (t += `${nm(S, z.a)} ${z.wa}–${z.wb} ${nm(S, z.b)}\n`));
  if (g.misRes)
    g.sides.forEach(s => {
      const x = g.misRes[s];
      if (x) t += `🎯 ${nm(S, s)}：${misOf(x.id).nm} ${x.done ? '✓ 達成' : '✗ 未達成'}\n`;
    });
  g.sides.forEach(s => {
    t += `\n${nm(S, s)}（評級 ${sim.teams[s].grade}・花 $${g.spent[s]}）\n`;
    rosterOf(g, s).forEach(p => (t += `  ${isBench(p.slot) ? roleLab(p.role) : p.slot} ${p.n} $${p.price}\n`));
  });
  return t;
}
async function copyText(txt, okMsg) {
  try {
    await navigator.clipboard.writeText(txt);
    toast(okMsg);
  } catch (e) {
    toast('複製失敗，請長按手動複製');
  }
}
