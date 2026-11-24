/* ---------- AI opponents (對戰電腦) ----------
 One human (seat A) against one or two computer GMs on the same phone. Bots act only through the normal actions
 (bid, pass, sbid, grab, spass, nominate, mpick, ready), so they can never do anything a human could not.

 How a bot values a card
   1. Team need: the auto-placement search (place.js) scores the bot's roster with the card added and with a
      replacement-level player added instead. The difference is the card's worth to THIS roster in rating points
      (the units the match sim uses): a second center with C taken is worth little, a missing guard a lot.
   2. Extras: completing a legend group and feuds (普通/高手); mission cards (高手: a card that would break a "none"
      mission counts against, money missions cap spending).
   3. Points to dollars, the way auction-value sheets do it: all money still spendable above $1 per open spot,
      divided by the total surplus of the players left who will actually be bought (bench spots count less).
      Each style bends this curve: 巨星控 pays up for stars, 精算師 spreads money, 穩健派 sits in between.
   4. A fixed per-card noise (difficulty) so bots disagree with each other and are not perfectly predictable.
   高手 also keeps money missions (精打細算 keeps its reserve, 雨露均霑 never pays over its cap).

 How it acts
   open    raises by $1 (sometimes a jump bid), opens around a third to half of its max, never above what any rival
           could still pay, passes at its max.
   sealed  bids just above what it expects the strongest rival to pay (rival rosters and budgets are public),
           never above its own max; 新手 shades at random.
   snatch  (Dutch clock) picks the price to stop at like a sealed bid, then taps when the clock reaches it, after a
           human-like reaction time.
   nominate puts up the card rivals want most and it wants least (drains their money); when it is the richest
           team it nominates its own target instead.
   last team: signs the leftover card that adds most to its roster ($1 each).
   ability cards: 普通/高手 bring home court plus the coupon (sometimes the swap), arm the coupon before a big buy and swap
           away a card a rival values far more than they do; 新手 picks and plays them more randomly.
 Timing: every decision waits a "thinking" delay that grows with the stakes, and never runs into the deadline. */
const BOT_LV={
  easy:{nm:'新手',d:'常亂出價，適合熟悉規則',noise:0.3,aware:0,shade:[0.45,0.95],react:[1000,2000],think:[1600,3600],jump:0.3},
  normal:{nm:'普通',d:'看陣容缺什麼出價，懂傳奇組合',noise:0.2,aware:1,react:[600,1300],think:[1100,2900],jump:0.2},
  hard:{nm:'高手',d:'再加上做任務、精算暗標，反應更快',noise:0.1,aware:2,react:[330,800],think:[900,2400],jump:0.12}};
// c bends dollars per rating point: above 1 pays a premium for stars (auctions do), below 1 spreads money
const BOT_STYLE={bal:{nm:'🤖 穩健派',c:1.2},star:{nm:'🤖 巨星控',c:1.6},depth:{nm:'🤖 精算師',c:0.85}};
const SAVE_PT=0.3,SAVE_CAP=2.5;   // savAdj in baseRate: 0.3 rating per leftover $, capped at 2.5
const isBot=s=>NET.mode==='ai'&&!!(S&&S.bots&&S.bots[s]);
const botLv=s=>BOT_LV[S&&S.bots&&s&&S.bots[s]&&S.bots[s].lv||S&&S.botLv]||BOT_LV.normal;   // per-seat level is for tests
const BOT_DESC={bal:'預算平均分配',star:'愛砸大錢買巨星',depth:'追求便宜好用'};
// st is the chosen style or 'rand'; play is the style actually used this game
const botSt=s=>{const b=S.bots&&S.bots[s];return BOT_STYLE[b&&(b.st==='rand'?b.play:b.st)]||BOT_STYLE.bal};
// before each game: random styles get rolled (once per season, so a season keeps the same opponents), names follow the style
function aiAssign(S){if(!S.bots)return;const sides=Object.keys(S.bots),taken=sides.filter(s=>S.bots[s].st!=='rand').map(s=>S.bots[s].st);
  sides.forEach(s=>{const b=S.bots[s];if(b.st==='rand'&&(!S.season||!b.play)){const free=Object.keys(BOT_STYLE).filter(k=>!taken.includes(k));b.play=free[Math.floor(Math.random()*free.length)]||'bal'}
    if(b.st==='rand')taken.push(b.play);S.names[s]=BOT_STYLE[b.st==='rand'?b.play:b.st].nm})}
