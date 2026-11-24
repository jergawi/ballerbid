/* ---------- mission cards ----------
 Each player is dealt 3 public missions and keeps 1. Missions are checked against the actual deck before dealing:
 a mission is only dealt when the deck holds enough players who fit it, and its difficulty (★–★★★) comes from how
 often a random team taken from this deck would complete it by luck (Monte Carlo), so the same mission can be easy
 in one theme and hard in another. A completed mission adds strength to the team (and points in a season). */
const T_MIS=30000;
const MTIER={1:{star:'★',bonus:1.5,pt:1,lab:'簡單'},2:{star:'★★',bonus:2.5,pt:1,lab:'普通'},3:{star:'★★★',bonus:3.5,pt:2,lab:'困難'}};
const Bo=p=>(p&&!p.fa&&bioOf(p))||{};
const skOf=p=>String(Bo(p).sk||'');
const teamKey=p=>{const t=String(p.tm||'');if(!t||/^\dTM$|^TOT$/.test(t)||p.fa)return null;return own(TEAMZH,t)?TEAMZH[t]:t};
const decOf=p=>{if(p.fa||!p.y0)return null;const y=(num(p.y0,0)+num(p.y1,p.y0))/2;return Math.floor((y-1)/10)*10};
const MIS=[
 {id:'shoot',ic:'🎯',nm:'神射手部隊',k:'count',n:[3,5],f:p=>skOf(p).includes('3'),d:n=>`至少 ${n} 人有「三分射手」徽章`},
 {id:'rim',ic:'💥',nm:'禁區轟炸機',k:'count',n:[2,4],f:p=>skOf(p).includes('r'),d:n=>`至少 ${n} 人有「禁區殺手」徽章`},
 {id:'midr',ic:'🏀',nm:'中距離美學',k:'count',n:[2,4],f:p=>skOf(p).includes('m'),d:n=>`至少 ${n} 人有「中投機器」徽章`},
 {id:'mvp',ic:'👑',nm:'MVP 俱樂部',k:'count',n:[2,3],f:p=>Bo(p).mvp>0,d:n=>`至少 ${n} 人拿過年度 MVP`},
 {id:'ring',ic:'💍',nm:'冠軍血統',k:'count',n:[3,5],f:p=>Bo(p).ring>0,d:n=>`至少 ${n} 人拿過總冠軍`},
 {id:'fmvp',ic:'🏅',nm:'總決賽 MVP',k:'count',n:[1,2],f:p=>Bo(p).fmvp>0,d:n=>`至少 ${n} 人拿過總決賽 MVP`},
 {id:'hof',ic:'🏛️',nm:'名人堂陣容',k:'count',n:[3,5],f:p=>Bo(p).hof>0,d:n=>`至少 ${n} 人進了名人堂`},
 {id:'allstar',ic:'⭐',nm:'全明星大集合',k:'count',n:[5,7],f:p=>Bo(p).as>0,d:n=>`至少 ${n} 人入選過全明星`},
 {id:'dfn',ic:'🛡️',nm:'鐵血防線',k:'count',n:[2,3],f:p=>Bo(p).ad1>0||Bo(p).dpoy>0,d:n=>`至少 ${n} 人入選過防守一隊或拿過最佳防守球員`},
 {id:'rook',ic:'🌱',nm:'新秀大禮包',k:'count',n:[2,3],f:p=>Bo(p).roy>0||Bo(p).ar1>0,d:n=>`至少 ${n} 人拿過最佳新秀或入選新秀一隊`},
 {id:'late',ic:'💎',nm:'選秀遺珠',k:'count',n:[2,3],f:p=>{const b=Bo(p);return b.g>0&&(b.dp===0||b.dp>=31)},d:n=>`至少 ${n} 人是第 31 順位以後或落選`},
 {id:'top1',ic:'🥇',nm:'狀元俱樂部',k:'count',n:[1,2],f:p=>Bo(p).dp===1,d:n=>`至少 ${n} 人是選秀狀元`},
 {id:'lotto',ic:'🎰',nm:'樂透區陣容',k:'count',n:[3,5],f:p=>{const d=Bo(p).dp;return d>=1&&d<=5},d:n=>`至少 ${n} 人是前 5 順位`},
 {id:'tall',ic:'🗼',nm:'雙塔',k:'count',n:[2,3],f:p=>Bo(p).ht>=84,d:n=>`至少 ${n} 人身高 7 呎（213 公分）以上`},
 {id:'small',ic:'🐜',nm:'小個子大能量',k:'count',n:[2,3],f:p=>Bo(p).ht>0&&Bo(p).ht<=74,d:n=>`至少 ${n} 人身高 6 呎 2（188 公分）以下`},
 {id:'reb',ic:'🧲',nm:'籃板怪獸',k:'count',n:[2,3],f:p=>!p.fa&&num(p.trb,0)>=10,d:n=>`至少 ${n} 人卡片數據場均 10 籃板以上`},
 {id:'dime',ic:'🧠',nm:'傳球大師',k:'count',n:[2,3],f:p=>!p.fa&&num(p.ast,0)>=7,d:n=>`至少 ${n} 人卡片數據場均 7 助攻以上`},
 {id:'score',ic:'🔥',nm:'得分爆炸',k:'count',n:[2,4],f:p=>!p.fa&&num(p.pts,0)>=25,d:n=>`至少 ${n} 人卡片數據場均 25 分以上`},
 {id:'nick',ic:'🏷️',nm:'外號軍團',k:'count',n:[3,5],f:p=>!p.fa&&!!nickOf(p),d:n=>`至少 ${n} 人有台灣外號（卡片上的外號牌）`},
 {id:'vet',ic:'🧓',nm:'老將智慧',k:'count',n:[2,3],f:p=>Bo(p).from>0&&num(p.y0,0)-Bo(p).from>=9,d:n=>`至少 ${n} 人的卡片是生涯第 10 季以後`},
 {id:'young',ic:'🍼',nm:'年輕風暴',k:'count',n:[2,3],f:p=>Bo(p).from>0&&num(p.y1,0)-Bo(p).from<=2,d:n=>`至少 ${n} 人的卡片是生涯前 3 季`},
 {id:'swat',ic:'🖐️',nm:'禁區守門員',k:'count',n:[2,3],f:p=>!p.fa&&num(p.blk,0)>=1.8,d:n=>`至少 ${n} 人卡片數據場均 1.8 阻攻以上`},
 {id:'thief',ic:'🦝',nm:'抄截大隊',k:'count',n:[2,3],f:p=>!p.fa&&num(p.stl,0)>=1.6,d:n=>`至少 ${n} 人卡片數據場均 1.6 抄截以上`},
 {id:'ftp',ic:'🧊',nm:'罰球穩如山',k:'count',n:[3,5],f:p=>Bo(p).ftp>=0.85,d:n=>`至少 ${n} 人生涯罰球命中率 85% 以上`},
 {id:'dd',ic:'💯',nm:'雙十機器',k:'count',n:[1,2],f:p=>!p.fa&&num(p.pts,0)>=10&&(num(p.trb,0)>=10||num(p.ast,0)>=10),d:n=>`至少 ${n} 人卡片數據場均雙十（得分＋籃板或助攻）`},
 {id:'aro',ic:'🎖️',nm:'全能戰士',k:'count',n:[1,2],f:p=>!p.fa&&num(p.pts,0)>=20&&num(p.trb,0)>=5&&num(p.ast,0)>=5,d:n=>`至少 ${n} 人卡片數據場均 20 分 5 籃板 5 助攻`},
 {id:'sig',ic:'🌟',nm:'招牌球星',k:'count',n:[2,3],f:p=>!p.fa&&(!!sigOf(p)||TOMA.has(p.id)),d:n=>`至少 ${n} 人有招牌技（卡片上的 ⭐ 或 🪓）`},
 {id:'retro',ic:'📼',nm:'復古傳奇',k:'count',n:[2,3],f:p=>{const d=decOf(p);return d!=null&&d<1990},d:n=>`至少 ${n} 人的卡片是 1990 年以前`},
 {id:'noring',ic:'🙅',nm:'無冠也能贏',k:'none',f:p=>Bo(p).ring>0,d:()=>'全隊沒有人拿過總冠軍'},
 {id:'nomvp',ic:'🚫',nm:'不靠 MVP',k:'none',f:p=>Bo(p).mvp>0,d:()=>'全隊沒有人拿過年度 MVP'},
 {id:'noas',ic:'🙈',nm:'無名英雄',k:'none',f:p=>Bo(p).as>0,d:()=>'全隊沒有人入選過全明星'},
 {id:'nothree',ic:'🦖',nm:'老派籃球',k:'none',f:p=>skOf(p).includes('3'),d:()=>'全隊沒有人有「三分射手」徽章'},
 {id:'teams',ic:'🌏',nm:'五湖四海',k:'distinct',n:[5,8],key:teamKey,d:n=>`球員卡片來自至少 ${n} 支不同球隊`},
 {id:'mates',ic:'🤝',nm:'老隊友',k:'same',n:[3,4],key:teamKey,d:n=>`至少 ${n} 人的卡片是同一支球隊`},
 {id:'eras',ic:'⏳',nm:'跨世代',k:'distinct',n:[3,4],key:decOf,d:n=>`球員卡片橫跨至少 ${n} 個年代`},
 {id:'save',ic:'💰',nm:'精打細算',k:'left',frac:0.4,tier:1,d:t=>`競標結束時至少剩 $${t}`},
 {id:'splash',ic:'💸',nm:'一擲千金',k:'big',frac:0.4,tier:1,d:t=>`至少一位球員出價 $${t} 以上`},
 {id:'even',ic:'⚖️',nm:'雨露均霑',k:'cap',frac:0.25,tier:1,d:t=>`每位球員出價都不超過 $${t}`},
 {id:'cheap',ic:'🪙',nm:'撿便宜',k:'cheap',n:[2,3],tier:1,d:n=>`至少 ${n} 位球員用 $1 標到`},
 {id:'cpts',ic:'🏹',nm:'得分王',k:'cmp',key:p=>num(p.pts,0),u:'分',d:()=>'先發五人卡片場均得分加總最高（平手也算）'},
 {id:'creb',ic:'🧱',nm:'籃板王',k:'cmp',key:p=>num(p.trb,0),u:'籃板',d:()=>'先發五人卡片場均籃板加總最高（平手也算）'},
 {id:'cast',ic:'🎁',nm:'助攻王',k:'cmp',key:p=>num(p.ast,0),u:'助攻',d:()=>'先發五人卡片場均助攻加總最高（平手也算）'},
 {id:'cdef',ic:'🧤',nm:'防守王',k:'cmp',key:p=>num(p.stl,0)+num(p.blk,0),u:'抄截＋阻攻',d:()=>'先發五人卡片場均抄截＋阻攻加總最高（平手也算）'},
 {id:'top',ic:'🔨',nm:'標王',k:'topbid',tier:1,d:()=>'本局最高的一筆得標價是你的（平手也算）'},
 {id:'bigc',ic:'🏰',nm:'傳統中鋒',k:'slot',slot:'C',f:p=>!p.fa&&num(p.trb,0)>=10&&num(p.tpa,0)<1,d:()=>'開打時 C 位是場均 10 籃板以上、幾乎不投三分的長人'},
 {id:'pg',ic:'🎩',nm:'控衛大師',k:'slot',slot:'PG',f:p=>!p.fa&&num(p.ast,0)>=7.5,d:()=>'開打時 PG 位是場均 7.5 助攻以上的球員'}];
