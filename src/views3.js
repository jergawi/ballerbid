/* ---------- views: auction formats, nominations, bench roles, sound toggle ---------- */
const fmtPill=g=>{const f=FMTS[fmtOf(g)];return `<span class="fpill f-${fmtOf(g)}">${f.ic} ${f.nm}${g.nom?'・提名':''}</span>`};
function fmtLobby(c,dis){const opts=Object.keys(FMTS).concat(c.season?['rotate']:[]);
  const lab=k=>k==='rotate'?['🔄','每局輪換','季賽每一局換一種方式']:[FMTS[k].ic,FMTS[k].nm,FMTS[k].d];
  const cur=c.fmt==='rotate'&&!c.season?'open':c.fmt||'open';
  return `<div class="fl" style="margin-top:14px">拍賣方式</div><div class="fgrid">${opts.map(k=>{const [ic,nm,d]=lab(k);
      return `<button class="fopt ${cur===k?'on':''}" data-act="cfg" data-k="fmt" data-v="${k}" ${dis}><span class="fic">${ic}</span><b>${nm}</b><small>${d}</small></button>`}).join('')}</div>
    <div class="fl" style="margin-top:16px">出牌方式</div><div class="small mut" style="margin:-2px 0 6px">決定「下一張拍誰」，可以搭配上面任何一種拍賣方式</div>
    <button class="crow ${c.nom?'on':''}" data-act="cfg" data-k="nom" data-v="${c.nom?0:1}" ${dis}><span class="ck">${c.nom?'✓':''}</span><span class="grow"><b>🎯 輪流提名</b><small>桌上翻開 ${MKT} 張牌，輪到的人挑一張拿出來拍（不勾＝照牌堆順序翻牌）</small></span></button>`}
// honours line for the small market cards
function miniTags(p){const b=(p&&!p.fa&&bioOf(p))||{},t=[];if(b.mvp)t.push(`👑MVP${b.mvp>1?'×'+b.mvp:''}`);if(b.ring)t.push(`🏆×${b.ring}`);if(b.as)t.push(`⭐×${b.as}`);
  if(!t.length&&b.roy)t.push('🌱新人王');const sg=typeof sigOf==='function'&&sigOf(p);if(sg)t.push(`✨${sg.lab}`);return t.slice(0,3)}
function miniCard(g,x,opts){const p=x.p,nk=nickOf(p);
  return `<${opts.btn?'button':'div'} class="mcard2 ${opts.sel?'sel':''} ${p.extra?'xtra':''} ${opts.dim?'dim':''}" ${opts.btn?`data-act="${opts.act||'nompick'}" data-v="${x.j}"`:''} style="--i:${opts.i||0}">${ovrBadge(p,g,1)}
    <div class="mn">${esc(p.n)}</div>${nk?`<div class="mk">“${esc(nk)}”</div>`:''}${phaseBadge(p,g,1)}<div class="mp">${canPlay(p).map(x=>`<i>${x}</i>`).join('')}</div>
    <div class="mt">${miniTags(p).map(t=>`<span>${esc(t)}</span>`).join('')}</div>${opts.price!=null?`<span class="mpr">$${opts.price}</span>`:''}${opts.sel?'<span class="mck2">✓</span>':''}</${opts.btn?'button':'div'}>`}
function nomPanel(g,r){const mine=r==='all'||r===g.nomBy,M=market(g),sel=ui.nomSel&&ui.nomSel.gid===g.gid&&ui.nomSel.idx===g.idx?ui.nomSel.j:null;
  return `<div class="nomhd"><div class="nt"><b style="color:${col(g.nomBy)}">${esc(nm(S,g.nomBy))}</b> ${mine?'，選一位拿出來拍':'正在挑要拍的球員…'}</div>
    <div class="small mut">${mine?'挑你想要的，或丟一個對手想要的出來，讓他花錢':'桌上這幾位都可能被拿出來'}</div></div>
    <div class="mkt">${M.map((x,i)=>miniCard(g,x,{btn:mine,sel:sel===x.j,i})).join('')}</div>
    <div class="nomft">${mine?`<button class="big" data-act="nominate" data-v="${sel==null?'':sel}" ${sel==null?'disabled':''}>${sel==null?'先點一位球員':`🔨 拍賣 ${esc(String(g.items[sel].n))}`}</button>`:''}
    ${clock(g.nomEnd,T_NOM,mine?'時間到自動拿最有名的：':'提名倒數：',mine&&r!=='all')}</div>`}