function gauss(R){const u=Math.max(1e-9,R()),v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
/* What a bot may know about a card: only what the card face shows. The match sim uses the numbers of the card's own
   season(s), which stay hidden unless 顯示數據 is on; the face shows the player's career numbers and honours. So bots
   value that reputation adjusted by the card's phase badge (🔥 巔峰期 / 🍂 生涯晚期 …, see phase.js), exactly like a
   person reading the card, and switch to the season numbers only when everyone can see them. Tapping 看年代和球隊 can still reward a fan who knows
   which season a card is. */
const PUBV=new WeakMap();
function pubVal(p){if(!p||p.fa)return -1;if(S&&S.game&&S.game.showStats)return pval(p);if(PUBV.has(p))return PUBV.get(p);
  const c=CAREER&&CAREER.get(normName(p.n)),v=c&&typeof c.obpm==='number'?pval({...p,obpm:c.obpm,dbpm:c.dbpm,mp:c.mp,g:c.g})+phaseGap(phaseOf(p)):pval(p);PUBV.set(p,v);return v}
const pubStar=p=>starScore(p)-pval(p)+pubVal(p);
// per-card cache: the market and each bot's numbers stay fixed while a card is up
const BC={k:''};
function botCache(g){const k=g.gid+':'+g.idx+':'+g.log.length+':'+(g.stage||'')+':'+g.items.length;if(BC.k!==k){BC.k=k;BC.m=null;BC.v={}}return BC}
/* what is left in the deck, as far as a player at the table can know it. Bots do not read the face-down deck, and
   they do not get the theme's player list either (a person only sees the theme's name, and only after tapping
   看年代和球隊). They see the cards that are face up (the card on the block, the nomination market, the leftover
   table), the cards already shown, and how many are still to come. The unseen cards are estimated from what has been
   shown so far, blended with the spread of every card in the game (worth five cards of evidence), so early on the
   guess is generic and it sharpens as the deck shows its hand. */
let ALLV=null;const allVals=()=>{if(ALLV)return ALLV;const seen=new Set(),v=[];THEMES.forEach(t=>t.items.forEach(p=>{const k=p.id+':'+p.y0;if(!p.fa&&!seen.has(k)){seen.add(k);v.push(pubVal(p))}}));return ALLV=v.sort((a,b)=>b-a)};
function deckEst(g){const vis=(g.stage==='left'?leftovers(g).map(x=>x.p):g.stage==='nom'?market(g).map(x=>x.p):[cur(g)]).filter(p=>p&&!p.fa);
  const n=Math.max(0,realLeft(g)-vis.length),shownV=g.items.slice(0,g.idx).filter(p=>!p.fa).map(pubVal).concat(vis.map(pubVal));
  const est=[];if(n>0){const A=allVals(),PRIOR=5,wS=1,wA=PRIOR/Math.max(1,A.length);
    const q=shownV.map(v=>({v,q:wS})).concat(A.map(v=>({v,q:wA}))).sort((a,b)=>b.v-a.v),tot=q.reduce((t,x)=>t+x.q,0);
    let cum=0,j=0;for(let i=0;i<n;i++){const t=(i+0.5)/n*tot;while(j<q.length-1&&cum+q[j].q<t){cum+=q[j].q;j++}est.push(q[j].v)}}
  return vis.map(pubVal).concat(est).sort((a,b)=>b-a)}
function botMarket(g){const C=botCache(g);if(C.m)return C.m;
  const vals=deckEst(g);
  let os=0,ob=0;g.sides.forEach(t=>openSlots(g,t).forEach(x=>isBench(x)?ob++:os++));
  const N=os+ob,vN=N>0&&vals.length>=N?vals[N-1]:-1;
  const money=g.sides.reduce((a,t)=>a+Math.max(0,left(g,t)-openN(g,t)),0);
  return C.m={vals,os,ob,N,vN,money}}
// dollars per rating point for a style curve
function botLam(g,c){const M=botMarket(g);let sum=0;M.vals.slice(0,M.N).forEach((v,r)=>{sum+=(r<M.os?1:PLACE_BENCH)*Math.pow(Math.max(0,v-M.vN),c)});return M.money/Math.max(sum,0.3)}
// what this card adds to the side's roster over a replacement-level player
function botGain(g,s,p){const C=botCache(g),ck='g'+s+':'+g.items.indexOf(p);if(C.v[ck]!=null)return C.v[ck];
  const L=g.rosters[s].map(r=>({p:g.items[r.k],v:pubVal(g.items[r.k])})),sm=slotMisOf(g,s),vN=botMarket(g).vN;
  const a=placeSearch(g,L.concat([{p,v:pubVal(p)}]),sm,vN).score,b=placeSearch(g,L.concat([{p,v:vN,flex:1}]),sm,vN).score;
  return C.v[ck]=a-b}
const misBonus=x=>x.bonus!=null?x.bonus:MTIER[x.tier].bonus;
function botExtra(g,s,p){let x=0;
  legendHints(g,p).forEach(h=>{if(h.s===s)x+=h.t==='complete'?legVal(h.L,h.L.need):0.3});
  const P=botLv(s).aware>1&&misProg(g,s);if(P&&!P.dead&&P.done!==true)misHints(g,p).forEach(h=>{if(h.s===s)x+=h.t==='bad'?-misBonus(P.x):0.6*misBonus(P.x)});
  if(g.rosters[s].some(r=>feudOf(p,g.items[r.k])))x-=0.6;
  return x}
// spending limits from money missions (高手 only)
function botCap(g,s){let cap=maxBid(g,s);const P=botLv(s).aware>1&&misProg(g,s);
  if(P&&!P.dead&&P.done!==true){const t=misT(P.m,budOf(g,s));
    if(P.m.k==='left')cap=Math.min(cap,left(g,s)-t-(openN(g,s)-1));
    if(P.m.k==='cap')cap=Math.min(cap,t)}
  return Math.max(0,cap)}
const realLeft=g=>g.items.slice(g.idx).filter(p=>!p.fa).length;
// most this side would pay for card p. opt.est: a plain estimate for a rival (no noise, no extras, balanced style)
function botMax(g,s,p,opt){p=p||cur(g);if(!p||!openN(g,s))return 0;const est=opt&&opt.est,C=botCache(g),ck=(est?'e':'m')+s+':'+g.items.indexOf(p);
  if(C.v[ck]!=null)return C.v[ck];
  const lv=botLv(s),c=est?1.2:botSt(s).c,M=botMarket(g);
  const sur=botGain(g,s,p)+(!est&&lv.aware?botExtra(g,s,p):0);
  const nz=est?1:Math.exp(lv.noise*gauss(rng(hash(g.gid+':'+g.items.indexOf(p)+':'+s))));
  // a team holding more spare money than the table average can afford to pay more (money left past the savings cap is wasted)
  const spare=t=>Math.max(0,left(g,t)-openN(g,t)),avg=g.sides.reduce((x,t)=>x+spare(t),0)/g.sides.length,rich=avg>0?clamp(Math.sqrt(spare(s)/avg),0.6,1.6):1;
  // style attitude to the deck's top cards: 巨星控 pays a premium for them, 精算師 lets them go and pays a bit more for depth
  const top=M.vals.length?pubVal(p)>=M.vals[Math.min(2,M.vals.length-1)]:false,att=est?1:{star:top?1.4:0.95,depth:top?0.85:1.08}[S.bots&&S.bots[s]&&(S.bots[s].st==='rand'?S.bots[s].play:S.bots[s].st)]||1;
  let v=sur>0?1+botLam(g,c)*(est?1:rich)*att*Math.pow(sur,c)*nz:0;
  // cards are running out: the alternative is a free agent. Unspent money is worth SAVE_PT rating per $ in the match
  // sim, and nothing past SAVE_CAP, so money a team cannot spend well is better spent on anyone above a free agent
  if(realLeft(g)<=M.N+1){const L=g.rosters[s].map(r=>({p:g.items[r.k],v:pubVal(g.items[r.k])})),sm=slotMisOf(g,s);
    const gFA=placeSearch(g,L.concat([{p,v:pubVal(p)}]),sm,-1).score-placeSearch(g,L.concat([{p,v:-1,flex:1}]),sm,-1).score;
    const spare=left(g,s)-openN(g,s);
    if(gFA>0)v=Math.max(v,1+gFA/SAVE_PT+Math.max(0,spare-SAVE_CAP/SAVE_PT)/Math.max(1,openN(g,s)))}
  if(!est&&lv.aware>1){const P=misProg(g,s);                        // 一擲千金 / 標王: be ready to pay big for a top card
    if(P&&!P.dead&&P.done!==true&&(P.m.k==='big'||P.m.k==='topbid')&&M.vals.length&&pubVal(p)>=M.vals[Math.min(2,M.vals.length-1)]){
      const t=P.m.k==='big'?misT(P.m,budOf(g,s)):Math.max(0,...g.sides.filter(x=>x!==s).flatMap(x=>g.rosters[x].map(r=>r.price)))+1;
      if(t<=maxBid(g,s))v=Math.max(v,t)}}
  return C.v[ck]=Math.max(0,Math.min(Math.floor(v),est?maxBid(g,s):botCap(g,s)))}
// a rival's private valuation (its style, its noise, its mission) is not visible, not even another bot's: every rival
// is read the same way, as a plain public estimate
const botRivalMax=(g,s,p)=>Math.max(0,...g.sides.filter(t=>t!==s&&openN(g,t)>0).map(t=>Math.min(maxBid(g,t),botMax(g,t,p,{est:1}))));

// first-price bid (sealed bid, or where to stop the Dutch clock): just above what the strongest rival is expected to pay,
// never above the bot's own max, and spread around that target (a mixed strategy) so it cannot be read off after a few cards
function botFirstPrice(g,s,R,lv,mx){const rr=(a,b)=>a+(b-a)*R();if(mx<=0)return 0;if(lv.shade)return Math.round(mx*rr(...lv.shade));
  const est=botRivalMax(g,s)*(lv.aware>1?rr(0.92,1.08):rr(0.8,1.15)),target=mx>est?Math.min(mx,Math.round(est)+1):Math.round(mx*rr(0.75,0.95));
  const u=R();return clamp(u<0.2?Math.round(rr(target,mx)):u<0.35?Math.round(rr(Math.max(1,mx*0.5),target)):target+(R()<0.5?0:R()<0.5?1:-1),0,mx)}
/* ---------- decisions ---------- */
function botDecide(s){const g=S.game,R=rng(hash(g.gid+':'+g.idx+':'+s+':'+g.bid.amt+':'+(g.stage||'')+(g.tie?'t':''))),lv=botLv(s),rr=(a,b)=>a+(b-a)*R();
  if(S.phase==='cards')return{a:'card',id:'pick',who:s,ids:lv.aware?(R()<0.25?['home','swap']:['home','coupon']):CARD_IDS.slice().sort(()=>R()-0.5).slice(0,CARD_PICK)};
  // ability cards: swap away a card a rival wants far more; arm the coupon before a big buy
  if(S.phase==='auction'&&g.cards&&g.cards[s]&&!g.stage){const C=g.cards[s],own=botMax(g,s),riv=botRivalMax(g,s);
    if(canSwap(g,s)&&(lv.aware?riv-own>=4&&riv>=5:R()<0.05))return{a:'card',id:'swap',who:s,idx:g.idx};
    if(hasCard(g,s,'coupon')&&!C.armed&&(lv.aware?own>=Math.max(COUPON_MIN+1,0.3*left(g,s)):R()<0.15))return{a:'card',id:'coupon',who:s};
    if(hasCard(g,s,'scout')&&R()<0.12)return{a:'card',id:'scout',who:s,t:g.sides.find(t=>t!==s)}}
  if(S.phase==='mission'){const M=g.mis[s],i=lv.aware?Math.max(0,M.opts.findIndex(x=>x.tier===2)):Math.floor(R()*M.opts.length);return{a:'mpick',who:s,i}}
  if(S.phase==='lineup')return{a:'ready',who:s,v:true};
  if(g.stage==='left'){const j=bestLeft(g,s);return j==null?{a:'lnone',who:s,idx:g.idx}:{a:'lpick',who:s,j,idx:g.idx}}
  if(g.stage==='nom'){const Mk=market(g),me=left(g,s)-openN(g,s),rich=g.sides.every(t=>t===s||left(g,t)-openN(g,t)<=me);
    const sc=x=>{if(!lv.aware)return pubStar(x.p)+R()*3;const mine=botMax(g,s,x.p),opp=Math.max(0,...g.sides.filter(t=>t!==s&&openN(g,t)>0).map(t=>botMax(g,t,x.p,{est:1})));
      return rich&&mine>=opp?mine*1.2:opp-0.7*mine};
    const best=Mk.slice().sort((a,b)=>sc(b)-sc(a))[0];return{a:'nominate',who:s,j:best.j,idx:g.idx}}
  if(g.sb){const lo=g.tie?g.tie.amt:0,mx=Math.max(lo,botMax(g,s));let amt;
    if(g.tie)amt=mx<=lo?lo:g.tie.tb===s?(R()<0.65?lo:Math.min(mx,lo+1)):Math.min(mx,lo+1+(R()<0.35?1:0));   // a second tie goes to tie.tb
    else amt=botFirstPrice(g,s,R,lv,mx);
    return{a:'sbid',who:s,amt:clamp(amt,lo,Math.max(lo,Math.min(mx,maxBid(g,s)))),idx:g.idx}}
  // Dutch clock: choose the price to stop at (like a sealed bid), then tap when the clock gets there
  if(g.price!=null){const thr=Math.min(g.price,botFirstPrice(g,s,R,lv,botMax(g,s)));return thr>=1?{a:'grab',who:s,idx:g.idx,p:thr}:{a:'spass',who:s,idx:g.idx}}
  const mx=botMax(g,s),b=g.bid.amt;if(mx<=b)return{a:'pass',who:s,idx:g.idx};
  const rivalCap=Math.max(0,...g.sides.filter(t=>t!==s&&openN(g,t)>0&&!g.pass[t]).map(t=>maxBid(g,t)));
  let amt=!b?Math.max(1,Math.round(mx*(lv.aware?rr(0.3,0.5):rr(0.2,0.7)))):b+1;
  if(b&&mx-b>=5&&R()<lv.jump)amt=b+1+Math.ceil((mx-b)*rr(0.15,0.35));   // the odd jump bid, like people do
  return{a:'bid',who:s,amt:clamp(amt,b+1,Math.min(mx,Math.max(b+1,rivalCap+1))),idx:g.idx}}

/* ---------- driver: runs on the 250 ms tick, one pending decision per bot ---------- */
const BOT={};
function botNeed(s){const g=S.game;if(!g||!g.sides.includes(s))return null;
  if(S.phase==='cards'){const C=g.cards&&g.cards[s];return C&&!C.pick?'c'+g.gid:null}
  if(S.phase==='mission'){const M=g.mis&&g.mis[s];return M&&M.pick==null?'m'+g.gid:null}
  if(S.phase==='lineup')return g.ready[s]?null:'l'+g.gid;
  if(S.phase!=='auction'||inGap(g)||!openN(g,s))return null;const k=g.gid+':'+g.idx+':'+(g.ev?g.ev.n:0)+':';   // a played card can restart the same deck position
  if(g.stage==='nom')return g.nomBy===s?k+'n':null;
  if(g.stage==='left')return g.solo.who===s?k+'l':null;
  // playing an ability card changes the key, so the bot then decides its bid afresh
  const C=g.cards&&g.cards[s],ck=C?':'+Object.keys(C.used).join('')+(C.armed?'a':''):'';
  if(g.sb){const el=g.tie?g.tie.sides:bidders(g);return el.includes(s)&&g.sb[s]==null?k+'s'+(g.tie?'t':'')+ck:null}
  if(g.price!=null)return !g.grab&&!g.pass[s]&&bidders(g).includes(s)?k+'g'+ck:null;
  return g.turn===s?k+g.bid.amt+':'+g.bid.who+ck:null}
function botWait(s,a){const g=S.game,lv=botLv(s),R=Math.random,rr=([x,y])=>x+(y-x)*R(),t0=Math.max(now(),g.gapEnd||0,g.readEnd||0);
  if(window.BB_FAST)return now();
  switch(a.a){
    case 'mpick':return t0+rr([2500,5000]);
    case 'ready':return t0+rr([2500,5500]);
    case 'nominate':return t0+rr([1800,3800]);
    case 'sbid':return t0+rr([2500,7000]);
    case 'grab':return Math.max(t0,g.openAt+Math.max(0,g.price-a.p)*g.step)+rr(lv.react);
    case 'spass':return Math.max(t0,g.openAt)+rr([1300,2800]);
    case 'lpick':case 'lnone':return t0+rr(lv.think);
    case 'card':return a.id==='pick'?t0+rr([2500,5000]):t0+rr([900,1800]);
    case 'pass':return t0+rr([700,1500]);
    default:return t0+rr(lv.think)+Math.min(1500,(a.amt||0)*50)}}   // bigger money, a little longer to think
function botAct(a){const prev=snapOf();if(apply(S,a,{cid:'bot',role:'all'})){fx(prev);commit();return true}(window.BOT_FAILS=window.BOT_FAILS||[]).push(JSON.stringify(a));return false}
// the safe move for a decision point (used if a planned action was refused twice)
function botFallback(s){const g=S.game;if(S.phase==='cards')return{a:'card',id:'pick',who:s,ids:['home','coupon']};if(S.phase==='mission')return{a:'mpick',who:s,i:0};
  if(S.phase==='lineup')return{a:'ready',who:s,v:true};if(g.stage==='nom')return{a:'nominate',who:s,j:g.idx,idx:g.idx};
  if(g.stage==='left'){const j=bestLeft(g,s);return j==null?{a:'lnone',who:s,idx:g.idx}:{a:'lpick',who:s,j,idx:g.idx}}
  if(g.sb)return{a:'sbid',who:s,amt:g.tie?g.tie.amt:0,idx:g.idx};if(g.price!=null)return{a:'spass',who:s,idx:g.idx};return{a:'pass',who:s,idx:g.idx}}
function tickBots(){if(NET.mode!=='ai'||!S||!S.bots||!S.game)return;
  for(const s of S.game.sides){if(!isBot(s))continue;const k=botNeed(s);
    if(!k){delete BOT[s];continue}
    if(!BOT[s]||BOT[s].k!==k){const a=botDecide(s);BOT[s]={k,a,due:botWait(s,a)}}
    if(now()>=BOT[s].due){const B=BOT[s];
      if(B.a.a==='grab'&&S.game.price!=null&&dutchAt(S.game,now())>B.a.p){B.due=now()+(window.BB_FAST?0:60);continue}   // wait for the clock to reach its price
      B.due=Infinity;if(!botAct(B.a)){B.fail=(B.fail||0)+1;B.a=B.fail>1?botFallback(s):botDecide(s);B.due=now()+(window.BB_FAST?0:400)}return}}}   // one action per tick keeps things readable
// a fresh AI table: the human is A, every computer starts on a random style (re-rolled each game)
function aiState(){const s=newState();
  s.bots={B:{st:'rand'},C:{st:'rand'}};s.botLv='normal';s.names={A:clean(MYNAME)||'玩家',B:'🤖 電腦 B',C:'🤖 電腦 C'};s.aiv=2;aiAssign(s);return s}
