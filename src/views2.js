/* ---------- mission & season views ---------- */
const stars=t=>MTIER[t]?MTIER[t].star:'';
const misReward=(t,se,b)=>`+${b!=null?b:MTIER[t].bonus} 戰力${se?`・+${MTIER[t].pt} 分`:''}`;
function misFoot(x){const m=misOf(x.id);if(!m)return '';
  if(m.k==='cmp'||m.k==='topbid')return '跟對手比，對手也會搶';
  if(m.k==='left'||m.k==='big'||m.k==='cap'||m.k==='cheap')return '看你怎麼花錢';
  if(m.k==='none')return '一個都不能有';
  if(m.k==='slot')return `牌堆裡有 ${x.q} 位人選・排陣時要放 ${m.slot}`;
  if(m.k==='distinct'||m.k==='same')return '看卡片上的球隊／年份';
  return `牌堆裡有 ${x.q} 位符合`}
function misCard(g,s,x,i,opts){const m=misOf(x.id);if(!m)return '';const on=opts.sel,se=!!g.round;
  return `<${opts.btn?'button':'div'} class="mcard t${x.tier} ${on?'on':''} ${opts.mini?'mini':''}" ${opts.btn?`data-act="mpick" data-who="${s}" data-i="${i}"`:''} style="--i:${i}">
    <div class="mtop"><span class="mic">${m.ic}</span><span class="mst" title="${MTIER[x.tier].lab}">${stars(x.tier)}</span></div>
    <div class="mnm">${esc(m.nm)}</div><div class="mdesc">${esc(misDesc(x,g,s))}</div>
    ${opts.mini?'':`<div class="mfoot"><span>${esc(misFoot(x))}</span><b>${misReward(x.tier,se,x.bonus)}</b></div>`}
    ${on&&opts.btn?'<span class="mck">✓</span>':''}</${opts.btn?'button':'div'}>`}
/* missions are secret until the results: online you only see your own; on one shared phone each player can peek at his own */
function misVis(g,s){if(!g.mis)return false;if(g.misRes)return true;if(NET.mode==='local')return ui.peek===s;return myRole()===s}
function misChip(g,s){const P=misProg(g,s);if(!P)return '';
  if(!misVis(g,s))return `<div class="mchip hid"><span>🎯 任務保密</span>${NET.mode==='local'?`<button class="peek" data-act="peek" data-who="${s}">👁 看我的任務</button>`:''}</div>`;const st=P.dead?'dead':P.done===true?'ok':P.done==='now'?'now':'';
  return `<div class="mchip ${st}" title="${esc(misDesc(P.x,g,s))}"><span>${P.m.ic} ${esc(P.m.nm)}</span><b>${P.dead?'✗ ':P.done===true?'✓ ':''}${esc(P.txt)}</b></div>`}
function roundPill(g){return g&&g.round?`<span class="spill">🏁 季賽 第 ${g.round}/${g.rounds} 局</span>`:''}
function vMission(){
  const g=S.game,r=myRole(),local=NET.mode==='local',sides=g.sides,se=!!g.round;
  const chooser=local?sides.find(s=>g.mis[s].pick==null):(ALL.includes(r)?r:null);
  const status=sides.map(s=>{const M=g.mis[s],done=M.pick!=null,m=done?misOf(M.opts[M.pick].id):null,show=done&&!local&&s===r;
    return `<div class="mstat ${done?'done':''} ${s===chooser?'mcur':''}"><span class="dot" style="background:${col(s)}"></span><b>${esc(nm(S,s))}</b><span class="grow"></span>${show?`<span>${m.ic} ${esc(m.nm)}${M.auto?'<small>（自動）</small>':''}</span>`:done?`<span>已選好 ✓${M.auto?'<small>（自動）</small>':''}</span>`:'<span class="mut">選擇中…</span>'}</div>`}).join('');
  let body='';
  if(chooser){const M=g.mis[chooser];
    body=`<div class="mwho" style="color:${col(chooser)}">${local?`輪到 <b>${esc(nm(S,chooser))}</b> 選任務<div class="small mut" style="font-weight:600">其他人先別看 🙈</div>`:'選一張你的任務'}</div>
      <div class="mcards" id="mc-${g.gid}-${chooser}">${M.opts.map((x,i)=>misCard(g,chooser,x,i,{btn:1,sel:M.pick===i})).join('')}</div>
      ${!local&&M.pick!=null?'<div class="small mut center" style="margin-top:8px">已選好，等其他人…（還可以改）</div>':''}`}
  else body=`<div class="center mut" style="margin:18px 0"><span class="spin"></span> 玩家正在選任務…</div>`;
  return `<div class="mhead">${roundPill(g)}<div class="mtitle">🎯 選一張任務卡</div>
    <div class="small mut">每人 3 張選 1 張。<b>任務保密</b>，只有你看得到，結算時才揭曉。<br>開打前達成就能加戰力${se?'，季賽還多拿積分':''}。主題也還是保密。</div>
    <div style="max-width:300px;margin:10px auto 0">${clock(g.misEnd,T_MIS*(NET.mode==='local'?g.sides.length:1),'時間到自動選 ★★：')}</div></div>
    ${body}<section class="card mstats">${status}</section>
    <div class="mlegend small mut">★ 簡單 +${MTIER[1].bonus}・★★ 普通 +${MTIER[2].bonus}・★★★ 困難 +${MTIER[3].bonus} 戰力${se?'（★★★ 季賽 +2 分，其他 +1 分）':''}。難度是依照這次牌堆算的。</div>`}