const misOf=id=>MIS.find(m=>m.id===id)||null;
const misNeed=(m,size)=>m.n?m.n[size===10?1:0]:0;
const misT=(m,bud)=>m.k==='cap'?Math.floor(m.frac*bud):Math.ceil(m.frac*bud);
const budOf=(g,s)=>g.bud&&g.bud[s]!=null?g.bud[s]:g.budget;
function misDesc(x,g,s){const m=misOf(x.id);if(!m)return '';return m.k==='left'||m.k==='big'||m.k==='cap'?m.d(misT(m,budOf(g,s))):m.d(x.need)}
// does a finished (or partial) roster satisfy the mission? R = roster with slots and prices
function misCheck(m,need,R,ctx){
  switch(m.k){
    case 'count':return R.filter(m.f).length>=need;
    case 'none':return !R.some(m.f);
    case 'distinct':return new Set(R.map(m.key).filter(v=>v!=null)).size>=need;
    case 'same':{const c={};let mx=0;R.forEach(p=>{const k=m.key(p);if(k!=null){c[k]=(c[k]||0)+1;mx=Math.max(mx,c[k])}});return mx>=need}
    case 'slot':{const p=R.find(x=>x.slot===m.slot);return !!p&&m.f(p)}
  }return false}
/* difficulty from the deck. Two numbers matter:
   luck – how often a random team from these cards completes it anyway (too high = no real mission, not dealt);
   chase – how often a player who goes after it gets there: he wins each fitting card with probability q
   (0.75 against one rival, 0.5 against two, less when the mission needs most of the roster), so P(Binomial(Q,q) >= need).
   Stars come from the chase number. Tiers were checked against simulated seasons with mission-chasing bots. */