// the cards still face up next to the one on the block
function mktStrip(g){if(!g.nom||g.stage)return '';const M=market(g).slice(1);if(!M.length)return '';
  return `<div class="mstrip2"><span class="small mut">桌上還有</span>${M.map(x=>`<span class="mchip2">${esc(String(x.p.n).split(' ').slice(-1)[0])}</span>`).join('')}</div>`}
// sealed: status of every bidder, never the amounts
function sealedBox(g){const el=g.tie?g.tie.sides:bidders(g);
  const tb=g.tie&&g.tie.tb,why=tb&&(openN(g,tb)>Math.min(...el.filter(x=>x!==tb).map(x=>openN(g,x)))?'空位比較多':'這張出價順序在前');
  return `<div class="cur sealed"><div class="sh">${g.tie?`⚖️ 平手加賽：${el.map(s=>`<b style="color:${col(s)}">${esc(nm(S,s))}</b>`).join('、')} 再出一次（至少 $${g.tie.amt}）`:'🤫 暗標：大家同時出價，揭曉後最高價得標'}</div>
    ${tb?`<div class="tbn">如果又一樣：<b style="color:${col(tb)}">${esc(nm(S,tb))}</b> 得標（${why}）。其他人要加價才贏得到。</div>`:''}
    <div class="sst">${el.map(s=>`<span class="${g.sb[s]!=null?'done':''}" style="--c:${col(s)}">${esc(nm(S,s))} ${g.sb[s]!=null?'✓ 已出價':'思考中…'}</span>`).join('')}</div>
    ${clock(g.deadline,g.tie?T_SEAL_TIE:T_SEAL,'時間到沒出價就算 $'+(g.tie?g.tie.amt:0)+'：',ALL.includes(myRole())&&el.includes(myRole())&&g.sb[myRole()]==null)}</div>`}
// the Dutch clock: a big price stepping down, a bar for the current step, a re-render (and a soft tick) at every step
function snatchBox(g){const t=now(),wait=g.openAt>t,pr=dutchAt(g,t),key=g.gid+':'+g.idx;
  clearTimeout(ui.openT);
  if(!g.grab){const nextAt=wait?g.openAt:pr>1?g.openAt+(g.price-pr+1)*g.step:null;
    if(nextAt)ui.openT=setTimeout(()=>{const p2=dutchAt(g,now());if(now()>=g.openAt&&ui.goFor!==key){ui.goFor=key;sfx('go')}else if(p2!==ui.dLast)sfx('dtick',0,false,p2);ui.dLast=p2;render()},Math.max(30,nextAt-t+15))}
  const floorAt=g.openAt+(g.price-1)*g.step;
  return `<div class="cur snatch ${wait?'wait':'live'}">${g.grab?`<div class="sh">⚡ 有人按下了！判定中…</div><div class="dprice"><b>$${g.grab.price}</b></div>`
      :wait?`<div class="cdn" data-end="${g.openAt}" data-tot="${SNATCH_LEAD}"><b class="tx"></b></div><div class="small mut">起標 <b>$${g.price}</b>，開始後每 ${(g.step/1000).toFixed(1)} 秒降 $1</div>`
      :`<div class="dprice" id="dp-${key}-${pr}"><b>$${pr}</b>${pr>1?`<i style="animation-duration:${g.step}ms"></i>`:''}</div>
        <div class="small mut">${pr>1?`每 ${(g.step/1000).toFixed(1)} 秒降 $1・第一個按的人用這個價格買走`:'最低價 $1'}</div>${pr<=1?clock(g.deadline,T_FLOOR,'沒人要就流標：'):''}`}</div>`}