// small strip on the auction screen with every player's mission
function misStrip(g){if(!g.mis||NET.mode==='local'||!g.sides.some(s=>misVis(g,s)))return '';const vis=g.sides.filter(s=>misVis(g,s));
  return `<details class="mstrip" ${ui.mstrip?'open':''}><summary data-act="mstrip">🎯 我的任務 ${vis.map(s=>{const P=misProg(g,s);return P?`<i style="background:${col(s)}" class="${P.dead?'dead':P.done===true?'ok':''}"></i>`:''}).join('')}</summary>
    ${vis.map(s=>{const P=misProg(g,s);if(!P)return '';return `<div class="msrow"><b style="color:${col(s)}">${esc(nm(S,s))}</b>${misChip(g,s)}<div class="small mut">${esc(misDesc(P.x,g,s))}</div></div>`}).join('')}</details>`}
function misHintBox(g,pl){const H=misHints(g,pl).filter(h=>misVis(g,h.s));if(!H.length)return '';
  return `<div class="mhint">${H.map(h=>`<div style="color:${col(h.s)}">${h.t==='bad'?'⚠️':'🎯'} ${h.t==='bad'?`會讓你的「${esc(h.m.nm)}」破功`:`符合你的「${esc(h.m.nm)}」`}</div>`).join('')}</div>`}
function misResults(g,d){const R=g.misRes;if(!R||!Object.keys(R).length)return '';const se=!!g.round;
  return `<section class="card rs mres" style="--d:${d}s"><h2>🎯 任務結算</h2>${g.sides.map(s=>{const x=R[s];if(!x)return '';const m=misOf(x.id),P=misProg(g,s);
    return `<div class="mrrow ${x.done?'ok':'no'}"><span class="mrs">${x.done?'✓':'✗'}</span><div class="grow"><div><b style="color:${col(s)}">${esc(nm(S,s))}</b>・${m.ic} ${esc(m.nm)} <span class="mst2">${stars(x.tier)}</span></div>
      <div class="small mut">${esc(misDesc({id:x.id,need:x.need},g,s))}${P?`・${esc(P.txt)}`:''}</div></div><b class="mrw">${x.done?misReward(x.tier,se,x.bonus):'未達成'}</b></div>`}).join('')}</section>`}
/* season standings / closing ceremony */
function seasonRows(S,T,final){const se=S.season||S.lastSeason,mx=Math.max(1,...T.map(x=>x.pts)),medal=['🥇','🥈','🥉'];
  return `<div class="stable">${T.map((x,i)=>`<div class="strow ${x.s} rs" style="--d:${(0.15+i*0.12).toFixed(2)}s">
    <span class="srk">${final?medal[x.rank-1]||x.rank:x.rank}</span><div class="grow"><div class="sline"><b style="color:${col(x.s)}">${esc(nm(S,x.s))}</b><span class="grow"></span><span class="spts num">${x.pts}<small>分</small></span></div>
    <div class="sbar"><i style="width:${(x.pts/mx*100).toFixed(1)}%;background:${col(x.s)}"></i></div>
    <div class="smeta">🏆 ${x.titles} 冠・系列 ${x.sw}–${x.sl}${se.mis?`・🎯 ${x.mis}/${x.misN}`:''}・淨勝 ${x.gd>0?'+':''}${x.gd}</div></div></div>`).join('')}</div>`}