const binTail=(n,k,q)=>{let t=0;for(let i=k;i<=n;i++){let c=1;for(let j=1;j<=i;j++)c=c*(n-i+j)/j;t+=c*Math.pow(q,i)*Math.pow(1-q,n-i)}return t};
function misLuck(m,need,deck,size,r){let ok=0;const N=240;
  for(let i=0;i<N;i++){const sh=shuffle(deck,r).slice(0,size);
    const R=sh.slice(0,5).sort((a,b)=>peOf(a)-peOf(b)).map((p,j)=>({...p,slot:POS[j]})).concat(sh.slice(5).map((p,j)=>({...p,slot:BENCH[j]})));
    if(misCheck(m,need,R))ok++}
  return ok/N}
function misCalib(m,deck,size,players,r){
  const need=misNeed(m,size),Q=m.f?deck.filter(m.f).length:0,q=(players===2?0.75:0.5)*(m.k==='count'?1-0.35*need/size:1); // filling most of the roster with one kind of player also strains the budget
  if(m.k==='count'||m.k==='slot'){const nd=m.k==='slot'?1:need;if(Q<nd+players-1)return null;            // one rival pick must not kill it
    const luck=misLuck(m,need,deck,size,r);if(luck>=0.42)return null;
    const ch=binTail(Q,nd,q);if(ch<0.35)return null;return{tier:ch>=0.85?1:ch>=0.6?2:3,need,q:Q,p:+ch.toFixed(2)}}
  if(m.k==='none'){const share=Q/deck.length;if(share<0.2||share>0.5||deck.length-Q<size+2*(players-1))return null;   // more than half the deck banned would gut the team
    return{tier:share<0.3?1:share<0.4?2:3,need,q:Q,p:+share.toFixed(2)}}
  // distinct / same: by luck only
  if(m.k==='distinct'&&new Set(deck.map(m.key).filter(v=>v!=null)).size<need+1)return null;
  if(m.k==='same'){const c={};deck.forEach(p=>{const k=m.key(p);if(k!=null)c[k]=(c[k]||0)+1});if(Math.max(0,...Object.values(c))<need+1)return null}
  const luck=misLuck(m,need,deck,size,r);if(luck>=0.42)return null;
  return{tier:luck>=0.16?1:luck>=0.05?2:3,need,q:Q,p:+luck.toFixed(2)}}
