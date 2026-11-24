/* ---------- ability cards (能力卡) ----------
 Optional (lobby toggle). Before the auction every player secretly picks 2 of the 4 cards; each can be used once.
 Design rules, so the cards add choices without breaking the game:
 - every card is one-shot and only usable at a clear moment, and using one is announced to everyone;
 - no card changes how a card ends (still sold through sell() or passed through skipCard()), so formats, missions,
   seasons, the leftover stage and the AI keep working unchanged;
 - effects are small next to a good auction: 85% coupon (not half), +1 rating for home court, information, or a delay.
   🔄 換一張  a card nobody has bid on yet goes to the bottom of the deck and the next one comes up. If every team
             fills up first, it never comes back, so it can also keep a star away from a rich rival.
   💸 打折券  arm it (everyone sees it is armed); your next win of $4 or more costs 85% (rounded).
   🏟️ 主場優勢 +1 team rating in the match simulation, automatic.
   🕵️ 球探報告 see the next 3 cards in the deck, plus one rival's mission card when missions are on. Only you see it. */
const CARDS={
  swap:{ic:'🔄',nm:'換一張',d:'還沒人出價的牌移到牌堆最後，直接換下一張',when:'牌剛翻開、還沒人出價時'},
  coupon:{ic:'💸',nm:'打折券',d:'啟動後，你下一次得標價 $4 以上打 85 折（四捨五入）',when:'拍賣中隨時啟動（大家看得到）'},
  home:{ic:'🏟️',nm:'主場優勢',d:'模擬對戰時全隊戰力 +1',when:'自動生效'},
  scout:{ic:'🕵️',nm:'球探報告',d:'偷看牌堆接下來 3 張；有任務卡時再偷看一位對手的任務',when:'拍賣中隨時（只有你看得到）'}};
const CARD_IDS=Object.keys(CARDS),CARD_PICK=2,T_CARD=25000,COUPON=0.85,COUPON_MIN=4;
function dealCards(g){const o={};g.sides.forEach(s=>{o[s]={pick:null,used:{},armed:false,scout:null}});return o}
const hasCard=(g,s,id)=>!!(g.cards&&g.cards[s]&&g.cards[s].pick&&g.cards[s].pick.includes(id)&&!g.cards[s].used[id]);
function autoCards(g,s){const C=g.cards[s];if(!C.pick){C.pick=['home','coupon'];C.auto=1}}
// after the card pick: missions (if on), then the auction
function prepNext(S){const g=S.game,c=S.cfg,n=g.sides.length;
  if(c.mis&&!g.mis){const M=dealMissions(g,rng(hash(g.gid+'mis')));if(g.sides.every(s=>M[s].opts.length)){g.mis=M;g.misEnd=now()+T_MIS*(NET.mode==='local'?n:1);S.phase='mission';return}}
  beginAuction(S)}
// can this side use the swap right now: a real card is up and nobody has committed money to it
function canSwap(g,s){if(!hasCard(g,s,'swap')||S.phase!=='auction'||inPause(g)||g.stage||g.solo||remain(g)<2||cur(g).fa)return false;
  if(g.sb)return !g.tie;if(g.price!=null)return !g.grab;return !g.bid.who}
const cardEv=(g,who,id,x)=>{g.ev={n:((g.ev&&g.ev.n)||0)+1,who,id,at:now(),...x}};
function useCard(S,who,a){const g=S.game;if(!g||!g.cards||!g.cards[who])return false;const C=g.cards[who],id=a.id;
  if(S.phase==='cards'){if(id!=='pick')return false;const L=Array.isArray(a.ids)?[...new Set(a.ids)]:[];
    if(L.length!==CARD_PICK||!L.every(x=>own(CARDS,x)))return false;C.pick=L;C.auto=0;if(g.sides.every(s=>g.cards[s].pick))prepNext(S);return true}
  if(!hasCard(g,who,id)||S.phase!=='auction')return false;
  switch(id){
    case 'swap':{if(!canSwap(g,who))return false;const p=g.items.splice(g.idx,1)[0];g.items.push(p);C.used.swap=true;cardEv(g,who,id,{n2:p.n});startCard(S);return true}
    case 'coupon':{C.armed=!C.armed;if(C.armed)cardEv(g,who,id,{});return true}
    case 'scout':{if(inPause(g))return false;const R=g.sides.filter(t=>t!==who);const t=R.length===1?R[0]:R.includes(a.t)?a.t:null;if(g.mis&&!t)return false;
      const next=g.items.slice(g.idx+1).filter(p=>!p.fa).slice(0,3).map(p=>({n:p.n,pos:canPlay(p)}));
      const M=t&&g.mis&&g.mis[t],mis=M&&M.pick!=null?M.opts[M.pick]:null;
      C.scout={next,t,mis,at:g.idx};C.used.scout=true;cardEv(g,who,id,{});return true}}
  return false}