// reveal after a sealed or snatch card (shown while the winner picks a spot and during the SOLD stamp)
function revealBox(g,idx){const v=g.reveal;if(!v||v.idx!==idx)return '';
  if(v.grab)return `<div class="reveal"><div class="rt">⚡ 搶標結果</div>${v.grab.length>1?`<div class="small mut">${v.grab.map(s=>esc(nm(S,s))).join('、')} 幾乎同時按下，抽籤決定</div>`:''}
    <div class="rrow win" style="--c:${col(v.win)}"><b>${esc(nm(S,v.win))}</b><span>搶到！$${v.price}</span></div></div>`;
  const B=Object.entries(v.bids).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...B.map(x=>x[1]));
  return `<div class="reveal"><div class="rt">🤫 暗標揭曉${v.retie?'：平手！':''}</div>${B.map(([s,a],i)=>`<div class="rrow ${s===v.win?'win':''}" style="--c:${col(s)};--w:${(a/mx*100).toFixed(0)}%;--i:${i}"><b>${esc(nm(S,s))}</b><i></i><span>$${a}${s===v.win?' 👑':''}</span></div>`).join('')}
    ${v.retie?'<div class="small mut">平手的人再出一次</div>':v.tb?'<div class="small mut">加賽還是平手：空位比較多的一方得標</div>':!v.win?'<div class="small mut">沒有人出價，流標</div>':''}</div>`}
// controls inside a player's row for sealed / snatch cards
function fmtCtrl(g,s,r){const mine=r==='all'||r===s;if(!mine)return '';
  if(g.sb){const el=g.tie?g.tie.sides:bidders(g);if(!el.includes(s))return '';
    if(NET.mode==='local'){const nx=el.find(x=>g.sb[x]==null);if(nx!==s)return g.sb[s]!=null?'<div class="small" style="margin-top:6px;color:var(--ok);font-weight:800">✓ 已出價（金額保密）</div>':''}
    const lo=g.tie?g.tie.amt:0,mx=maxBid(g,s),k='s'+g.idx+s;let v=ui.amt[k];if(v==null)v=g.sb[s]!=null&&NET.mode!=='local'?g.sb[s]:Math.min(mx,Math.max(lo,1));v=clamp(v,lo,mx);
    return `${NET.mode==='local'?`<div class="small" style="margin-top:6px;font-weight:800">🙈 輪到 ${esc(nm(S,s))} 偷偷出價，其他人別看</div>`:''}
      <div class="bidin"><button class="stp" data-act="sstep" data-who="${s}" data-v="-1" ${v>lo?'':'disabled'}>−</button>
      <input class="amt" type="number" inputmode="numeric" pattern="[0-9]*" data-in="samt" data-who="${s}" min="${lo}" max="${mx}" value="${v}" aria-label="暗標金額">
      <button class="stp" data-act="sstep" data-who="${s}" data-v="1" ${v<mx?'':'disabled'}>＋</button>
      <button class="bb go" data-act="sbid" data-who="${s}" data-amt="${v}">${g.sb[s]!=null&&NET.mode!=='local'?'改成':'送出'}<small>$${v}</small></button></div>
      <div class="bbtns"><button class="bb pass" data-act="sbid" data-who="${s}" data-amt="${lo}" style="grid-column:1/-1">${lo?`維持 $${lo}`:'不要（出 $0）'}</button></div>
      ${g.sb[s]!=null&&NET.mode!=='local'?`<div class="small" style="margin-top:6px;color:var(--ok);font-weight:800">✓ 已送出 $${g.sb[s]}，揭曉前還能改</div>`:''}`}
  if(g.price!=null&&!g.grab){if(!bidders(g).includes(s))return '';const pr=dutchAt(g,now()),can=maxBid(g,s)>=pr,open=now()>=g.openAt;
    if(g.pass[s])return '<div class="small mut" style="margin-top:6px">這張不要了</div>';
    return `<div class="solo"><button class="bb go grabb" data-act="grab" data-who="${s}" data-p="${pr}" ${can&&open?'':'disabled'}>${can?`⚡ 用 $${pr} 買<small>${open?'先按先得':'準備…'}</small>`:`等降到 $${maxBid(g,s)}`}</button>
      <button class="bb pass" data-act="spass" data-who="${s}">不要</button></div>`}
  return ''}