/* Some missions make your team weaker on purpose (no MVPs, no shooters...). The reward makes up for it:
   compare the value of a fair-share team from this deck with the best team that still completes the mission. */
const STAND={cpts:p=>num(p.pts,0)>=18,creb:p=>num(p.trb,0)>=8,cast:p=>num(p.ast,0)>=6,cdef:p=>num(p.stl,0)+num(p.blk,0)>=2.2};
const FIXCOMP={even:1,cheap:0.5};
function misComp(m,deck,size,players){const k=Math.min(size,5),v=p=>pval(p),sum=a=>a.reduce((x,y)=>x+y,0);
  const all=deck.map(v).sort((a,b)=>b-a),fair=all.slice(0,k*players),avg=sum(fair)/Math.max(1,fair.length),E=avg*k;let Ec=E;
  if(m.k==='none'){const ok=deck.filter(p=>!m.f(p)).map(v).sort((a,b)=>b-a),top=ok.slice(0,Math.max(k,Math.min(ok.length,k*players)));Ec=sum(top)/Math.max(1,top.length)*k}
  else if(m.k==='count'){const nd=Math.min(misNeed(m,size),k),q=deck.filter(m.f).map(v).sort((a,b)=>b-a).slice(0,nd);Ec=Math.min(E,sum(q)+(k-nd)*avg)}
  else if(m.k==='slot'){const q=deck.filter(m.f).map(v).sort((a,b)=>b-a)[0];Ec=q==null?E:Math.min(E,E-avg+q)}
  else return FIXCOMP[m.id]||0;
  // banning players also hands them to your rivals, so 'none' missions are paid back in full; others at 60%
  return Math.round(clamp((m.k==='none'?1.1:0.6)*(E-Ec),0,m.k==='none'?6:4)*2)/2}