// price actually paid (sell calls this): an armed coupon takes 15% off a win of $4+
function couponPay(g,who,amt){const C=g.cards&&g.cards[who];if(!C||!C.armed||C.used.coupon||amt<COUPON_MIN)return amt;
  C.used.coupon=true;C.armed=false;return Math.max(1,Math.round(amt*COUPON))}
const homeAdj=(g,s)=>g.cards&&g.cards[s]&&g.cards[s].pick&&g.cards[s].pick.includes('home')?1:0;

/* ---------- views ---------- */
function cardTile(id,o){const C=CARDS[id];
  return `<${o.btn?'button':'div'} class="acard ${o.sel?'sel':''} ${o.used?'used':''}" ${o.btn?`data-act="csel" data-v="${id}"`:''} style="--i:${o.i||0}">
    <span class="aic">${C.ic}</span><b>${C.nm}</b><small>${C.d}</small><i class="awhen">${C.when}</i>${o.sel?'<span class="mck2">✓</span>':''}</${o.btn?'button':'div'}>`}
function vCards(){const g=S.game,r=myRole(),local=NET.mode==='local',sides=g.sides;
  const chooser=local?sides.find(s=>!g.cards[s].pick):(ALL.includes(r)&&g.sides.includes(r)?r:null);
  const sel=(ui.csel&&ui.csel.gid===g.gid&&ui.csel.who===chooser?ui.csel.ids:null)||(chooser&&g.cards[chooser].pick)||[];
  const status=sides.map(s=>{const done=!!g.cards[s].pick;return `<div class="mstat ${done?'done':''} ${s===chooser?'mcur':''}"><span class="dot" style="background:${col(s)}"></span><b>${esc(nm(S,s))}</b><span class="grow"></span>${done?`<span>已選好 ✓${g.cards[s].auto?'<small>（自動）</small>':''}</span>`:'<span class="mut">選擇中…</span>'}</div>`}).join('');
  const body=chooser?`<div class="mwho" style="color:${col(chooser)}">${local?`輪到 <b>${esc(nm(S,chooser))}</b> 選能力卡<div class="small mut" style="font-weight:600">其他人先別看 🙈</div>`:`選 ${CARD_PICK} 張帶進這局`}</div>
      <div class="agrid">${CARD_IDS.map((id,i)=>cardTile(id,{btn:1,sel:sel.includes(id),i})).join('')}</div>
      <button class="big" style="margin-top:12px" data-act="cpick" data-who="${chooser}" ${sel.length===CARD_PICK?'':'disabled'}>${sel.length===CARD_PICK?`帶 ${sel.map(x=>CARDS[x].ic+' '+CARDS[x].nm).join(' ＋ ')} 上場`:`再選 ${CARD_PICK-sel.length} 張`}</button>
      ${!local&&g.cards[chooser].pick?'<div class="small mut center" style="margin-top:8px">已選好，等其他人…（還可以改）</div>':''}`
    :`<div class="center mut" style="margin:18px 0"><span class="spin"></span> 玩家正在選能力卡…</div>`;
  return `<div class="mhead">${roundPill(g)}<div class="mtitle">🃏 選 ${CARD_PICK} 張能力卡</div>
    <div class="small mut">每張整局只能用一次。你帶了哪幾張是<b>秘密</b>，用的時候大家才會看到。</div>
    <div style="max-width:300px;margin:10px auto 0">${clock(g.cardEnd,T_CARD*(local?sides.length:1),'時間到自動帶 🏟️＋💸：')}</div></div>
    ${body}<section class="card mstats">${status}</section>`}