const fmtState=(g,s)=>g.sb?'':g.price!=null?(g.grab&&g.grab.who.includes(s)?'按下了！':g.pass[s]?'不要了':maxBid(g,s)<dutchAt(g,now())&&openN(g,s)?'等降價':''):g.stage==='nom'?(g.nomBy===s?'提名中…':''):'';
// role chip on a bench plate in the lineup screen (tap to cycle)
function roleChip(g,s,p,locked){const r=p.role||natRole(p),f=roleFit(p,r),nx=BROLES[(BROLES.indexOf(r)+1)%BROLES.length];
  return `<button class="rolec r${r}" ${locked?'disabled':''} data-act="brole" data-who="${s}" data-v="${p.slot}" data-role="${nx}">${BROLE[r].nm}${f.tier>0?` <i class="tag t${f.tier>1?2:1}">${f.tier>1?'不適合':'勉強'}</i>`:''} <span>⇄</span></button>`}
function benchSummary(g,s){const E=g.rosters[s].filter(r=>isBench(r.slot)),c=k=>E.filter(r=>r.role===k).length,ok=benchOK(g,s);
  return `<div class="blab">替補<span class="bsum">後衛 ${c('G')}・鋒線 ${c('F')}・第六人 ${c('X')}</span></div>${ok?'':'<div class="bwarn">替補至少要 1 位後衛、1 位鋒線，第六人只能 1 位</div>'}`}
function sfxBtn(){const ic=['🔇','🔈','🔊'][SFX.lv];return `<button class="small mut sfxb" data-act="sfx" aria-label="音效">${ic}</button>`}
// lobby card for a game against the computer: your name, the opponents, difficulty
function aiLobby(sides,dis){const bots=sides.filter(isBot),lv=S.botLv||'normal';
  return `<section class="card"><h2>挑戰電腦</h2>
    <div class="row" style="margin-bottom:8px"><span class="dot" style="background:${col('A')}"></span><input data-in="name" data-i="A" maxlength="12" value="${esc(S.names.A)}" ${dis} aria-label="你的名字"></div>
    ${bots.map(s=>{const st=S.bots[s].st,opt=(k,l)=>`<option value="${k}" ${st===k?'selected':''}>${l}</option>`;
      return `<div class="botrow2"><span class="dot" style="background:${col(s)}"></span><b>🤖 電腦 ${s}</b>
        <select class="bsel" data-in="aist" data-i="${s}" ${dis} aria-label="電腦 ${s} 的風格">${opt('rand','🎲 隨機')}${opt('mix','🔀 混搭')}<optgroup label="固定風格">${STYLE_K.map(k=>opt(k,BOT_STYLE[k].nm.replace('🤖 ',''))).join('')}</optgroup></select></div>
        <div class="bdesc">${st==='rand'?'每局隨機換風格，有時是兩種混搭':st==='mix'?'每局隨機混合兩種風格':BOT_DESC[st]}</div>`}).join('')}
    <div class="small mut" style="margin:2px 0 4px">各風格怎麼出價，看「玩法說明 → 更多」。</div>
    <div class="fl" style="margin-top:12px">電腦強度</div>
    <div class="fgrid lv">${Object.entries(BOT_LV).map(([k,L])=>`<button class="fopt ${lv===k?'on':''}" data-act="ailv" data-v="${k}" ${dis}><b>${L.nm}</b><small>${L.d}</small></button>`).join('')}</div>
    <div class="small mut" style="margin-top:8px">電腦只能用跟你一樣的按鈕出價，看不到還沒翻的牌、你的任務、暗標和戰術。</div></section>`}