function seasonDots(se){return `<div class="sdots">${[...Array(se.n)].map((_,i)=>{const R=se.rounds[i];return `<span class="${R?'d':''} ${!R&&i===se.rounds.length&&!se.done?'nx':''}" style="${R?`background:${col(R.champ)}`:''}">${i+1}</span>`}).join('')}</div>`}
function seasonHistory(rounds){const se=S.season||S.lastSeason;
  return (rounds||se.rounds).slice().reverse().map(R=>`<div class="shist"><div class="row"><b>第 ${R.k} 局</b><span class="small mut grow" style="margin-left:6px">${esc(R.th)}</span><span style="color:${col(R.champ)};font-weight:800">🏆 ${esc(nm(S,R.champ))}</span></div>
    <div class="small">${R.ser.map(([a,b,wa,wb])=>`<span style="color:${col(a)}">${esc(nm(S,a))}</span> ${wa}–${wb} <span style="color:${col(b)}">${esc(nm(S,b))}</span>`).join('・')}</div>
    <div class="sgain">${se.sides.map(s=>{const p=R.pts[s],mi=R.mis&&R.mis[s];return `<span style="border-color:${col(s)}"><b style="color:${col(s)}">${esc(nm(S,s))} +${p?p.t:0}</b>${p&&p.b?` <small>${p.b===3?'冠軍':R.order.indexOf(s)===1&&se.sides.length===3?'第二':'打滿七場'} +${p.b}</small>`:''}${mi?` <small>${misOf(mi.id).ic}${mi.done?'✓ +'+mi.pt:'✗'}</small>`:''}</span>`}).join('')}</div></div>`).join('')}
function vSeason(){
  const se=S.season,r=myRole(),isP=r==='all'||ALL.includes(r);if(!se)return vLobby();
  const T=seasonTable(S),last=se.rounds[se.rounds.length-1],wait=waitingFor();
  if(se.done){const champs=T.filter(x=>x.rank===1),A=seasonAwards(S);
    return `<div class="ceremony rs" style="--d:.05s"><div class="conf" aria-hidden="true">${'🎉🏆✨🏀🎊⭐'.repeat(3).match(/./gu).map((c,i)=>`<i style="--x:${(i*37)%100}%;--t:${(i%7)*0.35}s">${c}</i>`).join('')}</div>
      <div class="ct">SEASON CHAMPION${champs.length>1?'S':''}</div><div class="cw">🏆 ${champs.map(x=>`<b style="color:${col(x.s)}">${esc(nm(S,x.s))}</b>`).join('・')}</div>
      <div class="small mut">${se.endedAt<se.n?`季賽提前結束（打了 ${se.endedAt}/${se.n} 局）`:`${se.n} 局季賽`}・${champs[0].pts} 分・${champs[0].titles} 座單局冠軍</div></div>
      <section class="card">${seasonDots(se)}${seasonRows(S,T,true)}</section>
      ${A.length?`<section class="card rs" style="--d:.6s"><h2>🎖️ 季賽獎項</h2><div class="awards">${A.map((a,i)=>`<div class="aw rs" style="--d:${(0.7+i*0.1).toFixed(2)}s"><span class="aic">${a.ic}</span><div class="grow"><div class="small mut">${a.t}</div><b style="${a.s?`color:${col(a.s)}`:''}">${esc(a.v)}</b><div class="small mut">${esc(a.d)}</div></div></div>`).join('')}</div></section>`:''}
      <section class="card rs" style="--d:1s"><details><summary>📜 每局紀錄</summary>${seasonHistory()}</details></section>
      <div class="rs" style="--d:1.1s"><button class="ghost" data-act="copyseason">📋 複製季賽結果</button>
      ${isP?`<button class="big" data-act="closeSeason" ${wait.length?'disabled':''}>${wait.length?`等 ${esc(wait.join('、'))} 看完結算…`:'回到大廳 →'}</button>`:''}</div>`}
  const k=se.rounds.length,bb=seasonBudgets(S),c=S.cfg,online=!offline(),P=online?seasonPresence(se):null;
  const nextBud=se.sides.map(s=>{const a=bb.adj[s];return `<div class="nb"><span class="dot" style="background:${col(s)}"></span><b>${esc(nm(S,s))}</b><span class="grow"></span><b class="num">$${bb.b[s]}</b>${a?`<small class="${a<0?'dn':'up'}">${a<0?`上局冠軍 −$${-a}`:`墊底補償 +$${a}`}</small>`:''}</div>`}).join('');
  return `<div class="shero rs" style="--d:.02s"><div class="st1">🏁 季賽積分榜</div><div class="small mut">${k?`第 ${k} / ${se.n} 局結束`:`共 ${se.n} 局・還沒開打`}</div>${seasonDots(se)}</div>
    ${k?`<section class="card">${seasonRows(S,T,false)}</section>`:''}
    ${last?`<section class="card rs" style="--d:.5s"><h2>上一局</h2>${seasonHistory([last])}</section>`:''}
    <section class="card rs" style="--d:.6s"><h2>第 ${k+1} 局預算</h2>${nextBud}
      <div class="small mut" style="margin-top:6px">${se.bal?'平衡機制：上局冠軍預算 −10%，積分墊底 +10%':'平衡機制關閉，大家預算一樣'}${c.mis?'・🎯 任務卡開啟':''}</div></section>
    ${S.err?`<div class="err">${esc(S.err)}</div>`:''}
    ${online?`<section class="card rs pres" style="--d:.65s"><h2>誰準備好了</h2>${P.rows}<div class="small mut" style="margin-top:6px">大家都按「準備好了」就自動開始第 ${k+1} 局。</div></section>`:''}
    ${isP?`<div class="rs" style="--d:.7s">${online?(se.sides.includes(r)?`<button class="big ${P.ready[r]?'ghost':''}" data-act="sready" data-v="${P.ready[r]?0:1}">${P.ready[r]?'取消準備':`準備好了 ✓`}</button>`:'')
        +(P.off.length?`<button class="ghost" data-act="start">${esc(P.off.join('、'))} 離線了，不等了直接開始 →</button>`:'')
      :wait.length?`<button class="big" disabled>等 ${esc(wait.join('、'))} 看完結算…</button>`:`<button class="big" data-act="start">開始第 ${k+1} 局 →</button>`}
      <button class="quit" data-act="endSeason">${ui.endSe?'再按一次：現在結束季賽並頒獎':'提前結束季賽'}</button></div>`:'<div class="note">等玩家準備好開始下一局…</div>'}
    ${k>1?`<section class="card"><details><summary>📜 每局紀錄</summary>${seasonHistory()}</details></section>`:''}`}