function dealMissions(g,r){
  const size=g.size,n=g.sides.length,cand=[];
  const fin=x=>({...x,bonus:+(MTIER[x.tier].bonus+misComp(misOf(x.id),g.items,size,n)).toFixed(1)});
  MIS.forEach(m=>{if(m.tier){cand.push(fin({id:m.id,tier:m.tier,need:misNeed(m,size),q:0}));return}
    if(m.k==='cmp'){if(g.items.filter(STAND[m.id]).length<n+1)return;cand.push(fin({id:m.id,tier:n===2?1:2,need:0,q:0}));return}  // contests tend to reward teams that are already strong, so they pay less  // only when the deck has real standouts for that stat
    const c=misCalib(m,g.items,size,n,r);if(c)cand.push(fin({id:m.id,...c}))});
  const grp=x=>{const k=misOf(x.id).k;return k==='cmp'||k==='topbid'?'cmp':k==='left'||k==='big'||k==='cap'||k==='cheap'?'money':x.id};
  // missions are secret, so two players may hold the same one; within a hand: one per tier if possible, at most one money / contest
  // mission, and deck-based missions are preferred so the hand reflects this deck
  const wt=x=>grp(x)===x.id?3:1,pickW=(L)=>{const tot=L.reduce((t,x)=>t+wt(x),0);let u=r()*tot;for(const x of L){u-=wt(x);if(u<=0)return x}return L[L.length-1]};
  const out={};
  g.sides.forEach(s=>{const hand=[],ids=new Set(),gs=new Set(),free=x=>!ids.has(x.id)&&!gs.has(grp(x));
    for(const t of [1,2,3]){let L=cand.filter(x=>free(x)&&x.tier===t);if(!L.length)L=cand.filter(x=>free(x)&&Math.abs(x.tier-t)===1);if(!L.length)L=cand.filter(free);if(!L.length)L=cand.filter(x=>!ids.has(x.id));
      if(!L.length)continue;const x=pickW(L);ids.add(x.id);gs.add(grp(x));hand.push(x)}
    hand.sort((a,b)=>a.tier-b.tier);out[s]={opts:hand,pick:null}});
  return out}