// last team with open spots: every card left is face up, sign the ones you want for $1
function leftPanel(g,r){const who=g.solo.who,mine=r==='all'||r===who,L=leftovers(g),need=openN(g,who),sel=ui.leftSel&&ui.leftSel.gid===g.gid&&ui.leftSel.idx===g.idx?ui.leftSel.j:null;
  return `<div class="nomhd"><div class="nt">只剩 <b style="color:${col(who)}">${esc(nm(S,who))}</b> 有空位</div>
    <div class="small mut">${mine?`對手都滿了，剩下的牌全部翻開，照標價挑 <b>${need}</b> 位（你最多能出 $${maxBid(g,who)}）`:`剩下的牌全部翻開，${esc(nm(S,who))} 照標價挑 ${need} 位`}</div></div>
    ${L.length?`<div class="mkt left">${L.map((x,i)=>miniCard(g,x,{btn:mine&&leftOK(g,who,x.p),sel:sel===x.j,i,act:'lsel',price:leftPrice(g,x.p),dim:!leftOK(g,who,x.p)})).join('')}</div>`:'<div class="center mut" style="margin:14px 0">牌堆空了</div>'}
    <div class="nomft">${mine&&L.length?`<button class="big" data-act="lpick" data-v="${sel==null?'':sel}" ${sel==null?'disabled':''}>${sel==null?'先點一位球員':`✍️ 簽下 ${esc(String(g.items[sel].n))}（$${leftPrice(g,g.items[sel])}）`}</button>`:''}
    ${mine?`<button class="linkb" data-act="lnone">${ui.lnone?'再按一次確認：剩下的位置用自由球員補':`剩下的都不要，${need} 個位置用自由球員補`}</button>`:''}
    ${clock(g.leftEnd,T_LEFT,mine?'時間到自動簽最適合你的：':'挑選倒數：',mine&&r!=='all')}</div>`}

// the beat after a card: who won, for how much, where he goes, and a bar running down to the next card
function soldBanner(g,H){const l=H.l,p=g.items[H.k],d=Math.max(300,H.until-H.at),last=String(p&&p.n||'').split(' ').slice(-1)[0];
  if(!l.who)return `<div class="soldb pass" style="--d:${d}ms"><div class="sd1">流標</div><div class="sd2">沒有人要 ${esc(last)}</div><div class="sdbar"><i></i></div></div>`;
  return `<div class="soldb" style="--c:${col(l.who)};--d:${d}ms"><div class="sd1">成交</div>
    <div class="sd2"><b>${esc(nm(S,l.who))}</b> 標下 ${esc(last)}</div><div class="sd3"><b class="sdp">$${l.amt}</b>${l.full?`<s>$${l.full}</s><small>打折券</small>`:''}${l.slot?`<span>${esc(l.slot)}</span>`:''}</div><div class="sdbar"><i></i></div></div>`}

/* reading time box: the clock is stopped while everyone takes in the new card */
function readBox(g,r){const left=Math.max(0,(g.readEnd||0)-now()),need=g.sides.filter(s=>!isBot(s)&&openN(g,s)>0),loc=r==='all'&&NET.mode==='local';
  const me=loc?g.sides[0]:r,mine=loc||need.includes(r),done=!loc&&g.rd&&g.rd[me],n=need.filter(s=>g.rd&&g.rd[s]).length;
  clearTimeout(ui.readT);ui.readT=setTimeout(()=>render(),left+80);
  return `<div class="cur readb"><div class="rdh">看牌時間</div>${clock(g.readEnd,readMs(g),'倒數完才能出價・',false)}
    ${need.length>1&&!loc?`<div class="small mut">${n}/${need.length} 人看好了</div>`:''}
    ${mine?`<button class="ghost rdbtn" data-act="rdone" ${done?'disabled':''}>${done?'等其他人看完…':'看好了，開始'}</button>`:''}</div>`}