// the card tray inside a player's row on the auction screen
function cardTray(g,s,r){if(!g.cards||!g.cards[s]||!g.cards[s].pick||S.phase!=='auction')return '';const C=g.cards[s],mine=r===s||(r==='all'&&ui.peek===s);
  if(!mine){const left=C.pick.filter(id=>!C.used[id]&&!(id==='coupon'&&C.armed)).length,usedL=C.pick.filter(id=>C.used[id]);   // the hidden count includes home court, so it gives nothing away
    return `<div class="atray other">${usedL.map(id=>`<span class="achip used">${CARDS[id].ic} ${CARDS[id].nm}<small>已用</small></span>`).join('')}${C.armed?'<span class="achip armed">💸 打折中</span>':''}${left?`<span class="achip back">🃏 ×${left}</span>`:''}
      ${r==='all'?`<button class="achip back" data-act="peek" data-who="${s}">👁 看我的卡</button>`:''}</div>`}
  return `<div class="atray">${C.pick.map(id=>{const used=C.used[id]||(id==='home'),live=id==='swap'?canSwap(g,s):id==='coupon'?!C.used.coupon:id==='scout'?!C.used.scout:false;
      const lab=id==='home'?'自動':C.used[id]?'已用':id==='coupon'&&C.armed?'打折中':'';
      return `<button class="achip ${C.used[id]?'used':''} ${id==='coupon'&&C.armed?'armed':''} ${live?'live':''}" data-act="cinfo" data-who="${s}" data-v="${id}">${CARDS[id].ic} ${CARDS[id].nm}${lab?`<small>${lab}</small>`:''}</button>`}).join('')}
    ${C.scout?`<button class="achip rep" data-act="cinfo" data-who="${s}" data-v="report">📋 報告</button>`:''}</div>`}
// bottom sheet: what a card does and the button to use it
function cardSheet(){const x=ui.csheet;if(!x||!S||!S.game||S.phase!=='auction')return '';const g=S.game,s=x.who,C=g.cards&&g.cards[s];if(!C)return '';
  if(x.id==='report'){const R=C.scout;if(!R)return '';
    return `<div class="asheet"><div class="abg" data-act="cclose"></div><div class="ain"><div class="atitle">🕵️ 球探報告</div>
      <div class="small mut">第 ${R.at+1} 張時看到的牌堆順序（之後有人換牌或提名，順序可能會變）</div>
      <ol class="arep">${R.next.map(p=>`<li><b>${esc(p.n)}</b> <small>${p.pos.join(' ')}</small></li>`).join('')||'<li class="mut">後面沒牌了</li>'}</ol>
      ${R.mis?`<div class="arepm">${esc(nm(S,R.t))} 的任務：<b>${misOf(R.mis.id).ic} ${esc(misOf(R.mis.id).nm)}</b><div class="small">${esc(misDesc(R.mis,g,R.t))}</div></div>`:''}
      <button class="big" data-act="cclose">知道了</button></div></div>`}
  const id=x.id,K=CARDS[id],used=C.used[id];let act='';
  if(id==='swap')act=canSwap(g,s)?`<button class="big" data-act="cuse" data-v="swap">🔄 換掉 ${esc(String(cur(g).n))}</button>`:`<div class="small mut center">${used?'已經用過了':'要在牌剛翻開、還沒人出價時才能用'}</div>`;
  else if(id==='coupon')act=used?'<div class="small mut center">已經用過了</div>':`<button class="big ${C.armed?'off':''}" data-act="cuse" data-v="coupon">${C.armed?'先不要用（關掉打折券）':'💸 啟動打折券'}</button><div class="small mut center" style="margin-top:6px">得標價 $${COUPON_MIN} 以上才會用掉：$10 → $9、$20 → $17</div>`;
  else if(id==='scout'){const R=g.sides.filter(t=>t!==s);act=used?'<div class="small mut center">已經用過了</div>':g.mis&&R.length>1?`<div class="small mut center">要偷看誰的任務？</div><div class="arow">${R.map(t=>`<button class="big" data-act="cuse" data-v="scout" data-t="${t}" style="background:${col(t)}">${esc(nm(S,t))}</button>`).join('')}</div>`:`<button class="big" data-act="cuse" data-v="scout">🕵️ 看球探報告</button>`}
  else act='<div class="small mut center">不用操作，模擬對戰時自動 +1</div>';
  return `<div class="asheet"><div class="abg" data-act="cclose"></div><div class="ain">${cardTile(id,{used})}<div style="margin-top:12px">${act}</div><button class="linkb" data-act="cclose">關閉</button></div></div>`}
// everyone sees a card being played: a short flip-in banner
function cardFlash(g){const e=g&&g.ev;if(!e||now()-e.at>2200)return '';const K=CARDS[e.id];
  return `<div class="aflash" id="af-${g.gid}-${e.n}" style="--c:${col(e.who)}"><div class="acard big1"><span class="aic">${K.ic}</span><b>${K.nm}</b></div>
    <div class="aftx"><b style="color:${col(e.who)}">${esc(nm(S,e.who))}</b> ${e.id==='coupon'?'啟動了打折券':e.id==='swap'?`把 ${esc(String(e.n2||''))} 換掉了`:'用了球探報告'}</div></div>`}