// live progress for the auction / lineup screens
function misProg(g,s){const M=g.mis&&g.mis[s];if(!M||M.pick==null)return null;const x=M.opts[M.pick],m=misOf(x.id);if(!m)return null;
  const R=rosterOf(g,s),open=openN(g,s),bud=budOf(g,s),need=x.need;let have=0,done=false,dead=false,txt='',live=false;
  switch(m.k){
    case 'count':have=R.filter(m.f).length;done=have>=need;dead=!done&&have+open<need;txt=`${Math.min(have,need)}/${need}`;break;
    case 'none':{const bad=R.find(m.f);dead=!!bad;done=!bad&&open===0;live=!bad&&open>0;txt=bad?`${lastN_(bad)} 破功`:'保持中';break}
    case 'distinct':have=new Set(R.map(m.key).filter(v=>v!=null)).size;done=have>=need;dead=!done&&have+open<need;txt=`${Math.min(have,need)}/${need}`;break;
    case 'same':{const c={};R.forEach(p=>{const k=m.key(p);if(k!=null)c[k]=(c[k]||0)+1});have=Math.max(0,...Object.values(c));done=have>=need;dead=!done&&have+open<need;txt=`${Math.min(have,need)}/${need}`;break}
    case 'left':{const t=misT(m,bud),l=left(g,s);dead=l<t;done=!dead&&open===0;live=!dead&&open>0;txt=`剩 $${l}／要 $${t}`;break}
    case 'big':{const t=misT(m,bud);done=R.some(p=>p.price>=t);dead=!done&&(open===0||maxBid(g,s)<t);txt=done?'達成':`最多能出 $${maxBid(g,s)}`;break}
    case 'cap':{const t=misT(m,bud),bad=R.find(p=>p.price>t);dead=!!bad;done=!bad&&open===0;live=!bad&&open>0;txt=bad?`${lastN_(bad)} $${bad.price}`:`上限 $${t}`;break}
    case 'cheap':have=R.filter(p=>p.price===1&&!p.fa).length;done=have>=need;dead=!done&&have+open<need;txt=`${Math.min(have,need)}/${need}`;break;
    case 'cmp':{const v=t=>starters(rosterOf(g,t)).reduce((a,p)=>a+m.key(p),0),me=v(s),best=Math.max(...g.sides.filter(t=>t!==s).map(v));
      live=true;done=me>=best&&R.length>0;txt=done?`領先 ${(me-best).toFixed(1)}`:`落後 ${(best-me).toFixed(1)}`;break}
    case 'topbid':{const mx=t=>Math.max(0,...g.rosters[t].map(q=>q.price)),me=mx(s),best=Math.max(...g.sides.filter(t=>t!==s).map(mx));
      live=true;done=me>0&&me>=best;txt=me?`你最高 $${me}`:'還沒得標';if(best>me)txt+=`・對手 $${best}`;break}
    case 'slot':{const p=R.find(q=>q.slot===m.slot);done=!!p&&m.f(p);live=true;const fit=R.filter(m.f);dead=!fit.length&&open===0;
      txt=done?`${lastN_(p)} ✓`:fit.length?`${lastN_(fit[0])} 要排 ${m.slot}`:'還沒有人選';break}
  }
  // changeable states only become final when the lineup locks
  if(live&&done)done='now';
  return{x,m,done,dead,txt,tier:x.tier}}
// final check at tip-off (rosters and slots are locked)
function misFinal(g){if(!g.mis)return null;const out={};
  g.sides.forEach(s=>{const M=g.mis[s];if(!M||M.pick==null)return;const x=M.opts[M.pick],m=misOf(x.id);if(!m)return;
    const R=rosterOf(g,s),bud=budOf(g,s);let ok=false;
    switch(m.k){
      case 'count':case 'none':case 'distinct':case 'same':case 'slot':ok=misCheck(m,x.need,R);break;
      case 'left':ok=left(g,s)>=misT(m,bud);break;
      case 'big':ok=R.some(p=>p.price>=misT(m,bud));break;
      case 'cap':ok=R.every(p=>p.price<=misT(m,bud));break;
      case 'cheap':ok=R.filter(p=>p.price===1&&!p.fa).length>=x.need;break;
      case 'cmp':{const v=t=>starters(rosterOf(g,t)).reduce((a,p)=>a+m.key(p),0),me=v(s);ok=g.sides.every(t=>t===s||me>=v(t)-1e-9);break}
      case 'topbid':{const mx=t=>Math.max(0,...g.rosters[t].map(q=>q.price)),me=mx(s);ok=me>0&&g.sides.every(t=>t===s||me>=mx(t));break}}
    out[s]={id:x.id,tier:x.tier,need:x.need,done:ok,bonus:ok?(x.bonus!=null?x.bonus:MTIER[x.tier].bonus):0,full:x.bonus!=null?x.bonus:MTIER[x.tier].bonus,pt:ok?MTIER[x.tier].pt:0}});
  return out}
// which mission owners care about this card (shown under the card during the auction)
function misHints(g,pl){if(!g.mis)return[];const out=[];
  g.sides.forEach(s=>{const P=misProg(g,s);if(!P||P.dead||openN(g,s)===0)return;const m=P.m,R=rosterOf(g,s);
    let t=null;
    if(m.k==='count'&&P.done!==true&&m.f(pl))t='fit';
    else if(m.k==='none'&&m.f(pl))t='bad';
    else if(m.k==='slot'&&P.done!=='now'&&P.done!==true&&m.f(pl))t='fit';
    else if(m.k==='distinct'&&P.done!==true){const k=m.key(pl);if(k!=null&&!R.some(p=>m.key(p)===k))t='fit'}
    else if(m.k==='same'&&P.done!==true){const k=m.key(pl);if(k!=null&&(R.some(p=>m.key(p)===k)||!R.length))t='fit'}
    if(t)out.push({s,t,m})});
  return out}
