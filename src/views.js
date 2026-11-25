/* ---------- views ---------- */
let ui = {
  quit: false,
  sel: null,
  themeOpen: false,
  reveal: new Set(),
  amt: {},
  pb: null,
  pbDone: new Set(),
  pbSp: null
};
let tt;
function toast(msg, ms = 1900) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('show'), ms);
}
const fmt = v => (v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1));
const yrs = p => {
  if (!p.y0) return '';
  const s = y => String(y % 100).padStart(2, '0');
  return p.y0 === p.y1 ? `${p.y0 - 1}-${s(p.y0)}` : `${p.y0 - 1}–${s(p.y1)}`;
};
const sub = p => (p.nostat ? '查無資料・以替補水準計算' : [p.tm, yrs(p)].filter(Boolean).join(' · '));
const myRole = () => (S ? roleOf(S, CID) : 'spec');
const col = s => `var(--${{ A: 'a', B: 'b', C: 'c3' }[s]})`;
const pend = () =>
  NET.mode === 'guest' && NET.pending.length ? '<span class="spin" style="margin-left:6px"></span>' : '';
function render() {
  const app = document.getElementById('app');
  let html;
  if (S && S.phase === 'results' && typeof logRecord === 'function') logRecord();
  if (!THEMES.length)
    html = `<div class="center mut" style="margin-top:80px"><span class="spin"></span> 載入球員資料…</div>`;
  else if (!S || !NET.mode) html = `<div id="scr-home" class="screen">${vHome()}</div>`;
  else if (lastView())
    html =
      vRoomBar() +
      withView(
        () => `<div id="scr-results${S.game.gid}" class="screen ${ui.pbFast ? 'fastrs' : ''}">${vResults()}</div>`
      );
  else
    html =
      vRoomBar() +
      `<div id="scr-${S.phase}${S.game ? S.game.gid : ''}" class="screen ${S.phase === 'results' && ui.pbFast ? 'fastrs' : ''}">${({ lobby: vLobby, cards: vCards, mission: vMission, auction: vAuction, lineup: vLineup, results: vResults, season: vSeason }[S.phase] || vLobby)()}</div>` +
      (S.phase === 'auction' && S.game ? cardFlash(S.game) + cardSheet() : '');
  if (NEWV)
    html =
      `<button class="updb" data-act="reload">有新版本，點這裡更新${S && S.phase === 'auction' ? '（這局打完再按也可以）' : ''}</button>` +
      html;
  const next = document.createElement('div');
  next.id = 'app';
  next.className = 'wrap';
  next.innerHTML = html;
  if (window.morphdom)
    morphdom(app, next, {
      onBeforeElUpdated: (f, t) => {
        if (f === document.activeElement && (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA')) return false;
        if (f.isEqualNode && f.isEqualNode(t)) return false;
        if (f.dataset && f.dataset.counting) return false;
        return true;
      }
    });
  else app.innerHTML = html;
  runCounters();
  updateClocks();
}
const tickSeen = {};
function updateClocks() {
  document.querySelectorAll('[data-end]').forEach(el => {
    const end = +el.dataset.end,
      tot = +el.dataset.tot,
      r = Math.max(0, end - now());
    if (el.dataset.tick && r > 0 && r <= 3200) {
      const sec = Math.ceil(r / 1000);
      if (tickSeen[end] !== sec) {
        tickSeen[end] = sec;
        sfx(sec <= 1 ? 'last' : 'tick');
      }
    }
    const t = el.querySelector('.tx');
    if (t) t.textContent = (r / 1000).toFixed(r < 10000 ? 1 : 0);
    const b = el.querySelector('i');
    if (b) b.style.width = (100 * r) / tot + '%';
  });
}
setInterval(updateClocks, 200);
const counted = new Set();
function runCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    if (counted.has(el.id)) return;
    counted.add(el.id);
    const to = +el.dataset.count,
      delay = +(el.dataset.delay || 0) * 1000,
      dur = 900;
    el.dataset.counting = '1';
    el.textContent = '0';
    setTimeout(() => {
      const t0 = performance.now();
      const step = t => {
        const k = Math.min(1, (t - t0) / dur),
          e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(to * e);
        if (k < 1) requestAnimationFrame(step);
        else delete el.dataset.counting;
      };
      requestAnimationFrame(step);
    }, delay);
  });
}
function vHome() {
  const hm = /^#room-([a-z0-9]{6})(?:-(\d))?$/.exec(location.hash || ''),
    inv = hm && hm[1],
    last = (lsGet('bb_room') || '').split('-')[0];
  return `<header class="hero"><div class="logo">🏀</div><h1>BALLER<br><b>BID!</b></h1><div class="sub">球星喊價</div>
  <p>用有限預算標下 NBA 球星，最後用真實數據模擬對戰。2～3 人一起玩，也能一個人挑戰電腦。</p></header>
  ${
    inv
      ? `<section class="card invite" style="border-color:var(--acc)"><div class="small mut">你被邀請加入房間</div><div class="code">${esc(inv.toUpperCase())}</div>
    <input data-in="myname" maxlength="14" placeholder="輸入你的名字" value="${esc(MYNAME)}" style="margin-top:12px;text-align:center">
    <button class="big" data-act="joinhash" ${NET.busy ? 'disabled' : ''}>${NET.busy ? '<span class="spin"></span> 連線中…' : '加入房間 →'}</button></section>`
      : `<section class="card"><h2>你的名字</h2><input data-in="myname" maxlength="14" placeholder="例如：Jerry" value="${esc(MYNAME)}"></section>`
  }
  ${NET.err ? `<div class="err">${esc(NET.err)}</div>` : ''}
  <button class="mode hot" data-act="create" ${NET.busy ? 'disabled' : ''}><span class="ic">🌐</span><span><b>線上對戰</b><span>產生邀請連結，朋友點開就能加入，不用登入</span></span></button>
  <button class="mode" data-act="ai"><span class="ic">🤖</span><span><b>挑戰電腦</b><span>一個人玩：跟 1～2 位 AI 總管搶球星</span></span></button>
  <button class="mode" data-act="local"><span class="ic">📱</span><span><b>同一台手機玩</b><span>大家輪流用一支手機出價</span></span></button>
  ${
    inv
      ? ''
      : `<section class="card"><h2>用房號加入</h2>
    <div class="row"><input data-in="code" maxlength="6" placeholder="6 位房號" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800" value="${esc(last || '')}">
    <button class="chip on" data-act="join" ${NET.busy ? 'disabled' : ''} style="flex:none">${NET.busy ? '<span class="spin"></span>' : '加入'}</button></div>
    <div class="small mut" style="margin-top:6px">重新整理或斷線後，用同一個房號就能回到房間。</div></section>`
  }
  ${rulesCard()}`;
}
/* 玩法: a small tabbed guide instead of one long list. 快速上手 is the default (the four things you need to play);
   the other tabs are short key-and-one-line entries so a rule can be found at a glance. */
