/* ---------- flow: game modes, dispatch, phase transitions and cues ---------- */
function startAI() {
  NET.mode = 'ai';
  NET.skew = 0;
  const sv = lsGet(LS_AI);
  S = sv && sv.v && sv.cfg && sv.cfg.cats && sv.bots ? sv : aiState();
  if (!S.aiv) {
    Object.values(S.bots).forEach(b => {
      b.st = 'rand';
      delete b.play;
    });
    S.aiv = 2;
    if (!S.season) aiAssign(S);
  }
  render();
} // older saves had one fixed style
function startLocal() {
  NET.mode = 'local';
  NET.skew = 0;
  const sv = lsGet(LS);
  S = sv && sv.v && sv.cfg && sv.cfg.cats ? sv : newState();
  render();
}
function dispatch(a) {
  if (!S) return;
  if (NET.mode === 'guest') {
    sendAct(a);
    return;
  }
  const prev = snapOf();
  if (apply(S, a, { cid: CID, role: roleOf(S, CID) })) {
    fx(prev);
    commit();
  } else render();
}
function snapOf() {
  const g = S && S.game;
  return S
    ? g
      ? {
          log: g.log.length,
          bid: g.bid.amt,
          who: g.bid.who,
          turn: g.turn,
          gid: g.gid,
          idx: g.idx,
          phase: S.phase,
          sb: g.sb ? Object.keys(g.sb).length : -1,
          grab: !!g.grab,
          rv: g.reveal ? g.reveal.idx + ':' + (g.reveal.win || '') + (g.reveal.retie || '') : '',
          stage: g.stage,
          nomBy: g.nomBy,
          ev: g.ev ? g.ev.n : 0
        }
      : { phase: S.phase }
    : null;
}
/* transitions: a short title card between phases, and the sold card stays on screen for a moment with a stamp
   before the next card flips in, so screens never just jump */
const STAGES = {
  mission: ['🎯', '抽任務卡', '每人 3 張選 1 張'],
  auction: ['🔨', '競標開始', '主題保密，喊價吧'],
  lineup: ['📋', '競標結束', '排好陣容，準備開打'],
  results: ['🏀', '開打！', '七戰四勝'],
  season: ['🏁', '季賽積分榜', '']
};
function stage(ph) {
  const st = STAGES[ph];
  if (!st || NET.mode === null || window.BB_FAST) return;
  const el = document.getElementById('stagefx');
  if (!el) return;
  let sub = st[2];
  if (ph === 'auction' && S.game)
    sub = `${S.game.round ? `季賽第 ${S.game.round} 局・` : ''}共 ${S.game.items.length} 張牌・主題保密`;
  if (ph === 'results' && S.game && S.game.sides.length === 3) sub = '三隊循環賽';
  el.innerHTML = `<div class="sfx"><div class="sic">${st[0]}</div><div class="stt">${st[1]}</div>${sub ? `<div class="sst">${esc(sub)}</div>` : ''}</div>`;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  clearTimeout(ui.stageT);
  ui.stageT = setTimeout(() => el.classList.remove('on'), 1350);
  try {
    scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    scrollTo(0, 0);
  }
}
function fx(prev) {
  if (!prev || !S) return;
  if (prev.phase !== S.phase && !lastView()) {
    stage(S.phase);
    sfx('stage');
  }
  if (!S.game) return;
  const g = S.game,
    me = myRole(),
    mine = s => s && (me === 'all' || me === s);
  if (prev.gid === g.gid && S.phase === 'auction') {
    if (g.reveal && prev.rv !== g.reveal.idx + ':' + (g.reveal.win || '') + (g.reveal.retie || '') && !g.reveal.grab)
      sfx('reveal');
    else if (g.sb && prev.sb >= 0 && Object.keys(g.sb).length > prev.sb) sfx('tap');
    if (g.grab && !prev.grab) sfx('grab');
    if (g.bid.amt > prev.bid && !g.sb && !g.grab && g.price == null) {
      if (mine(g.bid.who)) sfx('bid');
      else if (prev.who && mine(prev.who) && me !== 'all') sfx('outbid');
      else sfx('raise');
    }
    if (me !== 'all' && g.turn === me && prev.turn !== me) sfx('turn');
    if (g.stage === 'nom' && prev.stage !== 'nom' && mine(g.nomBy) && me !== 'all') sfx('turn');
    if (g.ev && g.ev.n !== prev.ev && prev.gid === g.gid) {
      sfx(g.ev.id === 'coupon' ? 'coupon' : 'card');
      vibe(20);
    }
  }
  if (prev.gid === g.gid && g.log.length > prev.log) {
    const l = g.log[g.log.length - 1];
    if (S.phase !== 'auction' || window.BB_FAST)
      toast(
        l.who
          ? `💰 ${nm(S, l.who)} $${l.amt}${l.full ? `（💸 原價 $${l.full}）` : ''}・${String(l.n).split(' ').slice(-1)[0]}${l.slot && !String(l.n).includes(l.slot) ? `（${l.slot}）` : ''}`
          : `🙅 ${l.n} 流標`
      );
    vibe(30);
    if (l.who) {
      sfx('sold');
      if (l.full) sfx('coupon', 0.25);
      if (mine(l.who) && me !== 'all') sfx('win', 0.14);
    } else sfx('pass');
    if (S.phase === 'auction' && prev.idx != null && g.idx > prev.idx && !window.BB_FAST) {
      const hm = clamp((g.gapEnd || 0) - now(), 300, 3800);
      ui.hold = { gid: g.gid, k: prev.idx, l, at: Date.now(), until: Date.now() + hm };
      clearTimeout(ui.holdT);
      ui.holdT = setTimeout(() => {
        ui.hold = null;
        render();
      }, hm + 10);
    }
  } else if (g.bid.amt > prev.bid) vibe(12);
}
setInterval(() => {
  snapPrev = snapOf();
  tickAuth();
  tickBots();
}, 250);
/* new-version check: browsers cache the page and a tab left open keeps the old copy, so look for a newer build when the
   app opens or comes back to the foreground (at most every 5 minutes) and offer a one-tap reload, never a forced one */
let NEWV = null,
  lastChk = 0;
async function checkUpdate() {
  if (location.protocol !== 'https:' || NEWV || Date.now() - lastChk < 300000) return;
  lastChk = Date.now();
  try {
    const t = await (await fetch(location.pathname + '?v=' + Date.now(), { cache: 'no-store' })).text(),
      m = /APP[V]\s*=\s*'([^']+)'/.exec(t);
    if (m && m[1] !== APPV) {
      NEWV = m[1];
      render();
    }
  } catch (e) {}
}
setTimeout(checkUpdate, 3000);
setInterval(checkUpdate, 600000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkUpdate();
});