function seasonText(){const se=S.season||S.lastSeason;if(!se)return '';const T=seasonTable(S);let t=`🏁 BALLER BID 季賽（${se.rounds.length}/${se.n} 局）\n`;
  T.forEach(x=>t+=`${x.rank}. ${nm(S,x.s)}　${x.pts} 分・${x.titles} 冠・系列 ${x.sw}–${x.sl}${se.mis?`・任務 ${x.mis}`:''}\n`);
  seasonAwards(S).forEach(a=>t+=`${a.ic} ${a.t}：${a.v}（${a.d}）\n`);return t}
function lastSeasonCard(){const ls=S.lastSeason;if(!ls||S.season)return '';const T=seasonTable(S),w=T.filter(x=>x.rank===1);
  return `<section class="card"><details><summary>🏁 上一季冠軍：${w.map(x=>`<b style="color:${col(x.s)}">${esc(nm(S,x.s))}</b>`).join('・')}（${ls.rounds.length} 局）</summary>${seasonRows(S,T,true)}
    <div class="awards" style="margin-top:8px">${seasonAwards(S).map(a=>`<div class="aw"><span class="aic">${a.ic}</span><div class="grow"><div class="small mut">${a.t}</div><b>${esc(a.v)}</b><div class="small mut">${esc(a.d)}</div></div></div>`).join('')}</div></details></section>`}
function lineupMisNote(g){if(!g.mis)return '';const L=g.sides.map(s=>{const P=misVis(g,s)&&misProg(g,s);if(!P)return null;
    if(P.m.k==='slot')return `${esc(nm(S,s))} 要把人排在 ${P.m.slot}`;if(P.m.k==='cmp'&&g.size===10)return `${esc(nm(S,s))} 的${esc(P.m.nm)}只算先發`;return null}).filter(Boolean);
  return `<div class="small" style="color:#b26a00;margin-top:2px">🎯 任務在開打那一刻判定${L.length?'：'+L.join('・'):''}</div>`}
/* who is on the standings screen, still watching the results, ready, or offline */
function seasonPresence(se){const on=onlineSet(),ready=S.sready||{},off=[];
  const rows=se.sides.map(k=>{const st=S.seats[k],me=st&&st.cid===CID,live=st&&(me||on.has(st.cid)),watching=st&&S.last&&!(S.back&&S.back[st.cid]);
    if(st&&!live)off.push(st.name);
    const [c,t]=!st?['#bbb','空位']:!live?['#bbb','離線']:watching?['var(--acc)','還在看結算']:ready[k]?['var(--ok)','準備好了 ✓']:['#2f7cf6','在積分榜'];
    return `<div class="prow"><span class="dot ${watching&&live?'pulse':''}" style="background:${c}"></span><b style="color:${col(k)}">${esc(nm(S,k))}</b>${me?'<small class="mut">（你）</small>':''}<span class="grow"></span><span class="small" style="color:${c};font-weight:800">${t}</span></div>`}).join('');
  return{rows,ready,off}}
// shown on the results screen of a season round while others have moved on
function seasonWaitNote(){if(offline()||!S.season||!S.last||S.season.done)return '';const se=S.season,r=myRole(),ready=S.sready||{};
  const L=se.sides.filter(k=>k!==r&&S.seats[k]&&S.back&&S.back[S.seats[k].cid]).map(k=>`<b style="color:${col(k)}">${esc(nm(S,k))}</b>${ready[k]?' 已準備好 ✓':' 在積分榜等你'}`);
  return L.length?`<div class="note" style="margin-top:8px">⏳ ${L.join('・')}</div>`:''}