const RULE_TABS = [
  ['quick', '入門'],
  ['card', '卡片'],
  ['auction', '拍賣'],
  ['tac', '戰術'],
  ['score', '勝負'],
  ['more', '更多']
];
function rulesBody(t) {
  const R = (k, v) => `<div class="rk"><b>${k}</b><span>${v}</span></div>`;
  if (t === 'card')
    return (
      R(
        '攻守貢獻',
        '卡片上方的數字（45–99）：這張卡<b>那一季</b>對贏球的貢獻，看的是攻守效率（BPM），不是得分。比賽用的就是這個數字，電腦估價也用它。同一位球星不同年份的卡，數字會不一樣。'
      ) +
      R('生涯資料', '榮譽、場均得分籃板助攻、生涯階段標籤是整個生涯的，幫你判斷名氣和球風；強不強看攻守貢獻。') +
      R('生涯階段', '新秀年、生涯早期、巔峰期（最強五季）、生涯晚期。巔峰期通常比生涯平均更強。') +
      R('爆發型', 'MVP、FMVP、兩屆以上年度一隊或 8 次以上全明星。每場約 5–7% 機會接管比賽，一隊每場最多 25%。') +
      R('年份、估', "'92 是卡片球季（進階設定可關）。標「估」的是 1974 年前推估的數據。")
    );
  if (t === 'auction')
    return (
      R(
        '一般喊價',
        '輪流出價（三人蛇形），輪到你就喊或按「不要」。沒人出價 20 秒、有人出價後 15 秒沒動作，就算不要。'
      ) +
      R('暗標', '大家同時偷偷出價，最高價得標。平手加賽一次，再平手由空位多的一方得標。') +
      R('降價搶標', '標價一路往下掉，第一個按的人用當下價格買走。降到 $1 還沒人要就流標。') +
      R('看牌時間', '每張卡先停幾秒才能出價（大廳可調），電腦也要等。大家都按「看好了」就提早開始。') +
      R('輪流提名', '（選用）桌上翻 4 張，輪到的人挑一張拿出來拍。') +
      R('牌序', '明星比較容易早點出現，但任何牌都可能早或晚出。牌堆比空位多出來的那幾張是最弱的，一定在最後。') +
      R(
        '流標與補牌',
        '沒人要的牌流標，接下來 1～3 張內會補一張明星（🔔），最多 3 張。牌用完還缺人就補自由球員（$0）。'
      ) +
      R(
        '最後一隊',
        '其他人都滿了，剩下的牌全部翻開，照標價自己挑（大約是那張卡在拍賣會賣的價錢），不想買就用自由球員補。'
      )
    );
  if (t === 'tac')
    return (
      `<div class="rtip" style="margin:0 0 8px">戰術是<b>建隊方針</b>：先想好要打哪一套，拍賣時就照它買人。排陣時選一套進攻、一套防守。</div>` +
      R(
        '契合度',
        '戰術旁的數字（0–100）：你的先發五人比幾 % 的隨機陣容更適合這套。45 左右等於沒加成，越高加越多、越低反而扣分；100 和 99 只差 0.02 分。選中後會直接寫出加成。'
      ) +
      R(
        '加成多大',
        '契合度最多約 +1.3（進攻）、+0.9（防守），持球核心再加最多 +1.2，克制約 ±1.3。總評每 1 分 ≈ 每場多 0.8 分，所以能翻轉接近的對戰，翻不了實力差很多的。'
      ) +
      R(
        '五外拉開',
        '五人都站外線投三分、切入。最關鍵是 PF、C 也要會投（看卡上的「三分射手」「空間型長人」）。例：勇士死亡五小、2024 塞爾提克。好打區域聯防、護框收縮；怕全員換防。變數大，適合弱隊賭一把。'
      ) +
      R(
        '持球核心',
        '一位又能得分又能傳的球星＋四個射手（Harden 火箭、Luka 獨行俠、LeBron）。核心比隊友強越多越好，他接管比賽的機會 ×1.6。好打護框收縮、也能找換防的錯位單打；怕包夾。'
      ) +
      R(
        '擋拆雙人組',
        '會傳的後衛＋會順下（籃板好、灌籃）或外彈（會投）的長人，旁邊放射手。例：Stockton-Malone、Nash-Stoudemire、CP3-Chandler。好打護框收縮、包夾（長人接球後 4 打 3）；怕全員換防。'
      ) +
      R(
        '內線強攻',
        '球往禁區送：低位得分手（「禁區殺手」）、籃板好的長人，兩個長人更好。例：俠客湖人、灰熊雙塔。好打換防和包夾（小個子守不住）；怕護框收縮、區域聯防。'
      ) +
      R(
        '跑轟快攻',
        '抄截、搶到籃板就快攻：抄截高手、會傳的後衛、跑得動的鋒線。例：Showtime 湖人、7 秒太陽。比分比較穩，強隊不容易被爆冷。怕包夾壓迫。'
      ) +
      R('傳導進攻', '三位以上會傳球、沒人特別霸球，不停傳導。例：2014 馬刺。好打區域聯防、包夾；怕全員換防。') +
      R(
        '全員換防',
        '五人都能守多個位置（卡上能打三個位置以上）。剋擋拆、五外、傳導；怕內線錯位，也會被持球核心找錯位單打。'
      ) +
      R('護框收縮', '靠一位護框長人（「護框長人」）守籃下。剋內線強攻；怕持球核心拔起來投、會外彈的長人。') +
      R('區域聯防', '護框長人＋外圍有人能抄，塞住禁區、藏住弱防守者。剋內線、持球核心；怕五外和傳導。') +
      R('包夾壓迫', '抄截高手和防守好的人去包夾持球者。剋持球核心、跑轟、五外；怕擋拆、內線和傳導。變數大。') +
      R('不是絕對', '克制只是傾向：每場執行度不同，輸球的一方會調整，下一場對手的克制優勢少兩成。')
    );
  if (t === 'score')
    return (
      R('實力', '先發五人的攻守貢獻（該季 BPM）加總，用 1,230 支真實球隊校正。總評每差 1 分，每場約差 0.8 分。') +
      R('位置與對位', '放到不熟的位置會打折。同位置一對一：小個子有速度，大個子有籃板和低位。') +
      R('球權重疊', '太多需要球的得分手同時上場會互相卡，扣分。') +
      R('化學', '真實當過隊友加分、五人都能換防加分、有紀錄的隊內不合扣分。三巨頭或王朝核心另加 0.8–2。') +
      R('省錢', '沒花完的錢每 $1 加 0.3，最多 2.5。') +
      R('戰術', '排陣時選一套進攻、一套防守，細節看「戰術」分頁。') +
      R('單場變數', '球星接管（球隊那場多約 4 分）、角色球員爆發之夜，加上每場約 ±13 分的運氣，所以系列賽會爆冷。')
    );
  if (t === 'more')
    return (
      R(
        '挑戰電腦',
        '跟 1～2 位電腦總管對戰。難度：新手常亂出價；普通看陣容缺什麼；高手還會做任務、精算暗標、猜你的戰術。'
      ) +
      R(
        '電腦風格',
        '穩健派（平均分配）、巨星控（重金買最強幾張）、精算師（買深度）、體系派（先定戰術再買拼圖）、撿便宜（只買被低估的人）、衝鋒派（開局就砸錢）、耐心派（後面才出手）、名氣派（看榮譽和得分，常高估刷分王）、攪局者（抬高你想要的牌）。隨機時有時是兩種混搭，名字會寫出來，你可以針對它。'
      ) +
      R(
        '公平',
        '電腦看不到還沒翻的牌、主題名單、你的任務、暗標、戰術，也看不到其他電腦的底價；它讀球員只用卡面上看得到的東西。'
      ) +
      R('能力卡', '（選用）開局 4 選 2，每張用一次：換一張、打折券（85 折）、主場優勢（+1）、球探報告。') +
      R('任務卡', '（選用）3 選 1，保密到結算，達成加戰力。') +
      R(
        '季賽',
        '（選用）連打 3／5／7 局。冠軍 3 分、三人第二 1 分、兩人輸家打滿七場 1 分，任務 +1。可開平衡：上局冠軍預算 −10%、墊底 +10%。'
      ) +
      R('替補（10 人）', '5 個替補分成替補後衛、替補鋒線、第六人，各至少 1 位，第六人只能 1 位。影響力約先發的 1/4。') +
      R('遊戲紀錄', '每局自動存在這台手機（最近 80 局，不上傳）。結果頁可匯出給 Claude 分析。') +
      R('版本・數據', `${APPV}・Basketball-Reference`)
    );
  return `<ol class="rq"><li><b>出價</b>輪到你就喊價或按「不要」，其他人都不要時，最高價得標。</li>
    <li><b>預算</b>每個空位至少留 $1，沒花完的錢會小加分。</li>
    <li><b>排陣</b>把球員放到他會打的位置，再選一套進攻和防守戰術。</li>
    <li><b>對戰</b>每兩隊打七戰四勝，系列賽贏最多的奪冠。</li></ol>
    <div class="rtip">看卡只要記一件事：<b>攻守貢獻</b>越高越能贏球，得分高不等於貢獻高。</div>`;
}
function rulesCard() {
  const open = !!ui.rulesOpen,
    t = ui.rtab || 'quick';
  return `<section class="card rules"><button class="rhd" data-act="rules" aria-expanded="${open}"><span>玩法說明</span><span class="mut">${open ? '收起' : '展開'}</span></button>
  ${
    open
      ? `<div class="rtabs" role="tablist">${RULE_TABS.map(([k, l]) => `<button role="tab" class="${k === t ? 'on' : ''}" data-act="rtab" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="rbody">${rulesBody(t)}</div>`
      : ''
  }</section>`;
}
function vRoomBar() {
  if (NET.mode === 'ai')
    return `<div class="roombar"><span>🤖 挑戰電腦・${esc(botLv().nm)}</span><span class="grow"></span>${sfxBtn()}<button class="small mut" data-act="exit">離開</button></div>`;
  if (NET.mode === 'local')
    return `<div class="roombar"><span>📱 同一台手機</span><span class="grow"></span>${sfxBtn()}<button class="small mut" data-act="exit">離開</button></div>`;
  const r = myRole(),
    label = ALL.includes(r) ? nm(S, r) : '觀眾';
  return `<div class="roombar"><span class="mut">房號</span><span class="code">${esc((NET.code || '').toUpperCase())}</span><span class="grow small">你是 <b>${esc(label)}</b>${pend()}</span>${sfxBtn()}<button class="small mut" data-act="exit">離開</button></div>${ui.verWarn ? '<div class="err">⚠️ 你和房間裡其他人的遊戲版本不同，可能會出錯。請大家都重新整理網頁後再開房。</div>' : ''}
  ${NET.conn === false ? `<div class="err"><span class="spin"></span> 網路斷線，重新連線中…</div>` : ''}${NET.err ? `<div class="err">${esc(NET.err)}</div>` : ''}
  ${NET.mode === 'host' && S.phase !== 'results' ? `<div class="note" style="margin-top:8px">📌 遊戲由你的手機運算，請保持畫面開著。如果你斷線，其他玩家會在 15 秒後自動接手。</div>` : ''}`;
}
function seatRow(k) {
  const s = S.seats[k],
    me = s && s.cid === CID,
    on = s && (s.cid === CID || onlineSet().has(s.cid));
  const btn = !s
    ? `<button data-act="seat" data-v="${k}">坐這裡</button>`
    : me
      ? `<button data-act="seat" data-v="spec" style="background:#fff;color:var(--mut);border:1.5px solid var(--line)">離座</button>`
      : '';
  const watching = s && S.last && !(S.back && S.back[s.cid]) && !me;
  return `<div class="seat ${k} ${me ? 'me' : ''}"><span class="lab">玩家 ${k}</span><span class="who">${s ? `<span class="dot ${watching && on ? 'pulse' : ''}" style="background:${!on ? '#bbb' : watching ? 'var(--acc)' : 'var(--ok)'}"></span> ${esc(s.name)}${me ? '（你）' : ''}${watching && on ? ' <span class="small" style="color:#d9730d">結算畫面中</span>' : !on ? ' <span class="small mut">離線</span>' : ''}` : '<span class="mut">空位</span>'}</span>${btn}</div>`;
}
function vLobby() {
  const c = S.cfg,
    r = myRole(),
    isP = r === 'all' || ALL.includes(r),
    sides = sidesOf(c.players),
    dis0 = S.season ? 'disabled' : '';
  let top = '';
  if (NET.mode === 'ai') top = aiLobby(sides, dis0);
  else if (NET.mode === 'local')
    top = `<section class="card"><h2>玩家</h2>${sides.map(s => `<div class="row" style="margin-bottom:8px"><span class="dot" style="background:${col(s)}"></span><input data-in="name" data-i="${s}" maxlength="12" value="${esc(S.names[s])}"></div>`).join('')}</section>`;
  else
    top = `<section class="card invite"><div class="small mut">房號</div><div class="code">${esc(NET.code.toUpperCase())}</div>
      <button class="big" data-act="share">📨 傳送邀請連結</button><div class="small mut" style="margin-top:8px;word-break:break-all">${esc(inviteLink())}</div>
      <div class="small mut" style="margin-top:6px">🔒 對戰內容有加密，只有拿到房號的人看得到。</div></section>
    <section class="card"><h2>座位</h2><div class="seats">${sides.map(seatRow).join('')}</div></section>`;
  const dis = !isP ? 'disabled' : '';
  const mode = c.theme === 'random' ? 'random' : c.theme === 'custom' ? 'custom' : 'pick';
  let themeBox = `<div class="seg mode">${[
    ['random', '🎲 隨機'],
    ['pick', '📌 指定'],
    ['custom', '✏️ 自訂']
  ]
    .map(
      ([k, l]) => `<button class="chip ${mode === k ? 'on' : ''}" data-act="tmode" data-v="${k}" ${dis}>${l}</button>`
    )
    .join('')}</div>`;
  if (mode === 'random') {
    const pool = randPool(c),
      era = c.era || [0, 0],
      need = c.players * (c.size || 5);
    const decOpt = (sel, first) =>
      `<option value="">${first}</option>` +
      DECS.map(d => `<option value="${d}" ${sel === d ? 'selected' : ''}>${d} 年代</option>`).join('');
    const rows = CATS.map(k => {
      const on = c.cats.includes(k),
        n = catPool(c, k).length;
      const why = n ? '' : catCands(c, k).length ? `合併後也不到 ${need} 人` : '這個年代沒有';
      return `<button class="crow ${on ? 'on' : ''} ${on && !n ? 'zero' : ''}" data-act="cat" data-v="${k}" ${dis}><span class="ck">${on ? '✓' : ''}</span><span class="grow"><b>${CATNAME[k]}</b><small>${CATDESC[k]}</small></span><span class="cn">${n ? (on ? `${n} 個` : `<small>${n} 個</small>`) : `<small>0 個${on ? '<br>' + why : ''}</small>`}</span></button>`;
    }).join('');
    const nc = c.cats.length;
    themeBox += `<div class="small mut" style="margin:12px 0 6px">點卡片勾選類別（可複選）。開始時從勾選的類別裡抽一個主題，大家都不知道是哪個。${(c.size || 5) === 10 || c.players === 3 ? '人數不夠的主題，抽到時會自動合併同隊或相近年份的主題。' : ''}</div><div class="crows">${rows}</div>
      <div class="frow"><span class="fl">年代</span><div class="sel2"><select data-in="era0" ${dis}>${decOpt(c.era ? era[0] : null, '不限')}</select><span class="mut">到</span><select data-in="era1" ${dis}>${decOpt(c.era ? era[1] : null, '不限')}</select></div></div>
      <div class="small mut fh">選填。只影響有年代的類別，「特別」不受影響。</div>
      <div class="rtot ${pool.length ? '' : 'bad'}">${pool.length ? `🎲 共 ${pool.length} 個主題，開始時抽一個` : !nc ? '還沒勾選類別：點上面的卡片勾選' : '勾選的類別在這個年代沒有主題，請放寬年代或多勾幾類'}</div>
      <div class="small mut" style="margin-top:8px;text-align:center">想指定球隊或某幾屆？用上面的「📌 指定」，也可以設定成保密抽一個。</div>`;
  } else if (mode === 'pick') {
    const cat = c.pcat || '夢幻隊',
      picks = c.picks || [],
      list = THEMES.filter(t => t.cat === cat),
      pp = pickPool(picks),
      need = c.players * (c.size || 5);
    const opt = t =>
      `<option value="${t.id}" ${picks.includes(t.id) ? 'disabled' : ''}>${esc(t.name)}${picks.includes(t.id) ? '（已選）' : ''}</option>`;
    let ctl;
    if (cat === '夢幻隊')
      ctl = `<div class="seg ychips">${list
        .filter(t => t.id !== 'usaall')
        .map(t => {
          const on = picks.includes(t.id);
          return `<button class="chip ${on ? 'on' : ''}" data-act="ptog" data-v="${t.id}" ${dis}>${esc(t.name.replace(/（.*）/, ''))}</button>`;
        })
        .join('')}
      <button class="chip" data-act="pall" ${dis}>全選</button></div>`;
    else {
      let opts;
      if (cat === '隊史') {
        const by = {};
        list.forEach(t => {
          const k = t.fr || '';
          (by[k] = by[k] || []).push(t);
        });
        opts = Object.keys(FRZH)
          .filter(k => by[k])
          .map(
            k =>
              `<optgroup label="${FRZH[k]}">${by[k]
                .sort((x, y) => (/\d{4}$/.test(x.id) ? 1 : 0) - (/\d{4}$/.test(y.id) ? 1 : 0) || x.y0 - y.y0)
                .map(opt)
                .join('')}</optgroup>`
          )
          .join('');
      } else if (cat === '陣容')
        opts = list
          .filter(t => t.grp)
          .map(
            t =>
              `<option value="${t.id}" ${picks.includes(t.id) ? 'disabled' : ''}>${esc(t.name)}（${t.tag.match(/^\d+/)[0]} 隊・${t.items.length} 人）${picks.includes(t.id) ? '（已選）' : ''}</option>`
          )
          .join('');
      else opts = list.map(opt).join('');
      ctl = `<select data-in="ptheme" ${dis}><option value="">＋ 加入${cat === '陣容' ? '年代' : '主題'}…</option>${opts}</select>`;
    }
    const chosen = pp.ts.length
      ? `<div class="picked">${pp.ts.map(t => `<span class="pk">${esc(t.name)}<button data-act="pdel" data-v="${t.id}" ${dis} aria-label="移除">×</button></span>`).join('')}</div>${pp.ts
          .filter(t => t.grp)
          .map(
            t =>
              `<div class="small mut" style="margin-top:6px">${esc(t.name)}：${esc(t.tag.split('：')[1].split('・')[0])}</div>`
          )
          .join('')}`
      : '';
    const one = c.pmode === 'one',
      okOne = pp.ts.filter(t => themeOk(t, c)),
      enough = one ? okOne.length > 0 : pp.items.length >= need;
    const modeSel =
      pp.ts.length > 1
        ? `<div class="seg pmode" style="margin-top:10px">${[
            ['merge', '合併成一個卡池'],
            ['one', '🎲 保密抽其中一個']
          ]
            .map(
              ([k, l]) =>
                `<button class="chip ${(one ? 'one' : 'merge') === k ? 'on' : ''}" data-act="cfg" data-k="pmode" data-v="${k}" ${dis}>${l}</button>`
            )
            .join('')}</div>`
        : '';
    themeBox += `<div class="frow"><span class="fl">類別</span><select data-in="pcat" ${dis}>${CATS.map(k => `<option value="${k}" ${k === cat ? 'selected' : ''}>${CATNAME[k]}</option>`).join('')}</select></div>
      <div style="margin-top:10px">${ctl}</div>${chosen}${modeSel}
      <div class="small ${pp.ts.length && !enough ? 'errt' : 'mut'}" style="margin-top:8px">${
        !pp.ts.length
          ? '可以選一個，也可以跨類別選好幾個（例如 2010 年代老鷹＋2010 年代塞爾提克）。'
          : one && pp.ts.length > 1
            ? `開始時從 ${okOne.length} 個主題裡抽一個${okOne.length < pp.ts.length ? `（${pp.ts.length - okOne.length} 個不到 ${need} 人，不會被抽到）` : ''}` +
              (enough ? ' ✓' : `<br>⚠️ 選的主題都不到 ${need} 人，請改用合併或多選幾個`)
            : `卡池 ${pp.items.length} 人${pp.ts.length > 1 ? '（重複的球員只留數據最好的那個版本）' : ''}・${c.players} 人${c.size === 10 ? '夢幻隊模式' : ''}需要 ${need} 人` +
              (enough ? ' ✓' : `<br>⚠️ 卡池太少人，請多選幾個${cat === '夢幻隊' ? '年份' : '主題'}才能玩`)
      }</div>
      <div class="small" style="margin-top:6px;color:#b26a00">${one && pp.ts.length > 1 ? '🤫 大家知道候選名單，但不知道抽到哪一個' : '⚠️ 所有人都會知道主題'}</div>`;
  } else themeBox += `<div class="small mut" style="margin-top:10px">自己打名單，抓每個人的生涯巔峰 5 季數據。</div>`;
  if (c.theme === 'custom') {
    const pc = parseCustom(c.custom.text);
    themeBox += `<div style="margin-top:12px"><input data-in="cname" placeholder="主題名稱" value="${esc(c.custom.name)}" ${dis}>
    <textarea data-in="ctext" style="margin-top:8px" placeholder="一行一位，可加位置：&#10;Stephen Curry, PG&#10;Klay Thompson&#10;Dennis Rodman, PF" ${dis}>${esc(c.custom.text)}</textarea>
    <div class="small mut" style="margin-top:6px">已辨識 ${pc.filter(x => !x.nostat).length} / ${pc.length} 位・至少 ${c.players * 5} 位</div></div>`;
  }
  const L = poolLenFor(c);
  const play = `<section class="card"><h2>玩法</h2><div class="otiles">
      <button class="otile ${c.mis ? 'on' : ''}" data-act="cfg" data-k="mis" data-v="${c.mis ? 0 : 1}" ${dis}><span class="oic">🎯</span><b>任務卡</b><small>每局 3 選 1，完成就加戰力</small><span class="osw"></span></button>
      <button class="otile ${c.cards ? 'on' : ''}" data-act="cfg" data-k="cards" data-v="${c.cards ? 0 : 1}" ${dis}><span class="oic">🃏</span><b>能力卡</b><small>每局 4 選 2，換牌、打折、主場、球探</small><span class="osw"></span></button>
      <button class="otile ${c.season ? 'on' : ''}" data-act="cfg" data-k="season" data-v="${c.season ? 0 : 5}" ${dis}><span class="oic">🏁</span><b>季賽</b><small>同一群人連打多局拼積分</small><span class="osw"></span></button></div>
      ${
        c.season
          ? `<div class="frow" style="margin-top:12px"><span class="fl">局數</span><div class="seg">${SEASON_N.map(n => `<button class="chip ${c.season === n ? 'on' : ''}" data-act="cfg" data-k="season" data-v="${n}" ${dis}>${n} 局</button>`).join('')}</div></div>
      <button class="crow ${c.bal !== false ? 'on' : ''}" style="margin-top:10px" data-act="cfg" data-k="bal" data-v="${c.bal !== false ? 0 : 1}" ${dis}><span class="ck">${c.bal !== false ? '✓' : ''}</span><span class="grow"><b>平衡機制</b><small>上局冠軍下一局預算 −10%，積分墊底 +10%</small></span></button>
      <div class="small mut" style="margin-top:8px">積分：冠軍 3 分${c.players === 3 ? '、第二名 1 分' : '、輸家打滿七場拿 1 分'}${c.mis ? '、完成任務 +1（★★★ +2）' : ''}。每局換新主題${c.theme === 'random' || c.pmode === 'one' ? '，同一季不重複' : ''}。</div>`
          : ''
      }
      ${c.mis && !c.season ? '<div class="small mut" style="margin-top:8px">任務保密，只有自己看得到，結算時才揭曉。</div>' : ''}${fmtLobby(c, dis)}</section>`;
  const cfg =
    play +
    `<section class="card"><h2>${NET.mode === 'ai' ? '對手' : '人數'}</h2><div class="seg">${[2, 3].map(n => `<button class="chip ${c.players === n ? 'on' : ''}" data-act="cfg" data-k="players" data-v="${n}" ${dis}>${NET.mode === 'ai' ? `${n - 1} 位電腦` : `${n} 人`}</button>`).join('')}</div></section>
    <section class="card"><h2>陣容</h2><div class="seg">${[
      [5, '正規 5 人'],
      [10, '夢幻隊模式 10 人']
    ]
      .map(
        ([n, l]) =>
          `<button class="chip ${(c.size || 5) === n ? 'on' : ''}" data-act="cfg" data-k="size" data-v="${n}" ${dis}>${l}</button>`
      )
      .join('')}</div>
      <div class="small mut" style="margin-top:6px">${(c.size || 5) === 10 ? `5 先發＋5 替補，每人要標 10 位，卡池至少要 ${c.players * 10} 人。建議預算 $${c.players === 3 ? 30 : 25} 以上。` : '5 位先發，標滿就開打。'}</div></section>
    <section class="card"><h2>每人預算</h2><div class="row wrapx">${[10, 15, 20, 25].map(b => `<button class="chip ${c.budget === b ? 'on' : ''}" data-act="cfg" data-k="budget" data-v="${b}" ${dis}>$${b}</button>`).join('')}
      <input data-in="budget" type="number" min="5" max="999" inputmode="numeric" style="width:90px" placeholder="自訂" value="${[10, 15, 20, 25].includes(c.budget) ? '' : c.budget}" ${dis}></div></section>
    <section class="card"><h2>主題</h2>${themeBox}</section>
    ${L ? `<section class="card"><h2>翻牌數量</h2><div class="row"><div class="stepper"><button data-act="cfg" data-k="draw" data-v="${c.draw - 1}" ${dis}>−</button><div class="v">${c.draw}</div><button data-act="cfg" data-k="draw" data-v="${c.draw + 1}" ${dis}>+</button></div><div class="small mut grow">張（主題共 ${L} 位）<br>每個位置保證至少 ${(c.players * (c.size || 5)) / 5} 位能打的人</div></div></section>` : ''}
    <section class="card"><h2>看牌時間</h2><div class="row wrapx">${READ_OPTS.map(x => `<button class="chip ${(c.read == null ? 5 : c.read) === x ? 'on' : ''}" data-act="cfg" data-k="read" data-v="${x}" ${dis}>${x ? x + ' 秒' : '不停'}</button>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">每張卡翻開後先停幾秒讓大家看清楚，倒數完才能出價（電腦也一樣要等）。大家都按「看好了」就提早開始。</div></section>
    <section class="card"><h2>進階</h2><div class="seg">
      <button class="chip ${c.showStats ? 'on' : ''}" data-act="cfg" data-k="showStats" data-v="${c.showStats ? 0 : 1}" ${dis}>${c.showStats ? '✓ ' : ''}競標時顯示數據</button>
      <button class="chip ${c.hints ? 'on' : ''}" data-act="cfg" data-k="hints" data-v="${c.hints ? 0 : 1}" ${dis}>${c.hints ? '✓ ' : ''}競標時提示隊友／不合</button>
      <button class="chip ${c.showYr !== false ? 'on' : ''}" data-act="cfg" data-k="showYr" data-v="${c.showYr !== false ? 0 : 1}" ${dis}>${c.showYr !== false ? '✓ ' : ''}卡片顯示球季年份</button>
      <button class="chip ${c.ovr !== false ? 'on' : ''}" data-act="cfg" data-k="ovr" data-v="${c.ovr !== false ? 0 : 1}" ${dis}>${c.ovr !== false ? '✓ ' : ''}卡片顯示攻守貢獻（關掉就只看生涯資料猜）</button></div>
      <div class="small mut" style="margin-top:6px">前兩個會透露主題的球隊和年代，預設關閉。年份只透露年代，預設開啟；想更神秘可以關掉。每張卡都會標巔峰期／生涯早期／生涯晚期。</div></section>
    ${S.err ? `<div class="err">${esc(S.err)}</div>` : ''}
    ${isP ? (waitingFor().length ? `<button class="big" disabled>等 ${esc(waitingFor().join('、'))} 看完結算…</button>` : `<button class="big" data-act="start">${c.season ? `開始季賽（${c.season} 局）→` : '開始競標 →'}</button>`) : `<div class="note">觀眾無法變更設定。</div>`}`;
  const sc = Object.values(S.scores || {}).sort((a, b) => b.w - a.w);
  const scores = sc.length
    ? `<section class="card"><div class="row"><h2 class="grow" style="margin:0">🏆 戰績</h2>${isP ? '<button class="small mut" data-act="resetScores">清除</button>' : ''}</div><div style="margin-top:8px">${sc.map(o => `<div class="score"><span>${esc(o.n)}</span><b class="num" style="font-size:20px">${o.w} 冠${o.st ? `<small style="font-size:13px;margin-left:6px;color:var(--gold)">🏁 ${o.st} 季冠</small>` : ''}</b></div>`).join('')}</div></section>`
    : '';
  return top + lastSeasonCard() + cfg + scores + rulesCard();
}
/* ---------- short player intro (from Basketball-Reference awards & career totals) ---------- */
const TEAMZH = {
  ATL: '老鷹',
  STL: '老鷹',
  MLH: '老鷹',
  TRI: '老鷹',
  BOS: '塞爾提克',
  BRK: '籃網',
  NJN: '籃網',
  NYN: '籃網',
  CHA: '黃蜂',
  CHO: '黃蜂',
  CHH: '黃蜂',
  CHI: '公牛',
  CLE: '騎士',
  DAL: '獨行俠',
  DEN: '金塊',
  DNN: '金塊',
  DET: '活塞',
  FTW: '活塞',
  GSW: '勇士',
  SFW: '勇士',
  PHW: '勇士',
  HOU: '火箭',
  SDR: '火箭',
  IND: '溜馬',
  LAC: '快艇',
  SDC: '快艇',
  BUF: '快艇',
  LAL: '湖人',
  MNL: '湖人',
  MEM: '灰熊',
  VAN: '灰熊',
  MIA: '熱火',
  MIL: '公鹿',
  MIN: '灰狼',
  NOP: '鵜鶘',
  NOH: '黃蜂',
  NOK: '黃蜂',
  NYK: '尼克',
  OKC: '雷霆',
  SEA: '超音速',
  ORL: '魔術',
  PHI: '76人',
  SYR: '國民',
  PHO: '太陽',
  POR: '拓荒者',
  SAC: '國王',
  KCK: '國王',
  KCO: '國王',
  CIN: '皇家',
  ROC: '皇家',
  SAS: '馬刺',
  SAA: '馬刺',
  TOR: '暴龍',
  UTA: '爵士',
  NOJ: '爵士',
  WAS: '巫師',
  WSB: '子彈',
  CAP: '子彈',
  BAL: '子彈',
  CHZ: '包裝工',
  CHP: '包裝工'
};
function bioOf(p) {
  if (!p.id || !BIOS || !own(BIOS.p, p.id)) return null;
  const o = {};
  BIOS.cols.forEach((c, i) => (o[c] = BIOS.p[p.id][i]));
  return o;
}
function roleTags(p) {
  const t = [];
  if (num(p.pts, 0) >= 25) t.push('得分機器');
  if (num(p.astp, 0) >= 30) t.push('組織大師');
  else if (num(p.astp, 0) >= 22) t.push('傳球好手');
  if (num(p.trbp, 0) >= 17) t.push('籃板怪');
  if (num(p.blkp, 0) >= 4) t.push('護框長人');
  if (num(p.stlp, 0) >= 2.6) t.push('抄截高手');
  if (peOf(p) >= 3.8 && spc(p) >= 0.6) t.push('空間型長人');
  if (num(p.usg, 20) < 17 && num(p.dbpm, 0) >= 1.5) t.push('防守悍將');
  return t.slice(0, 2);
}
/* Taiwan fan nicknames: Jerry's list (PTT / 巴哈 / 痞客邦 sources), first nickname per player */
const NICK = {
  gilgesh01: 'SGA',
  loveke01: '愛神',
  abdulka01: '天勾',
  adamsst01: '水行俠',
  adebaba01: '阿爹',
  allenra02: '糖',
  anderky01: '慢速先生',
  antetgi01: '字母哥',
  anthoca01: '甜瓜',
  arenagi01: 'Agent 0',
  artesro01: '世界和平',
  barklch01: '惡漢',
  birdla01: '大鳥',
  boguemu01: '強盜',
  bookede01: '書人',
  bradlsh01: '竹竿',
  bryanko01: '黑曼巴',
  butleji01: '士官長',
  capelca01: '餅皇',
  cartevi01: '加拿大航空',
  cassesa01: '外星人',
  chambwi01: '籃球皇帝',
  curryse01: '咖哩弟',
  curryst01: '我家咖喱・浪花兄弟',
  davisan02: '濃眉',
  derozde01: 'DDR',
  doncilu01: '東 77',
  drexlcl01: '滑翔機',
  duncati01: '石佛',
  duranke01: '死神',
  edwaran01: '蟻人',
  embiijo01: '大帝',
  ervinju01: 'J博士',
  ewingpa01: 'Gorilla',
  fishede01: '小魚',
  francst01: '老大',
  garneke01: '狼王',
  gasolpa01: '西班牙兔子',
  georgpa01: 'PG-13',
  gervige01: '冰人',
  ginobma01: '妖刀',
  greenac01: '鐵人',
  greendr01: '追夢',
  hamilri01: '面具人',
  hardaan01: '便士',
  hardati01: '甲蟲',
  hardeja01: '大鬍子',
  havlijo01: '小偷',
  haywago01: '星海哥',
  hillgr01: '好孩子',
  horryro01: '關鍵先生',
  howardw01: '魔獸',
  ilgauzy01: '大Z',
  irvinky01: '德魯大叔',
  iversal01: '答案',
  jamesle01: '小皇帝',
  johnsla02: '大媽',
  johnsma02: '魔術師',
  jokicni01: '小丑',
  jordami01: '飛人',
  kempsh01: '雨人',
  kiddja01: '發動機',
  kirilan01: 'AK-47',
  kuminjo01: '苦命',
  leonaka01: '可愛',
  linje01: '豪神',
  majerda01: '震雷',
  malonka01: '郵差',
  malonmo01: '孤獨的勇士',
  maravpe01: '手槍',
  marbust01: '獨狼',
  mariosh01: '駭客任務',
  mcgratr01: 'T-Mac',
  millere01: '終結者',
  mingya01: '小巨人',
  moblecu01: '老貓',
  mournal01: '大佐',
  mullich01: '上帝左手',
  murraja01: '屁孩',
  mutomdi01: '非洲大山',
  nashst01: '助推器',
  nowitdi01: '德國坦克',
  nurkiju01: '巨獸',
  oaklech01: '老橡樹',
  olajuha01: '大夢',
  onealsh01: '大鯊魚',
  parisro01: '酋長',
  parketo01: '法國跑車',
  paulch01: 'CP3',
  paytoga01: '手套',
  piercpa01: '真理',
  pippesc01: '皮蓬',
  porzikr01: 'KP',
  princta01: '王子',
  randoza01: 'Z-Bo',
  robinda01: '海軍上將',
  rodmade01: '小蟲',
  rosede01: '飆風玫瑰',
  russebi01: '指環王',
  sampsra01: '超級彈簧腿',
  schrode01: '8400萬',
  scolalu01: '大鑽石',
  siakapa01: '洗牙啃',
  sprewla01: '狂人',
  stockjo01: '將軍',
  stoudam01: '小霸王',
  stoudda01: '小飛鼠',
  terryja01: '噴射機',
  thomais01: '微笑刺客',
  thompkl01: '浪花兄弟',
  vanexni01: '小精靈',
  wadedw01: '閃電俠',
  wallabe01: '大本鐘',
  wallara01: '怒吼天尊',
  waltobi01: '紅色巨人',
  webbech01: '國王',
  wembavi01: '斑馬',
  westbru01: '威少',
  westje01: '教父',
  wiggian01: '圍巾',
  wilkido01: '人類電影精華',
  willija02: '白巧克力',
  willizi01: '胖虎',
  worthja01: '眼鏡蛇'
};
const nickOf = p => (p && own(NICK, p.id) ? NICK[p.id] : '');
/* the skill chips a card face shows (at most three), in display order. The bots read players through exactly this
   list (bot.js pubTraits), so they never know a trait a person cannot see. */
function faceSkills(p, g) {
  if (!p || p.fa) return [];
  const b = bioOf(p),
    sk = [];
  if (b) {
    const f = String(b.sk || '');
    if (f.includes('3')) sk.push('三分射手');
    if (f.includes('m')) sk.push('中投機器');
    if (f.includes('r')) sk.push('禁區殺手');
  }
  if (g && g.size === 10) {
    if (foulProne(p)) sk.unshift('犯規麻煩');
    if (isHot(p)) sk.unshift('火爆浪子');
  }
  roleTags(p).forEach(t => {
    if (!sk.includes(t)) sk.push(t);
  });
  return sk.slice(0, 3);
}
function introBlock(p, key) {
  const b = bioOf(p),
    ch = [];
  if (b) {
    if (b.hof) ch.push('🏛 名人堂');
    if (b.ring) ch.push(`🏆 總冠軍 ×${b.ring}`);
    if (b.fmvp) ch.push(`🏅 FMVP ×${b.fmvp}`);
    if (b.mvp) ch.push(`👑 MVP ×${b.mvp}`);
    if (b.dpoy) ch.push(`🛡 最佳防守 ×${b.dpoy}`);
    if (b.all1) ch.push(`年度第一隊 ×${b.all1}`);
    else if (b.alln) ch.push(`年度最佳陣容 ×${b.alln}`);
    if (b.as) ch.push(`全明星 ×${b.as}`);
    if (b.roy) ch.push('新人王');
    if (b.ad1) ch.push(`防守一隊 ×${b.ad1}`);
    if (b.ad2) ch.push(`防守二隊 ×${b.ad2}`);
    if (b.ar1 && !b.roy && ch.length < 4) ch.push('新秀一隊');
    if (!ch.length) ch.push('角色球員');
  }
  const sg = sigOf(p);
  const rev = ui.reveal.has(key);
  const line = b && b.pts != null ? `生涯 ${b.g} 場・場均 ${fmt(b.pts)} 分 ${fmt(b.trb)} 籃板 ${fmt(b.ast)} 助攻` : '';
  const era = b
    ? `${b.from - 1}–${String(b.to % 100).padStart(2, '0')} 年・主要效力${own(TEAMZH, b.tm) ? TEAMZH[b.tm] : b.tm}${b.dy ? `・${b.dy} 年選秀第 ${b.dp} 順位` : '・落選秀'}`
    : '';
  const hon = ch
      .slice(0, 8)
      .map(x => `<span>${esc(x)}</span>`)
      .join(''),
    sty =
      (sg ? `<span class="sig">⭐ ${esc(sg.lab)}</span>` : '') +
      (TOMA.has(p.id) ? `<span class="sig">🪓 戰斧暴扣</span>` : '') +
      faceSkills(p, S && S.game)
        .map(x => `<span class="sk">${esc(x)}</span>`)
        .join('');
  return `<div class="intro2"><div class="irow"><i class="il">榮譽</i><div class="intro">${hon}</div></div>${sty ? `<div class="irow"><i class="il">球風</i><div class="intro">${sty}</div></div>` : ''}</div>${line ? `<div class="small mut" style="margin-top:6px">${line}</div>` : ''}
    ${b ? (rev ? `<div class="small" style="margin-top:4px">${esc(era)}</div>` : `<button class="link" data-act="reveal" data-v="${key}">看年代和球隊（會透露主題）</button>`) : ''}`;
}
const posChips = p =>
  `<div class="poss">${POS.map(s => {
    const i = posInfo(p, s);
    return i.tier <= 1 ? `<span class="${i.tier === 0 ? 'n' : 'c'}">${s}</span>` : '';
  }).join('')}</div>`;
function legHintBox(g, pl) {
  const H = legendHints(g, pl);
  if (!H.length) return '';
  return `<div class="mhint lgh">${H.map(h => `<div style="color:${col(h.s)}">${h.L.ic} ${h.t === 'complete' ? `${esc(nm(S, h.s))} 拿下他就湊齊「${esc(h.L.nm)}」（+${legVal(h.L, h.L.need)} 戰力）` : `${esc(nm(S, h.s))} 拿下他，離「${esc(h.L.nm)}」只差 1 人`}</div>`).join('')}</div>`;
}
function chemHints(g, pl) {
  const out = [];
  g.sides.forEach(s =>
    g.rosters[s].forEach(r => {
      const q = g.items[r.k];
      const k = tmOn(g) ? shared(pl, q) : 0;
      if (k >= 2) out.push({ s, t: `🤝 跟 ${nm(S, s)} 的 ${q.n} 同隊 ${k} 季` });
      if (feudOf(pl, q)) out.push({ s, t: `⚡ 跟 ${nm(S, s)} 的 ${q.n} 處不好` });
    })
  );
  return out;
}
function amtFor(g, s) {
  const mn = g.bid.amt + 1,
    mx = maxBid(g, s);
  let v = ui.amt[s];
  if (!(v > g.bid.amt)) v = mn;
  return clamp(v, Math.min(mn, mx), mx);
}
function bidRow(g, s, r, held) {
  const full = openN(g, s) === 0,
    lead = g.bid.who === s,
    mx = maxBid(g, s),
    mine = r === 'all' || r === s,
    passed = g.pass[s],
    turn = g.turn === s;
  const out = full || passed || (!lead && mx <= g.bid.amt);
  const rost = SLOTS(g)
    .map(x => {
      const q = g.rosters[s].find(y => y.slot === x),
        L = isBench(x) ? (q && q.role ? BROLE[q.role].sh : '替') : x;
      return q
        ? `<span class="f ${isBench(x) ? 'bench' : ''}" id="r-${g.gid}-${s}-${x}-${q.k}"><b>${L}</b>${esc(g.items[q.k].n.split(' ').slice(-1)[0])}${g.ovr !== false ? `<em class="rov">${ovrOf(g.items[q.k])}</em>` : ''}</span>`
        : `<span class="${isBench(x) ? 'bench' : ''}"><b>${L}</b>—</span>`;
    })
    .join('');
  const offl = !offline() && S.seats[s] && S.seats[s].cid !== CID && !onlineSet().has(S.seats[s].cid);
  const state = held
    ? ''
    : fmtBusy(g)
      ? (offl ? '📴 離線中・' : '') + (full ? '陣容已滿' : fmtState(g, s))
      : (offl ? '📴 離線中（自動跳過）・' : '') +
        (full
          ? '陣容已滿'
          : passed
            ? '不要了'
            : lead
              ? '領先中'
              : !lead && mx <= g.bid.amt
                ? '錢不夠加價'
                : turn
                  ? mine
                    ? '輪到你出價'
                    : '出價中…'
                  : '');
  const v = amtFor(g, s),
    can = mine && turn && !out && v <= mx && v > g.bid.amt;
  const fb = fmtBusy(g);
  const ctrl = held
    ? ''
    : fb
      ? fmtCtrl(g, s, r)
      : mine && !out && !lead
        ? `<div class="bidin"><button class="stp" data-act="step" data-who="${s}" data-v="-1" ${can && v > g.bid.amt + 1 ? '' : 'disabled'}>−</button>
      <input class="amt" type="number" inputmode="numeric" pattern="[0-9]*" data-in="amt" data-who="${s}" min="${g.bid.amt + 1}" max="${mx}" value="${v}" ${turn ? '' : 'disabled'} aria-label="出價金額">
      <button class="stp" data-act="step" data-who="${s}" data-v="1" ${can && v < mx ? '' : 'disabled'}>＋</button>
      <button class="bb go" data-act="bidv" data-who="${s}" ${can ? '' : 'disabled'}>出價<small>$${v}</small></button></div>
    <div class="bbtns"><button class="bb all" data-act="bid" data-who="${s}" data-amt="${mx}" ${can ? '' : 'disabled'}>全下 $${mx}</button>
      <button class="bb pass" data-act="pass" data-who="${s}">不要${turn ? '' : '（先跳過）'}</button></div>`
        : '';
  return `<div class="brow ${s} ${lead ? 'lead' : ''} ${out ? 'out' : ''} ${turn ? 'turn' : ''}"><div class="hd"><span class="nm">${turn ? '▶ ' : ''}${esc(nm(S, s))}${r === s ? '（你）' : ''}</span><span class="mx">${full ? '' : `最高 $${mx}`}</span><span class="mo">$${left(g, s)}${g.budAdj && g.budAdj[s] ? `<small class="${g.budAdj[s] < 0 ? 'dn' : 'up'}">${g.budAdj[s] < 0 ? '冠軍稅' : '補償'}</small>` : ''}</span></div>
    ${misChip(g, s)}<div class="bd"><div class="rost">${rost}</div>${held ? '' : cardTray(g, s, r)}${state ? `<div class="small ${turn && mine ? '' : 'mut'}" style="margin-top:6px">${state}</div>` : ''}${ctrl}</div></div>`;
}
function clock(end, tot, label, tick) {
  return `<div class="small mut" data-end="${end}" data-tot="${tot}" ${tick ? 'data-tick="1"' : ''} style="width:100%">${label} <b class="tx"></b> 秒<div class="cd"><i></i></div></div>`;
}
function vAuction() {
  const g = S.game,
    r = myRole();
  const H = ui.hold && ui.hold.gid === g.gid && Date.now() < ui.hold.until ? ui.hold : null;
  const pl = H ? g.items[H.k] : cur(g);
  if (!pl) return '';
  // the beat after a card: one focal message (the banner); the card shrinks to its name and the other rows step back
  if (H) {
    const l = H.l;
    return `<div class="top"><div class="prog">第<b>${H.k + 1}</b>/ ${g.items.length} 張</div>${roundPill(g)}<div class="small mut">下一張準備中…</div></div><div class="bar"><i style="width:${Math.round(((H.k + 1) / g.items.length) * 100)}%"></i></div>
      <div class="stage"><div class="pcard front held calm" id="held-${g.gid}-${H.k}"><div class="pname">${esc(pl.n)}</div></div></div>${g.reveal && g.reveal.grab && g.reveal.grab.length < 2 ? '' : revealBox(g, H.k)}${soldBanner(g, H)}
      ${g.sides
        .map(s => {
          const h = bidRow(g, s, r, true);
          return h.replace('<div class="brow ', '<div class="brow ' + (s === l.who ? 'won ' : 'dim '));
        })
        .join('')}`;
  }
  const pct = Math.round((g.idx / g.items.length) * 100);
  if (g.stage === 'left')
    return `<div class="top"><div class="prog">第<b>${g.idx + 1}</b>/ ${g.items.length} 張</div>${roundPill(g)}<span class="fpill">🧺 撿剩下的</span></div><div class="bar"><i style="width:${pct}%"></i></div>${misStrip(g)}
    ${leftPanel(g, r)}${g.sides.map(s => bidRow(g, s, r, true)).join('')}`;
  if (g.stage === 'nom')
    return `<div class="top"><div class="prog">第<b>${g.idx + 1}</b>/ ${g.items.length} 張</div>${roundPill(g)}${fmtPill(g)}</div><div class="bar"><i style="width:${pct}%"></i></div>${misStrip(g)}
    ${nomPanel(g, r)}${g.sides.map(s => bidRow(g, s, r, true)).join('')}${r === 'all' || ALL.includes(r) ? `<button class="quit" data-act="quit">${ui.quit ? '再按一次確認放棄本局' : '放棄本局'}</button>` : ''}`;
  const card = `<div class="pcard front" id="card-${g.gid}-${g.idx}">${ovrBadge(pl, g)}${g.price != null ? `<div class="ptag">$${g.grab ? g.grab.price : dutchAt(g, now())}</div>` : ''}<div class="pname">${esc(pl.n)}</div>${nickOf(pl) ? `<div class="nick"><span>${esc(nickOf(pl))}</span></div>` : ''}${phaseBadge(pl, g)}${posChips(pl)}${introBlock(pl, g.gid + '-' + g.idx)}
      ${
        g.showStats
          ? `<div class="psub">${esc(sub(pl))}</div><div class="pstats">${[
              ['pts', 'PTS'],
              ['trb', 'REB'],
              ['ast', 'AST'],
              ['stl', 'STL'],
              ['blk', 'BLK']
            ]
              .map(([k, l]) => `<div><b>${fmt(pl[k])}</b><i>${l}</i></div>`)
              .join('')}</div>`
          : ''
      }</div>`;
  const hints = g.hints ? chemHints(g, pl) : [];
  const hintBox = hints.length
    ? `<div class="chemh">${hints.map(h => `<div style="color:${col(h.s)}">${esc(h.t)}</div>`).join('')}</div>`
    : '';
  const b = g.bid,
    rdg = inRead(g) && !g.stage;
  const curBox = rdg
    ? readBox(g, r)
    : g.sb
      ? (g.tie ? revealBox(g, g.idx) : '') + sealedBox(g)
      : g.price != null
        ? snatchBox(g)
        : `<div class="cur" style="${b.who ? `border-color:${col(b.who)}` : ''}"><div class="line">${!b.who ? `<div class="mut">等待出價（最低 $1）</div>` : `<div class="amt" id="amt-${g.gid}-${g.idx}-${b.amt}-${b.who}" style="color:${col(b.who)}">$${b.amt}</div><div class="who">${esc(nm(S, b.who))}<br><span class="small mut">目前最高</span></div>`}</div>
    ${!g.turn ? '' : clock(g.deadline, b.who ? T_BID : T_NOBID, `輪到 <b style="color:${col(g.turn)}">${esc(nm(S, g.turn))}</b>・` + (b.who ? '不加價就算放棄：' : '不出價就算不要：'), r === g.turn && NET.mode !== 'local')}</div>`;
  const ex = g.extra || 0,
    base = g.base || g.items.length,
    openAll = g.sides.reduce((t, s) => t + openN(g, s), 0),
    left2 = g.items.length - g.idx,
    canAdd = EXTRA_MAX - ex;
  const deckNote = pl.extra
    ? `<div class="xnote">🔔 加牌 ${g.idx - base + 1}/${ex}・流標換來的明星，${canAdd ? `還能再補 ${canAdd} 張` : '這是最後幾張了'}</div>`
    : left2 + canAdd < openAll + 2 && left2 <= openAll + 1
      ? `<div class="xnote warn">⚠️ 牌快不夠了：還剩 ${left2} 張${canAdd ? `＋最多補 ${canAdd} 張` : ''}，沒標到的位置會用自由球員補</div>`
      : '';
  return `<div class="top"><div class="prog">第<b>${g.idx + 1}</b>/ ${g.items.length} 張</div>${roundPill(g)}${fmtPill(g)}<div class="small mut">之後還有 ${remain(g) - 1} 張${canAdd ? `<br><small>流標可補 ${canAdd} 張</small>` : ''}</div></div>${deckNote}
  <div class="bar"><i style="width:${pct}%"></i></div>${misStrip(g)}<div class="stage">${card}</div>${mktStrip(g)}${legHintBox(g, pl)}${misHintBox(g, pl)}${hintBox}${curBox}
  ${g.sides.map(s => bidRow(g, s, r, rdg)).join('')}
  ${r === 'all' || ALL.includes(r) ? `<button class="quit" data-act="quit">${ui.quit ? '再按一次確認放棄本局' : '放棄本局'}</button>` : ''}`;
}
function vLineup() {
  const g = S.game,
    r = myRole();
  const panel = s => {
    const mine = r === 'all' || r === s,
      R = rosterOf(g, s),
      rd = g.ready[s];
    if (!mine)
      return `<section class="card"><div class="row"><b style="color:${col(s)}">${esc(nm(S, s))}</b><span class="grow"></span><span class="small ${rd ? '' : 'mut'}">${rd ? '✅ 已準備' : '<span class="spin"></span> 排陣中…'}</span></div>
      <div class="small mut" style="margin-top:6px">${R.map(p => esc(p.n)).join('、')}</div>${scoutLine(g, s)}<div class="small mut" style="margin-top:4px">位置和戰術開打時才公開。</div></section>`;
    const plate = p => {
      const pi = posInfo(p, p.slot),
        sel = ui.sel && ui.sel.who === s && ui.sel.slot === p.slot,
        b = isBench(p.slot),
        nk = nickOf(p);
      return `<div class="plate ${s} ${sel ? 'sel' : ''} ${b ? 'bench' : ''} ${rd ? 'locked' : ''}" data-act="${rd ? '' : 'lu'}" data-who="${s}" data-v="${p.slot}" data-drag="${rd ? '' : s}">
        <span class="ps">${b ? BROLE[p.role || 'G'].sh : p.slot}</span><span class="pn"><b>${esc(String(p.n).toUpperCase())}</b>${b ? roleChip(g, s, p, rd) : ''}<small>${nk ? `“${esc(nk)}”・` : ''}能打 ${canPlay(p).join(' ') || '—'}${pi.tier > 0 && !b ? ` <i class="tag t${pi.tier}">${pi.lab}</i>` : ''}</small><span class="pst">${p.fa ? '自由球員（替補程度）' : `<b>${fmt(p.pts)}</b> 分 <b>${fmt(p.trb)}</b> 板 <b>${fmt(p.ast)}</b> 助 <b>${fmt(p.stl)}</b> 抄 <b>${fmt(p.blk)}</b> 帽`}<i>$${p.price || 0}</i></span></span><span class="grip" aria-hidden="true">⠿</span></div>`;
    };
    const st = R.filter(p => !isBench(p.slot)),
      bn = R.filter(p => isBench(p.slot));
    return `<section class="board2 ${s}"><div class="bh"><span class="bt" style="color:${col(s)}">${esc(nm(S, s))}</span><span class="small" style="color:#aab4cc">剩 $${left(g, s)}</span></div>${misChip(g, s)}
      <div class="bsub">${rd ? '已鎖定，等其他人…' : ui.sel && ui.sel.who === s ? '再點一位球員跟他交換' : '拖曳 ⠿ 或點兩位球員互換' + (g.size === 10 ? '（先發和替補也能互換）' : '')}</div>
      <div class="blab">先發</div>${st.map(plate).join('')}${bn.length ? `${benchSummary(g, s)}${bn.map(plate).join('')}` : ''}
      ${tacPanel(g, s, rd)}
      <button class="${rd ? 'ghost' : 'big'}" style="margin-top:12px" data-act="ready" data-who="${s}" data-v="${rd ? 0 : 1}" ${!rd && !benchOK(g, s) ? 'disabled' : ''}>${rd ? '取消準備' : '準備好了 ✓'}</button></section>`;
  };
  return `<div class="center" style="margin-top:14px">${roundPill(g)}<div style="font-size:36px">📋</div><div style="font-weight:900;font-size:20px">賽前排陣</div>${lineupMisNote(g)}
    <div class="small mut" style="max-width:420px;margin:4px auto 0">同位置的球員會一對一。小個子打大位置靠速度、但籃板吃虧；大個子靠籃板和低位。對手的排法開打才公開。</div>
    <div style="max-width:300px;margin:8px auto 0">${clock(g.lineupEnd, T_LINEUP * (g.size === 10 ? 4 / 3 : 1), '時間到自動開打：')}</div></div>
    ${g.sides.map(panel).join('')}`;
}
const ar = (x, k, inv) => {
  const m = x.m && x.m[k];
  if (m == null || Math.abs(m - 1) < 0.1) return '';
  const good = inv ? m < 1 : m > 1;
  return `<i class="${good ? 'up' : 'dn'}">${m > 1 ? '▲' : '▼'}</i>`;
};
