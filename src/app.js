/* =========================================================
   BALLER BID 球星喊價
   Stats: Basketball-Reference (via sumitrodatta/bball-reference-datasets)
   ========================================================= */
const POS=['PG','SG','SF','PF','C'],ALL=['A','B','C'];
const T_NOBID=20000,T_BID=15000,T_LINEUP=90000;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;
const normName=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function lsGet(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
const LS='ballerbid_local_v1',LS_AI='ballerbid_ai_v1';
let CID=lsGet('bb_cid');if(!CID){CID=Math.random().toString(36).slice(2,10);lsSet('bb_cid',CID)}
let MYNAME=lsGet('bb_name')||'';
const clean=(s,n=14)=>String(s||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,n);
const APPV='2026.11.24w';
const own=(o,k)=>!!o&&typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
function shuffle(a,r=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const ALPH='abcdefghjkmnpqrstuvwxyz23456789';
const randCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>ALPH[b%31]).join('');
const vibe=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};

/* ---------- data ---------- */
let THEMES=[],CAREER=null,LINKS=null,BIOS=null;
function careerFrom(j){CAREER=new Map();j.rows.forEach(row=>{const o={};j.cols.forEach((c,i)=>o[c]=row[i]);o.est=o.est?['bpm']:[];CAREER.set(normName(o.n),o)})}
function themesFrom(j){if(Array.isArray(j))return addUsaAll(j);return addUsaAll(j.themes.map(t=>({...t,items:t.items.map(r=>{const o={};j.cols.forEach((c,i)=>{if(r[i]!=null)o[c]=r[i]});o.est=o.est?['bpm']:[];return o})})))}
function addUsaAll(T){THEMES=T;const ids=T.filter(t=>t.cat==='夢幻隊').map(t=>t.id);if(!ids.length)return T;
  T.splice(ids.length,0,{id:'usaall',name:'歷屆夢幻隊（1992–2024 全部）',tag:'九屆奧運美國隊合併・同一球員取數據最好的那屆',cat:'夢幻隊',y0:1991,y1:2023,items:pickPool(ids).items});
  // champion lineups grouped by decade, for the 指定 picker (individual champions stay in the random pool)
  const ch=T.filter(t=>t.cat==='陣容'&&t.y0!=null).sort((a,b)=>a.y0-b.y0),by={};ch.forEach(t=>{const d=Math.floor(t.y0/10)*10;(by[d]=by[d]||[]).push(t)});
  Object.keys(by).sort().forEach(d=>{const ts=by[d],best=new Map();
    // only each champion's 8-man rotation (by minutes), so the pool is the players people remember
    ts.forEach(t=>t.items.slice().sort((x,y)=>num(y.mp,0)*num(y.g,0)-num(x.mp,0)*num(x.g,0)).slice(0,8).forEach(p=>{const k=p.id||normName(p.n),v=num(p.obpm,0)+num(p.dbpm,0),o=best.get(k);if(!o||v>o.v)best.set(k,{p,v})}));
    const pp={items:[...best.values()].map(x=>x.p)};
    T.push({id:'champ'+d,name:`${d} 年代冠軍隊`,tag:`${ts.length} 支冠軍隊合併：${ts.map(t=>t.name.replace(/（.*）/,'')).join('、')}（各取上場時間最多的 8 人）・同一球員取數據最好的那季`,cat:'陣容',grp:1,y0:+d,y1:+d+9,items:pp.items})});
  return T}
async function loadData(){
  const inl=id=>{const el=document.getElementById(id);return el?JSON.parse(el.textContent):null};
  const t=inl('d-themes');
  if(t){THEMES=themesFrom(t);careerFrom(inl('d-career'));LINKS=inl('d-links');BIOS=inl('d-bios');return}
  THEMES=themesFrom(await (await fetch('data/themes.json')).json());
  careerFrom(await (await fetch('data/career.json')).json());LINKS=await (await fetch('data/links.json')).json();BIOS=await (await fetch('data/bios.json')).json();
}
function parseCustom(text){
  return String(text||'').split('\n').map(l=>l.trim()).filter(Boolean).slice(0,40).map(l=>{
    const [n,p='']=l.split(/[,，]/).map(s=>s.trim());if(!n)return null;
    const hit=CAREER&&CAREER.get(normName(n));const o=hit?{...hit,n}:{n,pos:'',nostat:true};
    const P=p.toUpperCase();if(POS.includes(P)){o.pos=P;if(!hit){o.pe=POS.indexOf(P)+1;o.lo=o.pe;o.hi=o.pe}}
    return o}).filter(Boolean);
}
const CATS=['夢幻隊','陣容','年代','隊史','特別'];
const BENCH=['B1','B2','B3','B4','B5'];
const SLOTS=g=>g&&g.size===10?POS.concat(BENCH):POS;
const isBench=x=>BENCH.includes(x),slotLab=x=>isBench(x)?'替補'+x[1]:x;
const starters=R=>R.filter(p=>!isBench(p.slot)),benchOf=R=>R.filter(p=>isBench(p.slot));

/* ---------- positions ---------- */
const PNUM={PG:1,G:1.5,SG:2,GF:2.5,SF:3,F:3.5,PF:4,FC:4.5,C:5};
const peOf=p=>typeof p.pe==='number'?p.pe:(PNUM[String(p.pos||'').split('-')[0]]||3);
function posInfo(p,slot){
  const i=POS.indexOf(slot);if(i<0)return{tier:0,lab:'',x:0,dir:0};
  const s=i+1,pe=peOf(p),lo=num(p.lo,pe),hi=num(p.hi,pe);
  if(s>=lo-0.01&&s<=hi+0.01){const off=Math.max(0,Math.abs(s-pe)-0.5),dir=s>pe?1:-1;return off<0.6?{tier:0,lab:'本位',x:0,dir}:{tier:1,lab:'可打',x:0.15*off,dir}}
  const d=s<lo?lo-s:s-hi,dir=s>hi?1:-1,x=Math.min(3,d);
  return d<=1.01?{tier:2,lab:'勉強',x,dir}:{tier:3,lab:'不適合',x,dir};
}
const canPlay=p=>POS.filter(s=>posInfo(p,s).tier<=1);

/* ---------- chemistry ---------- */
const FEUDS=[
 {a:'onealsh01',b:'bryanko01',lv:2,t:'1996–2004 湖人：三連霸期間不和公開化，2004 年 Shaq 被交易到熱火。',u:'https://www.wikipedia.org/wiki/Shaq-Kobe_feud'},
 {a:'bryanko01',b:'howardw01',lv:2,t:'2012–13 湖人：隊內會議當面起衝突，Howard 球季結束就離隊；後來的湖人教練直言兩人互看不順眼。',u:'https://abc7.com/post/elbow-causes-kobe-dwight-tussle/370891/'},
 {a:'allenra02',b:'rondora01',lv:2,t:'2007–12 塞爾提克：隊友透露兩人曾戴拳套在重訓室「解決恩怨」；Allen 2012 年轉投熱火。',u:'https://www.cbssports.com/nba/news/kendrick-perkins-says-celtics-made-ray-allen-and-rajon-rondo-box-each-other-to-settle-their-beef'},
 {a:'hardeja01',b:'paulch01',lv:1,t:'2017–19 火箭：媒體報導關係「無法挽回」，Paul 隔年被交易（Harden 否認不合）。',u:'https://sports.yahoo.com/sources-relationship-between-rockets-stars-james-harden-chris-paul-termed-unsalvageable-200951028.html'},
 {a:'embiijo01',b:'simmobe01',lv:1,t:'2017–21 76 人：Simmons 自己說兩人「從沒真正說過話」，2021 年鬧到被交易。',u:'https://www.si.com/nba/2022/10/14/ben-simmons-on-joel-embiid-relationship-we-never-really-spoke-nets-76ers'},
 {a:'irvinky01',b:'jamesle01',lv:1,t:'2014–17 騎士：Kyrie 2017 年要求交易，報導指他想走出 LeBron 的光環。',u:'https://www.nba.com/news/report-kyrie-irving-seeks-trade-cleveland-cavaliers'},
 {a:'greendr01',b:'duranke01',lv:1,t:'2016–19 勇士：2018 年場上爭執延燒到更衣室，Draymond 被球隊禁賽一場。',u:'https://www.nba.com/article/2018/11/13/report-durant-green-exchange-carries-over-locker-room'},
 {a:'thomais01',b:'dantlad01',lv:1,t:'1986–89 活塞：Dantley 認定是 Isiah 主導把他交易走（球隊高層否認）。',u:'https://www.nba.com/pistons/features/truebluepistons_110801.html'},
 {a:'marbust01',b:'garneke01',lv:1,t:'1996–99 灰狼：球隊高層表示 Marbury 因嫉妒 Garnett 的合約要求交易。',u:'https://www.espn.com/nba/2000/20000220/recap/njnmin.html'},
 {a:'onealsh01',b:'hardaan01',lv:1,t:'1993–96 魔術：兩人關係冷卻，Shaq 1996 年離隊，Penny 是從媒體得知。',u:'https://www.nba.com/magic/news/reflecting-back-shaqs-magic-and-nba-career-20160908'},
 {a:'butleji01',b:'townska01',lv:1,t:'2017–19 灰狼：Butler 2018 年練球時公開痛批 Towns 不夠拚。',u:'https://global.espn.com/nba/story/_/id/24950981/jimmy-butler-heated-practice-timberwolves'},
 {a:'butleji01',b:'wiggian01',lv:1,t:'2017–19 灰狼：Butler 2018 年練球時公開痛批 Wiggins 不夠拚。',u:'https://global.espn.com/nba/story/_/id/24950981/jimmy-butler-heated-practice-timberwolves'},
];
const tsCache=new Map();
function tsOf(id){if(!id||!LINKS)return null;if(tsCache.has(id))return tsCache.get(id);const s=own(LINKS.p,id)?LINKS.p[id]:null;let set=null;if(typeof s==='string'){set=new Set();for(let i=0;i<s.length;i+=3)set.add(s.substr(i,3))}tsCache.set(id,set);return set}
function shared(a,b){const A=tsOf(a.id),B=tsOf(b.id);if(!A||!B)return 0;let k=0;for(const x of A)if(B.has(x))k++;return k}
const feudOf=(a,b)=>a.id&&b.id?FEUDS.find(f=>(f.a===a.id&&f.b===b.id)||(f.a===b.id&&f.b===a.id)):null;
const tmOn=g=>!(g.theme&&g.theme.cat==='陣容');
function chem(roster,g){
  const pairs=[],feuds=[];
  for(let i=0;i<roster.length;i++)for(let j=i+1;j<roster.length;j++){const a=roster[i],b=roster[j];
    const k=tmOn(g)?shared(a,b):0;if(k>=2)pairs.push({a:a.n,b:b.n,k,v:Math.min(1,0.2*k)});
    const f=feudOf(a,b);if(f)feuds.push({a:a.n,b:b.n,lv:f.lv,t:f.t,u:f.u,v:f.lv===2?1.5:0.8})}
  const tm=Math.min(2.5,pairs.reduce((s,p)=>s+p.v,0)),fd=Math.min(3,feuds.reduce((s,p)=>s+p.v,0));
  const swN=starters(roster).filter(p=>canPlay(p).length>=3).length;const sw=swN>=5?1.5:swN===4?0.8:0;
  const lg=legendsOf(roster),lgv=Math.min(2.5,lg.reduce((t,x)=>t+x.v,0));
  return{pairs,feuds,tm,fd,sw,swN,lg,lgv};
}

/* ---------- state & engine ---------- */
function newState(){return{v:0,t:0,phase:'lobby',auth:null,code:null,
  cfg:{players:2,budget:15,size:5,theme:'random',cards:false,cats:[...CATS],era:null,teams:[],picks:[],pcat:'夢幻隊',draw:12,showStats:false,hints:false,mis:false,season:0,bal:true,fmt:'open',nom:false,custom:{name:'',text:''}},
  seats:{A:null,B:null,C:null},names:{A:'玩家 A',B:'玩家 B',C:'玩家 C'},game:null,acks:{},scores:{},sim:null,err:'',by:null,season:null,lastSeason:null}}
const sidesOf=n=>ALL.slice(0,n);
const openSlots=(g,s)=>{const u=g.rosters[s].map(r=>r.slot);return SLOTS(g).filter(x=>!u.includes(x))};
const openN=(g,s)=>openSlots(g,s).length;
const left=(g,s)=>(g.bud&&g.bud[s]!=null?g.bud[s]:g.budget)-g.spent[s];
const maxBid=(g,s)=>openN(g,s)?(g.solo&&g.solo.who===s?1:left(g,s)-(openN(g,s)-1)):0;
/* when every other team is full, the last team no longer bids: each next card costs $1 and it may skip only a few,
   so it cannot flip through the whole pool for free */
const fmtBusy=g=>!!(g.stage||g.sb||g.price!=null);
const soloOf=g=>{if(g.sides.length<2)return null;const e=g.sides.filter(s=>openN(g,s)>0);return e.length===1?e[0]:null};
const remain=g=>g.items.length-g.idx;
const isOver=g=>g.sides.every(s=>openN(g,s)===0)||g.idx>=g.items.length;
const cur=g=>g.items[g.idx];
const eligible=g=>g.sides.filter(s=>openN(g,s)>0);
const nm=(S,s)=>(offline()?S.names[s]:(S.seats[s]&&S.seats[s].name))||('玩家 '+s);
// no network: pass-and-play ('local') or against the computer ('ai', the human is always seat A)
function offline(){return NET.mode==='local'||NET.mode==='ai'}
function roleOf(S,cid){if(NET.mode==='local')return 'all';if(NET.mode==='ai')return 'A';for(const k of ALL)if(S.seats[k]&&S.seats[k].cid===cid)return k;return 'spec'}
const scoreKey=(S,s)=>offline()?'L'+s+':'+S.names[s]:(S.seats[s]?S.seats[s].cid:s);
const now=()=>Date.now()+(NET.skew||0);
function themeOk(t,cfg){return t.items.length>=cfg.players*(cfg.size||5)}
// several themes merged into one pool; a player who appears more than once keeps his best version
function pickPool(ids){const ts=(ids||[]).map(id=>THEMES.find(t=>t.id===id)).filter(Boolean),best=new Map();
  ts.forEach(t=>t.items.forEach(p=>{const k=p.id||normName(p.n),v=num(p.obpm,0)+num(p.dbpm,0),o=best.get(k);if(!o||v>o.v)best.set(k,{p,v})}));
  return{ts,items:[...best.values()].map(x=>x.p)}}
const FRZH={ATL:'老鷹',BOS:'塞爾提克',BRK:'籃網',CHO:'黃蜂',CHI:'公牛',CLE:'騎士',DAL:'獨行俠',DEN:'金塊',DET:'活塞',GSW:'勇士',HOU:'火箭',IND:'溜馬',LAC:'快艇',LAL:'湖人',MEM:'灰熊',MIA:'熱火',MIL:'公鹿',MIN:'灰狼',NOP:'鵜鶘',NYK:'尼克',OKC:'雷霆・超音速',ORL:'魔術',PHI:'76人',PHO:'太陽',POR:'拓荒者',SAC:'國王',SAS:'馬刺',TOR:'暴龍',UTA:'爵士',WAS:'巫師・子彈'};
const DECS=[1950,1960,1970,1980,1990,2000,2010,2020];
// a theme fits the era filter when at least half of its years fall inside the chosen decades
function eraOk(t,c){const e=c.era;if(!e)return true;if(t.y0==null)return false;const a=e[0],b=e[1]+9,y0=t.y0,y1=t.y1;
  const ov=Math.min(y1,b)-Math.max(y0,a)+1;return ov>=Math.max(1,0.5*(y1-y0+1))}
/* random mode = union of the ticked categories, optionally narrowed by decade (特別 ignores the decade).
   Choosing particular teams/seasons lives in 指定, which can also draw one of the chosen themes in secret. */
const CATNAME={夢幻隊:'夢幻隊',陣容:'冠軍隊',年代:'年代全明星',隊史:'球隊',特別:'特別'};
const CATDESC={夢幻隊:'歷屆奧運美國隊',陣容:'歷屆 NBA 冠軍隊陣容',年代:'某個年代的全明星',隊史:'某隊某年代，或隊史傳奇',特別:'MVP、狀元、國際球星、選秀梯隊'};
const ERA_ON=k=>k!=='特別',TEAM_ON=k=>k==='陣容'||k==='隊史';
/* A theme smaller than the rosters need (common in 10-man mode: most themes have 12-17 players) is not dropped:
   when it is drawn, the closest themes of the same category are merged in (same team first, then nearest years)
   until the pool is big enough. So the theme count does not depend on 5- or 10-man mode. */
const catCands=(c,k)=>THEMES.filter(t=>!t.grp&&t.cat===k&&(!ERA_ON(k)||eraOk(t,c)));
const needOf=c=>c.players*(c.size||5);
const catPool=(c,k)=>{const cs=catCands(c,k);return cs.some(t=>themeOk(t,c))||pickPool(cs.map(t=>t.id)).items.length>=needOf(c)?cs:[]};
const randPool=c=>CATS.filter(k=>c.cats.includes(k)).flatMap(k=>catPool(c,k));
function autoMerge(th,c){const need=needOf(c);if(th.items.length>=need+2)return th;
  const near=catCands(c,th.cat).filter(t=>t.id!==th.id).sort((x,y)=>((x.fr&&x.fr===th.fr)?0:1)-((y.fr&&y.fr===th.fr)?0:1)||Math.abs((x.y0||0)-(th.y0||0))-Math.abs((y.y0||0)-(th.y0||0)));
  const ids=[th.id];for(const t of near){if(pickPool(ids).items.length>=need+2)break;ids.push(t.id)}
  const pp=pickPool(ids);if(pp.ts.length===1)return th;const ts=[...pp.ts].sort((x,y)=>(x.y0||0)-(y.y0||0));
  const name=th.cat==='夢幻隊'?'夢幻隊 '+ts.map(t=>t.name.slice(0,4)).join('、'):ts.slice(0,3).map(t=>t.name).join(' ＋ ')+(ts.length>3?` 等 ${ts.length} 個`:'');
  return{id:'mix',name,tag:`主題人數不夠，自動合併 ${ts.length} 個相近的主題（同一球員取數據最好的版本）`,cat:th.cat,items:pp.items,random:true}}
function poolLenFor(cfg){if(cfg.theme==='random')return 0;if(cfg.theme==='pick')return cfg.pmode==='one'&&(cfg.picks||[]).length>1?0:pickPool(cfg.picks).items.length;if(cfg.theme==='custom')return parseCustom(cfg.custom.text).length;const t=THEMES.find(t=>t.id===cfg.theme);return t?t.items.length:0}
function defaultDraw(cfg){const need=cfg.players*(cfg.size||5),L=poolLenFor(cfg);return L?Math.min(L,need+2):need+2}
/* how much of a name a card is: value plus honors and signature traits. Used to put stars into the deck. */
function starScore(p){const b=(p&&!p.fa&&bioOf(p))||{};return pval(p)+2*(b.mvp>0)+1.2*Math.min(3,b.all1||0)/3+0.15*Math.min(10,b.as||0)+(b.hof?1:0)+(sigOf(p)?1.5:0)+(b.fmvp?0.8:0)}
// weighted shuffle (Efraimidis–Spirakis): stars come up more often, but any card can still appear
function starShuffle(items,r=Math.random){return items.map(p=>({p,k:Math.pow(r(),1/(1+Math.max(0,starScore(p))/3))})).sort((a,b)=>b.k-a.k).map(x=>x.p)}
const EXTRA_MAX=3;
// a card nobody wanted is replaced by one of the best players still in the reserve, at most EXTRA_MAX times per game
function addExtra(g){if((g.extra||0)>=EXTRA_MAX)return false;const used=new Set(g.items.map(p=>p.n));
  const res=g.pool.filter(p=>!used.has(p.n)).sort((a,b)=>starScore(b)-starScore(a)).slice(0,3);if(!res.length)return false;
  const p=res[Math.floor(Math.random()*res.length)];g.items.push({...p,extra:1});g.extra=(g.extra||0)+1;return true}
function drawItems(items,n,k){
  const pool=starShuffle(items),picked=[],used=new Set();
  for(const s of shuffle(POS)){let c=picked.filter(p=>posInfo(p,s).tier<=1).length;
    for(const p of pool){if(c>=k)break;if(used.has(p.n))continue;if(posInfo(p,s).tier<=1){picked.push(p);used.add(p.n);c++}}}
  for(const p of pool){if(picked.length>=n)break;if(!used.has(p.n)){picked.push(p);used.add(p.n)}}
  return shuffle(picked);
}
function waitingFor(){if(!S.last||offline())return[];const on=onlineSet();on.add(CID);
  return sidesOf(S.cfg.players).filter(k=>S.seats[k]&&on.has(S.seats[k].cid)&&!(S.back&&S.back[S.seats[k].cid])).map(k=>S.seats[k].name)}
const isBack=()=>!S.last||(S.back&&S.back[CID])||ui.backGid===S.last.game.gid;
const lastView=()=>!!(S&&(S.phase==='lobby'||S.phase==='season')&&S.last&&NET.mode&&!offline()&&!isBack());
function withView(fn){if(!lastView())return fn();const g=S.game,sm=S.sim,ph=S.phase;S.game=S.last.game;S.sim=S.last.sim;S.phase='results';try{return fn()}finally{S.game=g;S.sim=sm;S.phase=ph}}
function startGame(S){
  const c=S.cfg;S.err='';const n=c.players,size=c.size===10?10:5,need=n*size;let th;
  const used=new Set(S.season?S.season.used:[]),fresh=L=>{const f=L.filter(t=>!used.has(t.id));return f.length?f:L};let baseId=null;
  if(c.theme==='random'){const ok=randPool(c);if(!ok.length){S.err='沒有可以抽的主題：請多勾幾個類別，或放寬篩選';return true}const f=fresh(ok),t0=f[Math.floor(Math.random()*f.length)];baseId=t0.id;th=autoMerge(t0,c)}
  else if(c.theme==='custom'){if(!CAREER){S.err='資料還在載入';return true}th={id:'custom',name:clean(c.custom.name,30)||'自訂主題',tag:'生涯巔峰 5 季',cat:'自訂',items:parseCustom(c.custom.text)}}
  else if(c.theme==='pick'){const pp=pickPool(c.picks);if(!pp.ts.length){S.err='請先選主題';return true}
    if(pp.ts.length===1)th=pp.ts[0];
    else if(c.pmode==='one'){const ok=pp.ts.filter(t=>themeOk(t,c));if(!ok.length){S.err=`選的主題都不到 ${need} 人`;return true}const f=fresh(ok);th=f[Math.floor(Math.random()*f.length)];baseId=th.id;th={...th,random:true}}
    else{const cats=[...new Set(pp.ts.map(t=>t.cat))],ts=[...pp.ts].sort((x,y)=>(x.y0||0)-(y.y0||0)),usa=cats.length===1&&cats[0]==='夢幻隊';
      const nm=usa?(ts.some(t=>t.id==='usaall')||ts.length>=9?'歷屆夢幻隊（全部）':'夢幻隊 '+ts.map(t=>t.name.slice(0,4)).join('、')):ts.slice(0,4).map(t=>t.name).join(' ＋ ')+(ts.length>4?` 等 ${ts.length} 個主題`:'');
      th={id:'mix',name:nm,
      tag:'多主題合併（同一球員取數據最好的那個版本）',cat:cats.length===1?cats[0]:'混合',items:pp.items}}}
  else th=THEMES.find(t=>t.id===c.theme);
  if(!th){S.err='找不到主題';return true}
  if(c.budget<size){S.err=`每人要標 ${size} 位，預算至少要 $${size}`;return true}
  if(th.items.length<need){S.err=`卡池只有 ${th.items.length} 位，${n} 人玩${size===10?'夢幻隊模式':''}至少需要 ${need} 位，請多選幾個主題／年份`;return true}
  const sides=sidesOf(n);
  if(!offline()&&!sides.every(s=>S.seats[s])){S.err=`還要等 ${n} 位玩家都入座`;return true}
  const w=waitingFor();if(w.length){S.err=`還有人在看結算：${w.join('、')}`;return true}
  const draw=c.theme==='random'||th.random?Math.min(th.items.length,need+2):clamp(c.draw|0,need,th.items.length);
  const t=now();
  S.game={gid:Math.random().toString(36).slice(2,9),theme:{id:th.id,name:th.name,tag:th.tag,cat:th.cat||'自訂',random:c.theme==='random'||!!th.random},
    pool:th.items,items:drawItems(th.items,draw,n*size/5),extra:0,idx:0,sides,size,rosters:{},spent:{},
    bid:{who:null,amt:0},deadline:t+T_NOBID,pass:{},log:[],budget:c.budget,showStats:!!c.showStats,showYr:c.showYr!==false,read:READ_OPTS.includes(c.read)?c.read:5,hints:!!c.hints,ready:{},lineupEnd:0};
  sides.forEach(s=>{S.game.rosters[s]=[];S.game.spent[s]=0});S.game.base=S.game.items.length;
  if(c.season&&!S.season)S.season={sid:Math.random().toString(36).slice(2,8),n:c.season,bal:c.bal!==false,mis:!!c.mis,sides:sides.slice(),rounds:[],used:[],done:false,fmt0:Math.floor(Math.random()*FMT_ROT.length)};
  const se=S.season;S.game.fmt=fmtFor(S);S.game.nom=!!c.nom;if(se){if(baseId)se.used.push(baseId);S.game.round=se.rounds.length+1;S.game.rounds=se.n}
  const bb=seasonBudgets(S);S.game.bud=bb.b;S.game.budAdj=bb.adj;
  S.sim=null;S.last=null;S.back={};S.sready={};
  if(c.cards){S.game.cards=dealCards(S.game);S.game.cardEnd=t+T_CARD*(NET.mode==='local'?n:1);S.phase='cards';return true}
  prepNext(S);return true;
}
function beginAuction(S){const g=S.game;S.phase='auction';if(!window.BB_FAST)g.gapEnd=now()+1300;startCard(S)}   // the first card waits for the 競標開始 title to clear
function autoPick(g,s){const M=g.mis[s];if(M.pick!=null)return;const i=M.opts.findIndex(x=>x.tier===2);M.pick=i>=0?i:0;M.auto=1}
function finish(S){const g=S.game;g.sides.forEach(s=>benchFix(g,s));g.misRes=misFinal(g);S.sim=simulate(S);S.phase='results';const ch=S.sim.champ;if(ch){const k=scoreKey(S,ch);const o=S.scores[k]||{n:nm(S,ch),w:0};o.n=nm(S,ch);o.w++;S.scores[k]=o}seasonRecord(S)}
/* bidding order: 2 players alternate who opens each card (A,B,A,B…);
   3 players use a snake: A,B,C then C,B,A then A,B,C… Inside a card the turn keeps cycling in that direction. */
function cardOrder(g){const sd=g.sides,N=sd.length,k=g.idx;
  if(N===2){const st=k%2;return [sd[st],sd[1-st]]}
  const seq=Math.floor(k/N)%2===0?sd.slice():sd.slice().reverse(),p=k%N;return seq.slice(p).concat(seq.slice(0,p))}
const canAct=(g,s)=>openN(g,s)>0&&!g.pass[s]&&g.bid.who!==s&&maxBid(g,s)>g.bid.amt;
function advance(S){const g=S.game,o=g.order||g.sides,n=o.length;let i=o.indexOf(g.turn);if(i<0)i=n-1;
  for(let k=1;k<=n;k++){const s=o[(i+k)%n];if(canAct(g,s)){g.turn=s;g.deadline=t0(g)+(g.bid.who?T_BID:T_NOBID);return}}
  g.turn=null;if(g.bid.who)sell(S,g.bid.who,g.bid.amt);else skipCard(S)}
function startCard(S){const g=S.game;g.bid={who:null,amt:0};g.pass={};g.order=cardOrder(g);g.turn=null;
  const so=soloOf(g);if(so&&(!g.solo||g.solo.who!==so))g.solo={who:so};if(fmtStart(S))return;advance(S)}
/* deck runs out: free agents fill whatever is left (see addExtra for passed cards) */
const FA={obpm:-2,dbpm:-0.5,usg:16,astp:12,trbp:10,blkp:1,stlp:1.5,mp:18,g:60,pts:6,trb:3,ast:1,stl:0.5,blk:0.3,tov:0.9};
function fillFA(g){g.sides.forEach(s=>openSlots(g,s).forEach(x=>{const i=isBench(x)?3:POS.indexOf(x)+1;
  g.items.push({...FA,n:`自由球員（${slotLab(x)}）`,pos:isBench(x)?'':x,pe:i,lo:isBench(x)?1:i,hi:isBench(x)?5:i,fa:1});const k=g.items.length-1;
  g.rosters[s].push({slot:x,k,price:0});g.log.push({n:g.items[k].n,who:s,amt:0,slot:x,fa:1})}));g.sides.forEach(s=>autoPlace(g,s))}
function nextCard(S){const g=S.game;g.gapEnd=now()+gapMs(g);g.idx++;g.bid={who:null,amt:0};g.pass={};g.turn=null;
  if(!g.sides.every(s=>openN(g,s)===0)&&g.idx>=g.items.length)fillFA(g);   // deck (plus at most 3 extra cards) is used up: free agents fill the rest
  if(isOver(g)){g.sides.forEach(s=>benchFix(g,s));S.phase='lineup';g.ready={};g.lineupEnd=now()+T_LINEUP*(g.size===10?4/3:1);return}
  startCard(S)}
/* a short authoritative pause after each card so everyone sees the result (SOLD stamp, sealed-bid reveal) before the
   next card's clock starts; actions inside the pause are ignored */
const gapMs=g=>{if(window.BB_FAST)return 0;const v=g.reveal&&g.reveal.idx===g.idx?g.reveal:null,sold=g.log.length&&g.log[g.log.length-1].who;
  return v&&v.win&&!v.grab?3600:sold?2800:1400};   // sealed reveal (bars, then the winner) / any sale / a pass
/* reading time: after the pause, each new card is shown with its clock stopped for a few seconds (lobby: 看牌時間) so
   people can take in the card before anyone may bid; bots wait it out too. Everyone still bidding can end it early. */
const READ_OPTS=[0,3,5,8],readMs=g=>window.BB_FAST?0:(g.read==null?5:g.read)*1000;
const t0=g=>Math.max(now(),g.gapEnd||0,g.readEnd||0),inGap=g=>now()<Math.max(g.gapEnd||0,g.readEnd||0)-200,inPause=g=>now()<(g.gapEnd||0)-200,
  inRead=g=>now()<(g.readEnd||0)-200;
function readDone(S,who,all){const g=S.game;if(S.phase!=='auction'||!inRead(g))return false;g.rd=g.rd||{};g.rd[who]=1;
  const need=g.sides.filter(s=>!(typeof isBot==='function'&&isBot(s))&&openN(g,s)>0&&!(g.stage==='left'&&g.solo&&g.solo.who!==s));
  if(!all&&!need.every(s=>g.rd[s]))return true;const d=Math.max(0,g.readEnd-Math.max(now(),g.gapEnd||0));
  ['deadline','openAt'].forEach(k=>{if(g[k])g[k]-=d});g.readEnd=Math.max(now(),g.gapEnd||0);return true}
// a won card goes straight onto the roster (see autoPlace); every card ends here or in skipCard
function sell(S,who,amt){const g=S.game;g.turn=null;const pay=couponPay(g,who,amt);g.rosters[who].push({slot:null,k:g.idx,price:pay});g.spent[who]+=pay;autoPlace(g,who);
  g.log.push({n:cur(g).n,who,amt:pay,slot:placeNote(g,who,g.idx),...(pay<amt?{full:amt}:{})});nextCard(S)}
function skipCard(S){const g=S.game;g.log.push({n:cur(g).n,who:null});if(g.sides.some(s=>openN(g,s)>0))addExtra(g);nextCard(S)}
/* timers run only on the device that owns the game state */
function tickAuth(){
  if(!S||!S.game||!(offline()||NET.mode==='host'))return;
  const g=S.game,t=now();let changed=false;
  // seated players who dropped offline are auto-passed so the game keeps moving
  const off=new Set();if(NET.mode==='host'&&NET.joinedAt&&Date.now()-NET.joinedAt>15000){const on=onlineSet();g.sides.forEach(s=>{const c=S.seats[s]&&S.seats[s].cid;if(c&&c!==CID&&!on.has(c))off.add(s)})}
  if(S.phase==='auction'&&off.size){
    if(inGap(g)){}
    else if(!fmtBusy(g)){for(const s of off)if(openN(g,s)>0&&!g.pass[s]&&g.bid.who!==s){g.pass[s]=true;changed=true}if(changed&&(!g.turn||g.pass[g.turn]))advance(S)}
  }
  if(S.phase==='cards'&&g.cards){g.sides.forEach(s=>{if(!g.cards[s].pick&&(off.has(s)||t>g.cardEnd)){autoCards(g,s);changed=true}});
    if(changed&&g.sides.every(s=>g.cards[s].pick))prepNext(S)}
  if(S.phase==='mission'&&g.mis){g.sides.forEach(s=>{if(g.mis[s].pick==null&&(off.has(s)||t>g.misEnd)){autoPick(g,s);changed=true}});
    if(changed&&g.sides.every(s=>g.mis[s].pick!=null))beginAuction(S)}
  if(S.phase==='lineup'&&off.size){for(const s of off)if(!g.ready[s]){g.ready[s]=true;changed=true}if(changed&&g.sides.every(s=>g.ready[s])){finish(S)}}
  if(S.phase==='auction'){
    if(inGap(g)){}
    else if(fmtBusy(g)){if(fmtTick(S,off))changed=true}
    else if(t>g.deadline){if(g.turn)g.pass[g.turn]=true;advance(S);changed=true}
  }else if(S.phase==='lineup'&&t>g.lineupEnd){finish(S);changed=true}
  if(changed){fx(snapPrev);commit()}
}
function apply(S,a,actor){
  const r=actor.role,g=S.game;if(!a||typeof a.a!=='string')return false;
  const who=r==='all'?a.who:r;const isP=r==='all'||ALL.includes(r);
  switch(a.a){
    case 'seat':{if(offline()||S.phase!=='lobby'||S.season)return false;const seat=a.seat;if(![...ALL,'spec'].includes(seat))return false;
      if(seat!=='spec'&&S.seats[seat]&&S.seats[seat].cid!==actor.cid)return false;
      for(const k of ALL)if(S.seats[k]&&S.seats[k].cid===actor.cid&&k!==seat)S.seats[k]=null;
      if(seat!=='spec')S.seats[seat]={cid:actor.cid,name:clean(a.name)||'無名氏'};return true}
    case 'aist':{if(NET.mode!=='ai'||S.phase!=='lobby'||S.season||!S.bots||!S.bots[a.s]||!(own(BOT_STYLE,a.v)||a.v==='rand'))return false;S.bots[a.s].st=a.v;if(a.v!=='rand')S.names[a.s]=BOT_STYLE[a.v].nm;return true}
    case 'ailv':{if(NET.mode!=='ai'||S.phase!=='lobby'||S.season||!own(BOT_LV,a.v))return false;S.botLv=a.v;return true}
    case 'names':{if(!offline()||S.season)return false;ALL.forEach(s=>{if(a[s]!=null&&!(S.bots&&S.bots[s]))S.names[s]=clean(a[s])||('玩家 '+s)});return true}
    case 'cfg':{if(!isP||S.phase!=='lobby'||!a.cfg||S.season)return false;const c=S.cfg,n=a.cfg;
      if(n.fmt!=null&&(own(FMTS,n.fmt)||n.fmt==='rotate'))c.fmt=n.fmt;if(n.nom!=null)c.nom=!!n.nom;
      if(n.mis!=null)c.mis=!!n.mis;if(n.showYr!=null)c.showYr=!!n.showYr;if(n.read!=null&&READ_OPTS.includes(n.read|0))c.read=n.read|0;if(n.cards!=null)c.cards=!!n.cards;if(n.season!=null)c.season=SEASON_N.includes(n.season)?n.season:0;if(n.bal!=null)c.bal=!!n.bal;
      if(n.players===2||n.players===3){c.players=n.players;if(n.players===2&&S.seats.C&&NET.mode!=='local')S.seats.C=null}
      if(n.budget!=null)c.budget=clamp(n.budget|0,5,999);
      if(typeof n.theme==='string'&&(['random','custom','pick'].includes(n.theme)||THEMES.some(t=>t.id===n.theme)))c.theme=n.theme;
      if('era' in n)c.era=Array.isArray(n.era)&&n.era.length===2&&n.era.every(x=>DECS.includes(x))?[Math.min(...n.era),Math.max(...n.era)]:null;
      if(Array.isArray(n.teams))c.teams=[...new Set(n.teams.filter(k=>own(FRZH,k)))].slice(0,30);
      if(n.size===5||n.size===10){if(n.size===10&&c.size!==10&&c.budget<25)c.budget=25;if(n.size===5&&c.size===10&&c.budget===25)c.budget=15;c.size=n.size}
      if(Array.isArray(n.picks))c.picks=[...new Set(n.picks.filter(id=>typeof id==='string'&&THEMES.some(t=>t.id===id)))].slice(0,12);
      if(typeof n.pcat==='string'&&CATS.includes(n.pcat))c.pcat=n.pcat;
      if(n.pmode==='merge'||n.pmode==='one')c.pmode=n.pmode;
      if(Array.isArray(n.cats))c.cats=n.cats.filter(x=>CATS.includes(x));
      if(n.custom)c.custom={name:clean(n.custom.name,30),text:String(n.custom.text||'').slice(0,1500)};
      if(n.showStats!=null)c.showStats=!!n.showStats;if(n.hints!=null)c.hints=!!n.hints;
      if(n.draw!=null)c.draw=n.draw|0;else if(n.theme||n.players||n.custom||n.picks||n.size)c.draw=defaultDraw(c);
      const L=poolLenFor(c),need=c.players*(c.size||5);if(L)c.draw=clamp(c.draw,Math.min(need,L),L);
      S.err='';S.by=actor.cid;return true}
    case 'start':{if(!isP||!(S.phase==='lobby'&&!S.season||S.phase==='season'&&S.season&&!S.season.done))return false;if(NET.mode==='ai')aiAssign(S);return startGame(S)}
    case 'sready':{if(S.phase!=='season'||!S.season||S.season.done||offline()||!ALL.includes(r)||!S.season.sides.includes(r))return false;
      S.sready=S.sready||{};S.sready[r]=!!a.v;if(S.season.sides.every(x=>S.sready[x])&&!waitingFor().length)return startGame(S)||true;return true}
    case 'card':{if(!g||!g.sides.includes(who))return false;return useCard(S,who,a)}
    case 'rdone':{if(!g||!g.sides.includes(who))return false;return readDone(S,who,r==='all'&&NET.mode==='local')}
    case 'mpick':{if(S.phase!=='mission'||!g||!g.mis||!g.sides.includes(who))return false;const M=g.mis[who],i=a.i|0;if(i<0||i>=M.opts.length)return false;
      M.pick=i;M.auto=0;if(g.sides.every(s=>g.mis[s].pick!=null))beginAuction(S);return true}
    case 'endSeason':{if(!isP||S.phase!=='season'||!S.season||S.season.done)return false;if(!S.season.rounds.length){S.season=null;S.phase='lobby';return true}seasonEnd(S);return true}
    case 'closeSeason':{if(!isP||S.phase!=='season'||!S.season||!S.season.done)return false;S.lastSeason=S.season;S.season=null;S.phase='lobby';return true}
    case 'nominate':case 'sbid':case 'grab':case 'spass':case 'lpick':case 'lnone':return g.sides.includes(who)?fmtApply(S,a,who):false;
    case 'bid':{if(S.phase!=='auction'||inGap(g)||!g.sides.includes(who)||fmtBusy(g))return false;
      if(a.idx!=null&&a.idx!==g.idx)return false;const amt=a.amt|0;
      if(g.turn!==who||g.pass[who]||g.bid.who===who||amt<=g.bid.amt||amt<1||amt>maxBid(g,who))return false;
      g.bid={who,amt};
      if(eligible(g).length===1)sell(S,who,amt);else advance(S);return true}
    case 'pass':{if(S.phase!=='auction'||inGap(g)||!g.sides.includes(who)||g.bid.who===who||g.pass[who]||fmtBusy(g))return false;
      if(a.idx!=null&&a.idx!==g.idx)return false;
      g.pass[who]=true;if(g.turn===who||!g.turn)advance(S);return true}
    case 'swap':{if(S.phase!=='lineup'||!g.sides.includes(who)||g.ready[who])return false;
      const R=g.rosters[who],x=R.find(q=>q.slot===a.x),y=R.find(q=>q.slot===a.y);if(!x||!y||x===y)return false;[x.slot,y.slot]=[y.slot,x.slot];[x.role,y.role]=[y.role,x.role];return true}
    case 'brole':{if(S.phase!=='lineup'||!g.sides.includes(who)||g.ready[who]||!own(BROLE,a.role))return false;const R=g.rosters[who],e=R.find(q=>q.slot===a.slot&&isBench(q.slot));if(!e)return false;
      if(a.role==='X')R.forEach(q=>{if(q!==e&&q.role==='X')q.role=natRole(g.items[q.k])});e.role=a.role;return true}
    case 'ready':{if(S.phase!=='lineup'||!g.sides.includes(who))return false;if(a.v&&!benchOK(g,who))return false;g.ready[who]=!!a.v;if(g.sides.every(s=>g.ready[s]))finish(S);return true}
    case 'again':{if(!isP)return false;
      // the first player back keeps the finished game in S.last so the others can keep watching it
      if(S.phase==='results'){S.last={game:S.game,sim:S.sim};S.phase=S.season?'season':'lobby';S.game=null;S.sim=null;S.back={}}
      else if(!((S.phase==='lobby'||S.phase==='season')&&S.last))return false;
      if(r==='all'||offline()){S.last=null;S.back={};return true}
      S.back=S.back||{};S.back[actor.cid]=1;return true}
    case 'quit':{if(!isP||S.phase==='lobby'||S.phase==='season')return false;S.phase=S.season?'season':'lobby';S.game=null;S.sim=null;S.last=null;S.back={};return true}
    case 'resetScores':{if(!isP)return false;S.scores={};return true}
  }
  return false;
}

/* ---------- matchup model ----------
 Base: OBPM+DBPM (Box Plus/Minus, Basketball-Reference), shrunk toward replacement level for small samples.
 Calibration (1985-2025, 1,230 real team-seasons): the top-5 BPM sum explains SRS with R²=0.73 at 0.79 pts per BPM;
 adding usage/playmaker/rebounding/rim-protection fit terms raised R² by only 0.001, so those are dropped except a mild
 usage-overlap penalty for fantasy lineups far outside the real range. Positions, matchups and chemistry are game rules. */
const REPL={obpm:-1.5,dbpm:-0.5,usg:18,astp:12,trbp:10,blkp:1,stlp:1.5};
const KMIN=800,MARGIN=0.79,GSD=12.7;
const shr=(v,p,prior)=>{const m=num(p.mp,20)*num(p.g,40);return (num(v,prior)*m+prior*KMIN)/(m+KMIN)};
const st=p=>({pts:num(p.pts,8),trb:num(p.trb,num(p.trbp,10)*0.45),ast:num(p.ast,num(p.astp,12)*0.25),stl:num(p.stl,num(p.stlp,1.5)*0.55),blk:num(p.blk,num(p.blkp,1)*0.5),tov:num(p.tov,0.11*num(p.pts,8)+0.15*num(p.ast,2)+0.5)});
const crea=p=>clamp((num(p.usg,18)-15)/15,0,1)*0.6+clamp((num(p.astp,12)-10)/30,0,1)*0.4;
const postS=p=>clamp((num(p.trbp,10)-8)/12,0,1)*0.5+clamp((num(p.usg,18)-15)/15,0,1)*0.5;
const rebS=p=>clamp((num(p.trbp,10)-8)/12,0,1);
// floor spacing: 3PA per game × 3P% (Kevin Love, Towns, Porziņģis ≈1; Shaq, Gobert, Duncan ≈0)
const spc=p=>clamp((num(p.tpa,0)-0.8)/3.5,0,1)*clamp((num(p.tp,0)-0.30)/0.07,0,1);
// one player's multipliers in a slot, optionally against a specific opponent in the same slot
function playerFx(p,q){
  const m={pts:1,reb:1,ast:1,stl:1,blk:1,tov:1,off:0,def:0,why:[]};const pi=posInfo(p,p.slot);
  if(pi.x>0){if(pi.dir>0){m.blk*=1-0.15*pi.x;m.tov*=1+0.1*pi.x;m.def-=1.2*pi.x;m.why.push('size')}
    else{m.tov*=1+0.4*pi.x;m.ast*=1-0.1*pi.x;m.stl*=1-0.1*pi.x;m.off-=1.2*pi.x;m.why.push('handle')}}
  if(q){const gap=peOf(q)-peOf(p);if(Math.abs(gap)>=0.75){const ge=Math.min(1.5,Math.abs(gap));
    if(gap>0){m.pts*=1+0.10*ge*crea(p);m.reb*=1-0.06*ge;m.why.push('speed')}else{m.pts*=1+0.08*ge*postS(p);m.reb*=1+0.08*ge*rebS(p);m.why.push('post')}}
    // stretch big vs traditional big (PF/C only): spacing helps the shooter score but he rebounds less;
    // the traditional big gets pulled away from the rim (fewer blocks) but wins the glass
    if(POS.indexOf(p.slot)>=3){const ds=spc(p)-spc(q);
      if(ds>=0.3){m.pts*=1+0.09*ds;m.reb*=1-0.08*ds;m.why.push('stretch')}
      else if(ds<=-0.3){const a=-ds;m.blk*=1-0.25*a;m.reb*=1+0.06*a;m.why.push('pulled')}}}
  return m;
}
function fxPoints(p,m){const b=st(p);
  const off=b.pts*(m.pts-1)+0.4*b.ast*(m.ast-1)-1.0*b.tov*(m.tov-1)+0.3*b.trb*(m.reb-1)+m.off;
  const def=1.0*b.stl*(m.stl-1)+0.6*b.blk*(m.blk-1)+0.3*b.trb*(m.reb-1)+m.def;return{off,def}}
// bench (夢幻隊 10-man mode): each bench player is worth ~25% of a starter, measured against replacement level,
// so a 5-man team (whose bench is implicitly replacement level) and a 10-man team with a replacement bench rate the same
/* temper & fouls (10-man mode). Hot heads = players known for technical-foul totals or on-court fights.
   Foul trouble comes from personal fouls per 36 minutes in the player's window. Kept small on purpose:
   an ejection costs about a point of margin in that one game, so these players stay worth buying. */
const HOT=new Set(['wallara01','couside01','greendr01','westbru01','howardw01','rodmade01','laimbbi01','barklch01','artesro01','garneke01','jacksst02','brookdi01','perkike01','mahorri01','oaklech01']);
const foulK=p=>clamp((num(p.pf36,3.2)-3.6)/2,0,1);
const isHot=p=>!!p&&HOT.has(p.id),foulProne=p=>num(p.pf36,0)>=4.6;
const pval=p=>shr(p.obpm,p,REPL.obpm)+shr(p.dbpm,p,REPL.dbpm);
function incidents(R,side,r){const out=[],used=new Set();const bench=benchOf(R).slice().sort((x,y)=>pval(y)-pval(x));
  const sub1=p=>{const b=subFor(p.slot,bench,used);if(b)used.add(b.n);return b};
  starters(R).forEach(p=>{const k=foulK(p),hot=isHot(p),u=r(),v=r();let inc=null;
    if(hot&&u<0.05)inc={kind:'eject',q:1+Math.floor(r()*3),t:0.15+0.7*r()};
    else if(v<0.005+0.10*k)inc={kind:'foulout',q:3,t:0.25+0.65*r()};
    else if(v<0.035+0.25*k)inc={kind:'trouble',q:1+Math.floor(r()*2),t:0.3+0.5*r()};
    else if(hot&&u<0.30)inc={kind:'tech',q:Math.floor(r()*4),t:0.1+0.8*r()};
    if(!inc)return;inc.side=side;inc.n=p.n;
    if(inc.kind==='tech'){out.push(inc);return}
    const s=sub1(p);inc.sub=s?s.n:null;inc.lost=inc.kind==='trouble'?0.12:Math.max(0.05,(4-(inc.q+inc.t))/4);
    inc.cost=+((Math.max(0,pval(p)-(s?pval(s):REPL.obpm+REPL.dbpm))+0.6)*inc.lost*0.8).toFixed(2);out.push(inc)});
  return out}
function baseRate(Rall,g,leftover){const R=starters(Rall),Bn=benchOf(Rall);
  const O=R.reduce((t,p)=>t+shr(p.obpm,p,REPL.obpm),0),D=R.reduce((t,p)=>t+shr(p.dbpm,p,REPL.dbpm),0);
  const bv=benchValue(Bn),benchAdj=bv.adj;
  const U=R.reduce((t,p)=>t+num(p.usg,REPL.usg),0),usgAdj=-0.05*Math.max(0,U-110);
  const ch=chem(Rall,g),savAdj=Math.min(SAVE_CAP,SAVE_PT*Math.max(0,leftover||0));
  const off=O+usgAdj+ch.tm/2+ch.lgv/2-0.6*ch.fd+savAdj/2+benchAdj/2,def=D+ch.tm/2+ch.lgv/2+ch.sw-0.4*ch.fd+savAdj/2+benchAdj/2;
  return{bv,O,D,U,usgAdj,tmAdj:ch.tm,lgAdj:ch.lgv,swAdj:ch.sw,fdAdj:-ch.fd,savAdj,benchAdj,off,def,net:off+def,ch};
}
function pairRate(base,R,Ropp){let o=0,d=0;const per=[];
  starters(R).forEach(p=>{const q=Ropp?Ropp.find(x=>x.slot===p.slot):null;const m=playerFx(p,q);const f=fxPoints(p,m);o+=f.off;d+=f.def;per.push({p,q,m,f})});
  return{off:base.off+o,def:base.def+d,posAdj:o+d,per}}
const strength=(R,g,leftover)=>{const b=baseRate(R,g,leftover);return b.net+pairRate(b,R,null).posAdj};
function percentile(g,R,val){
  const r=rng(hash(g.gid+'pct'));const pool=g.pool;let below=0,N=300;
  const sz=g.size===10?10:5;
  for(let i=0;i<N;i++){const sh=shuffle(pool,r),pick=sh.slice(0,5).sort((a,b)=>peOf(a)-peOf(b)).map((p,j)=>({...p,slot:POS[j]})).concat(sh.slice(5,sz).map((p,j)=>({...p,slot:BENCH[j]})));if(strength(pick,g,0)<val)below++}
  return Math.round(below/N*100);
}
function grade(pct){return pct>=90?'S':pct>=70?'A':pct>=40?'B':pct>=15?'C':'D'}
function rosterOf(g,s){const L=SLOTS(g);return g.rosters[s].map(r=>({...g.items[r.k],slot:r.slot,price:r.price,role:r.role})).sort((a,b)=>L.indexOf(a.slot)-L.indexOf(b.slot))}
function alloc(total,weights){const W=weights.reduce((a,b)=>a+b,0)||1;const raw=weights.map(w=>w/W*total);const fl=raw.map(Math.floor);let rem=total-fl.reduce((a,b)=>a+b,0);
  raw.map((x,i)=>[x-fl[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(rem>0){fl[i]++;rem--}});return fl}
const Phi=x=>{const t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp(-x*x/2);const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p};
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
const withBench=(R,per)=>per.concat(benchOf(R).map(p=>({p,m:playerFx(p,null),bench:1,bw:(BROLE[p.role]||BROLE.G).mins})));
// minutes shift after foul trouble / foul-out / ejection: the starter loses the time, his sub picks it up
function withMins(per,inc){return per.map(x=>{let play=1,extra=0;(inc||[]).forEach(i=>{if(i.kind==='tech')return;if(i.n===x.p.n)play-=i.lost;if(i.sub&&i.sub===x.p.n)extra+=i.lost});return play===1&&!extra?x:{...x,play:Math.max(0.05,play),extra}})}
/* breakout nights: now and then a role player (lower half of his roster by value) has the game of his life.
   About 8% per team per game; his team gets a few extra points that night and he takes a big share of the scoring. */
const BO_P=0.08;
function boCands(R,gi){const v=R.filter(p=>!p.fa).map(p=>pval(p)).sort((a,b)=>a-b),med=v[Math.floor(v.length/2)];
  const out=new Set((gi||[]).filter(i=>i.kind==='eject'||i.kind==='foulout').map(i=>i.n));return R.filter(p=>!p.fa&&pval(p)<med&&!out.has(p.n))}
/* star takeovers: a star (MVP, Finals MVP, 2+ All-NBA 1st teams or 8+ All-Star games) sometimes
   takes over a single game. Rate per star per game ~5-7%, a bit higher in his prime, lower as a rookie or late in
   his career. That night his team gets ~4 extra points and he takes well over his usual share of the scoring.
   Shown on the card as 爆發型. Bots value cards on the regular numbers only. */
const TK_PTS=4;
function tkRate(p){if(!p||p.fa)return 0;const b=bioOf(p)||{};let v=b.mvp>0?0.065:(b.all1>=2||b.as>=8||b.fmvp)?0.05:0;
  if(!v)return 0;const ph=typeof phaseOf==='function'?phaseOf(p):null;return v*({prime:1.15,early:0.85,late:0.7,rook:0.6}[ph]||1)}
function tkPick(R,gi,r){const out=new Set((gi||[]).filter(i=>i.kind==='eject'||i.kind==='foulout').map(i=>i.n));
  const c=R.filter(p=>!out.has(p.n)&&tkRate(p)>0);for(let i=c.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[c[i],c[j]]=[c[j],c[i]]}
  for(const p of c)if(r()<tkRate(p))return p.n;return null}
function boxFor(R,per,score,r,bo,tk){const mf=x=>(x.bench?(x.bw||0.35):1)*(x.play==null?1:x.play)+(x.extra||0),bx=(x,k)=>x.p.n===bo?{pts:2.8,reb:1.3,ast:1.3}[k]||1:x.p.n===tk?{pts:2.3,reb:1.15,ast:1.25}[k]||1:1;
  const w=k=>per.map(x=>{const b=st(x.p);return mf(x)*bx(x,k)*{pts:Math.pow(Math.max(2,b.pts*x.m.pts),0.65),reb:Math.max(1,b.trb*x.m.reb),ast:Math.max(.5,b.ast*x.m.ast),stl:Math.max(.2,b.stl*x.m.stl),blk:Math.max(.1,b.blk*x.m.blk),tov:Math.max(.3,b.tov*x.m.tov)}[k]*(0.75+0.5*r())});
  const tot=k=>per.reduce((t,x)=>{const b=st(x.p);return t+b[k==='reb'?'trb':k]*x.m[k]*mf(x)},0);
  const pts=alloc(score,w('pts')),reb=alloc(Math.round(clamp(tot('reb')*1.05,34,58)+gauss(r)*3),w('reb')),ast=alloc(Math.round(clamp(tot('ast'),18,32)+gauss(r)*2),w('ast'));
  const stl=alloc(Math.round(clamp(tot('stl'),4,12)+r()*2),w('stl')),blk=alloc(Math.round(clamp(tot('blk'),2,10)+r()*2),w('blk')),tov=alloc(Math.round(clamp(tot('tov'),8,20)+gauss(r)*2),w('tov'));
  return R.map((p,i)=>{const m=per[i].m;return{n:p.n,slot:p.slot,pts:pts[i],reb:reb[i],ast:ast[i],stl:stl[i],blk:blk[i],tov:tov[i],
    m:{pts:+m.pts.toFixed(2),reb:+m.reb.toFixed(2),ast:+m.ast.toFixed(2),tov:+m.tov.toFixed(2),stl:+m.stl.toFixed(2),blk:+m.blk.toFixed(2)}}})}
function simulate(S){
  const g=S.game,sides=g.sides,ro={},base={},teams={};
  sides.forEach(s=>{ro[s]=rosterOf(g,s);base[s]=baseRate(ro[s],g,left(g,s))});
  sides.forEach(s=>{const sv=base[s].net+pairRate(base[s],ro[s],null).posAdj;const pct=percentile(g,ro[s],sv);
    const mb=(g.misRes&&g.misRes[s]&&g.misRes[s].bonus)||0;base[s].misAdj=mb;base[s].off+=mb/2;base[s].def+=mb/2;base[s].net+=mb;
    const hc=homeAdj(g,s);base[s].hcAdj=hc;base[s].off+=hc/2;base[s].def+=hc/2;base[s].net+=hc;
    teams[s]={strength:+(sv+mb+hc).toFixed(2),pct,grade:grade(pct),base:Object.fromEntries(['O','D','U','usgAdj','tmAdj','lgAdj','swAdj','fdAdj','savAdj','benchAdj','misAdj','hcAdj','net'].map(k=>[k,+(base[s][k]||0).toFixed(2)])),chem:base[s].ch,sw:0,gw:0,gl:0,posSum:0,posN:0}});
  const series=[];
  for(let i=0;i<sides.length;i++)for(let j=i+1;j<sides.length;j++){const a=sides[i],b=sides[j];
    const ra=pairRate(base[a],ro[a],ro[b]),rb=pairRate(base[b],ro[b],ro[a]);
    teams[a].posSum+=ra.posAdj;teams[a].posN++;teams[b].posSum+=rb.posAdj;teams[b].posN++;
    const margin=MARGIN*((ra.off+ra.def)-(rb.off+rb.def)),avg=112+0.2*((ra.off-rb.def)+(rb.off-ra.def))/2;
    const p=Phi(margin/GSD),r=rng(hash(g.gid+a+b)),ri=rng(hash(g.gid+a+b+'inc')),rbo=rng(hash(g.gid+a+b+'bo')),rtk=rng(hash(g.gid+a+b+'tk'));let wa=0,wb=0;const games=[],inc=[],bo=[],tk=[];
    while(wa<4&&wb<4){const gi=g.size===10?incidents(ro[a],a,ri).concat(incidents(ro[b],b,ri)):[];inc.push(gi);
      const ca=gi.filter(x=>x.side===a).reduce((t,x)=>t+(x.cost||0),0),cb=gi.filter(x=>x.side===b).reduce((t,x)=>t+(x.cost||0),0),mg=margin+MARGIN*(cb-ca);
      const bg={};[a,b].forEach(s=>{if(rbo()<BO_P){const c=boCands(ro[s],gi);if(c.length)bg[s]=c[Math.floor(rbo()*c.length)].n}});bo.push(bg);
      const tg={};[a,b].forEach(s=>{const n=tkPick(ro[s],gi,rtk);if(n)tg[s]=n});tk.push(tg);
      let sa=Math.round(avg+mg/2+gauss(r)*9)+(bg[a]?3:0)+(tg[a]?TK_PTS:0),sb=Math.round(avg-mg/2+gauss(r)*9)+(bg[b]?3:0)+(tg[b]?TK_PTS:0),ot=0;if(Math.abs(sa-sb)===1&&r()<0.55){sa=sb=Math.max(sa,sb)}/* NBA goes to OT ~6% of games; a raw gaussian tie alone gives ~2% */while(sa===sb){ot++;sa+=Math.round(5+r()*8);sb+=Math.round(5+r()*8)}games.push([sa,sb,ot]);sa>sb?wa++:wb++}
    let pser=0;const C=(n,k)=>{let x=1;for(let t=1;t<=k;t++)x=x*(n-k+t)/t;return x};for(let l=0;l<=3;l++)pser+=C(3+l,l)*Math.pow(p,4)*Math.pow(1-p,l);
    const win=wa>wb?a:b,fav=p>=0.5?a:b,last=games[games.length-1];
    const li=inc[inc.length-1]||[],pa=withMins(withBench(ro[a],ra.per),li),pb=withMins(withBench(ro[b],rb.per),li);
    const lb=bo[bo.length-1]||{},lt=tk[tk.length-1]||{},box={[a]:boxFor(pa.map(x=>x.p),pa,last[0],r,lb[a],lt[a]),[b]:boxFor(pb.map(x=>x.p),pb,last[1],r,lb[b],lt[b])};
    const mu=POS.map(sl=>{const x=ra.per.find(z=>z.p.slot===sl),y=rb.per.find(z=>z.p.slot===sl);if(!x||!y)return null;
      if(!x.m.why.length&&!y.m.why.length)return null;return{slot:sl,a:x.p.n,b:y.p.n,ma:x.m,mb:y.m,fa:+(x.f.off+x.f.def).toFixed(2),fb:+(y.f.off+y.f.def).toFixed(2)}}).filter(Boolean);
    teams[win].sw++;teams[a].gw+=wa;teams[a].gl+=wb;teams[b].gw+=wb;teams[b].gl+=wa;
    series.push({a,b,wa,wb,games,inc,bo,tk,p:+p.toFixed(3),pser:+pser.toFixed(3),win,fav,upset:win!==fav&&Math.abs(p-0.5)>0.05,box,mu,pa:+ra.posAdj.toFixed(2),pb:+rb.posAdj.toFixed(2)})}
  sides.forEach(s=>{teams[s].posAdj=+(teams[s].posSum/Math.max(1,teams[s].posN)).toFixed(2)});
  const order=[...sides].sort((x,y)=>teams[y].sw-teams[x].sw||(teams[y].gw-teams[y].gl)-(teams[x].gw-teams[x].gl)||teams[y].strength-teams[x].strength);
  // MVP from champion's deciding-game boxes
  const champ=order[0];let mvp=null;series.filter(z=>z.a===champ||z.b===champ).forEach(z=>z.box[champ].forEach(x=>{const v=x.pts+x.reb*1.2+x.ast*1.5+x.stl*2+x.blk*2;if(!mvp||v>mvp.v)mvp={...x,v}}));
  return{teams,series,order,champ,mvp};
}

/* ---------- network: public MQTT relay, end-to-end encrypted with a key derived from the room code ---------- */
let S=null,snapPrev=null;
const BROKERS=window.BB_BROKERS||['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt'];
const NET={mode:null,code:null,bi:0,pending:[],online:new Map(),err:'',busy:false,skew:0,conn:true,timers:[],client:null,key:null,tid:null};
const HAS_MQTT=()=>!!window.mqtt;
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveRoom(code){
  const sub=crypto&&crypto.subtle;
  if(!sub){NET.key=null;NET.tid='p'+hash('t:'+code).toString(36)+hash('u:'+code).toString(36);return}
  const h=new Uint8Array(await sub.digest('SHA-256',enc.encode('bb-topic:'+code)));NET.tid=[...h.slice(0,10)].map(x=>x.toString(16).padStart(2,'0')).join('');
  NET.key=await sub.importKey('raw',await sub.digest('SHA-256',enc.encode('bb-key:'+code)),'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(o){const js=JSON.stringify(o);if(!NET.key)return js;const iv=crypto.getRandomValues(new Uint8Array(12));
  return 'E'+b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},NET.key,enc.encode(js)))}
async function unseal(s){s=String(s);if(s[0]!=='E'){return NET.key?null:JSON.parse(s)}if(!NET.key)return null;const [i,c]=s.slice(1).split('.');
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(i)},NET.key,unb64(c))))}
const topic=x=>`ballerbid/v1/${NET.tid}/${x}`;
/* everything received from other players is untrusted: strip characters that could break out of HTML, and
   reject structurally wrong states, so a malicious participant cannot inject markup or script */
function deepClean(o,d=0){if(d>12)return null;if(typeof o==='string')return o.replace(/[<>"`\\]/g,'').slice(0,2000);
  if(typeof o==='number')return isFinite(o)?o:0;if(typeof o==='boolean'||o===null)return o;
  if(Array.isArray(o))return o.slice(0,400).map(x=>deepClean(x,d+1));
  if(typeof o==='object'){const r={};for(const k of Object.keys(o).slice(0,400)){if(k==='__proto__'||k==='constructor'||k==='prototype')continue;r[k]=deepClean(o[k],d+1)}return r}return null}
function validState(m){if(!m||typeof m!=='object'||typeof m.v!=='number')return false;const g=m.game;
  if(g){if(!Array.isArray(g.sides)||!g.sides.length||!g.sides.every(x=>ALL.includes(x)))return false;if(!/^[a-z0-9]{1,12}$/.test(String(g.gid)))return false;
    if(!Array.isArray(g.items)||!g.rosters||typeof g.rosters!=='object')return false}
  if(m.phase&&!['lobby','cards','mission','auction','lineup','results','season'].includes(m.phase))return false;return true}
const onlineSet=()=>new Set([...NET.online].filter(([,t])=>Date.now()-t<15000).map(([c])=>c));
function mqttConnect(bi){return new Promise((res,rej)=>{let done=false;
  const c=mqtt.connect(BROKERS[bi],{clientId:'bb_'+CID+'_'+Math.random().toString(36).slice(2,6),clean:true,connectTimeout:7000,reconnectPeriod:2500,keepalive:30,timerVariant:'native'});
  const to=setTimeout(()=>{if(!done){done=true;try{c.end(true)}catch(e){}rej(new Error('timeout'))}},8000);
  c.once('connect',()=>{if(done)return;done=true;clearTimeout(to);res(c)});})}
function commit(){
  if(!S)return;S.v=(S.v||0)+1;S.t=Date.now();S.app=APPV;
  if(NET.mode==='local')lsSet(LS,S);
  if(NET.mode==='ai')lsSet(LS_AI,S);
  if(NET.mode==='host')publishState();
  render();
}
let pubChain=Promise.resolve();
function publishState(){const snap=JSON.parse(JSON.stringify(S));pubChain=pubChain.then(async()=>{if(NET.client)NET.client.publish(topic('s'),await seal(snap),{qos:1,retain:true})}).catch(()=>{})}
async function onMsg(t,buf){NET.lastRx=Date.now();
  let m;try{m=deepClean(await unseal(buf.toString()))}catch(e){return}if(!m)return;
  if(t===topic('h')){if(m.cid){const was=onlineSet().has(m.cid);NET.online.set(m.cid,Date.now());if(!was)render()}return}
  if(t===topic('a')){if(NET.mode!=='host'||!S)return;if(typeof m.cid!=='string'||typeof m.n!=='number'||!m.a)return;const cid=m.cid.slice(0,16);
    NET.online.set(cid,Date.now());if(m.n<=(S.acks[cid]||0))return;const prev=snapOf();apply(S,m.a,{cid,role:roleOf(S,cid)});S.acks[cid]=m.n;fx(prev);commit();return}
  if(t===topic('s')){if(!validState(m))return;
    if(NET.mode==='host'){if(m.auth!==CID&&m.v>S.v){NET.mode='guest';takeState(m);toast('另一位玩家接手了房主')}return}
    if(S&&m.v<S.v)return;takeState(m)}
}
function takeState(m){const prev=snapOf();if(m.app&&m.app!==APPV)ui.verWarn=true;S=m;NET.skew=(m.t||Date.now())-Date.now();if(Math.abs(NET.skew)<1500)NET.skew=0;
  if(S.auth===CID&&NET.mode==='guest'){NET.mode='host'}
  const ack=(S.acks&&S.acks[CID])||0;NET.pending=NET.pending.filter(x=>x.n>ack);fx(prev);render()}
function wire(c){
  NET.client=c;c.subscribe([topic('s'),topic('a'),topic('h')],{qos:1});
  c.on('message',(t,buf)=>{onMsg(t,buf)});
  c.on('reconnect',()=>{NET.conn=false;render()});c.on('offline',()=>{NET.conn=false;render()});
  c.on('connect',()=>{NET.conn=true;if(NET.mode==='host')publishState();render()});NET.conn=true;
  const hb=async()=>{c.publish(topic('h'),await seal({cid:CID,name:MYNAME}));NET.online.set(CID,Date.now())};hb();NET.hb=hb;NET.lastRx=Date.now();
  c.on('connect',()=>{hb()});
  // our own heartbeat echoes back every 4 s; silence for 12 s means the socket died without telling us
  NET.timers.push(setInterval(()=>{if(document.visibilityState==='visible'&&NET.client===c&&Date.now()-(NET.lastRx||0)>12000){NET.lastRx=Date.now();NET.conn=false;render();try{c.reconnect()}catch(e){}}},3000));
  NET.timers.push(setInterval(hb,4000));
  NET.timers.push(setInterval(()=>{ // resend unacked actions; failover if the game owner vanished
    if(NET.mode==='guest'){const t=Date.now();NET.pending.forEach(async x=>{if(t-x.sent>3000){x.sent=t;c.publish(topic('a'),await seal({cid:CID,n:x.n,a:x.a}),{qos:1})}});
      if(S&&S.auth&&NET.joinedAt&&Date.now()-NET.joinedAt>15000){const on=onlineSet();const last=NET.online.get(S.auth)||0;
        if(Date.now()-last>15000){const cand=ALL.map(k=>S.seats[k]&&S.seats[k].cid).filter(c=>c&&c!==S.auth&&on.has(c))[0];
          if(cand===CID){NET.mode='host';S.auth=CID;toast('房主斷線了，由你接手主持運算');commit()}}}}
  },2000));
}
async function createRoom(){
  if(!MYNAME){toast('先輸入你的名字');return}
  if(!HAS_MQTT()){NET.err='連線元件載入失敗，請確認網路後重新整理';return render()}
  const code=randCode();NET.err='';NET.busy=true;render();
  try{await deriveRoom(code);let c=null,bi=0;for(;bi<BROKERS.length;bi++){try{c=await mqttConnect(bi);break}catch(e){}}
    if(!c)throw new Error('連不上連線伺服器，請確認網路');
    S=newState();S.auth=CID;S.code=code;S.seats.A={cid:CID,name:MYNAME};S.v=1;S.t=Date.now();
    NET.bi=bi;NET.code=code;NET.mode='host';NET.joinedAt=Date.now();wire(c);publishState();lsSet('bb_room',code+'-'+bi);setHash();wakeLock();
  }catch(e){NET.err='開房失敗：'+(e&&e.message||e);leaveNet();S=null}
  NET.busy=false;render();
}
async function joinRoom(code,bi){
  code=String(code||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(code.length!==6){toast('房號是 6 個字');return}
  if(!MYNAME){toast('先輸入你的名字');return}
  if(!HAS_MQTT()){NET.err='連線元件載入失敗，請確認網路後重新整理';return render()}
  NET.err='';NET.busy=true;render();
  try{await deriveRoom(code);
    const order=bi!=null?[bi,...BROKERS.map((_,i)=>i).filter(i=>i!==bi)]:BROKERS.map((_,i)=>i);let found=false;
    for(const b of order){let c;try{c=await mqttConnect(b)}catch(e){continue}
      const st0=await new Promise(res=>{const to=setTimeout(()=>res(null),4500);c.subscribe(topic('s'),{qos:1});
        c.on('message',async(t,buf)=>{if(t===topic('s')){try{const m=deepClean(await unseal(buf.toString()));if(m&&validState(m)){clearTimeout(to);res(m)}}catch(e){}}})});
      if(!st0){try{c.end(true)}catch(e){}continue}
      c.removeAllListeners('message');NET.bi=b;NET.code=code;found=true;
      NET.mode=st0.auth===CID?'host':'guest';S=null;takeState(st0);NET.joinedAt=Date.now();wire(c);break}
    if(!found)throw new Error('找不到房間 '+code.toUpperCase()+'（房號錯了，或房間已經沒人）');
    lsSet('bb_room',code+'-'+NET.bi);setHash();wakeLock();
  }catch(e){NET.err=(e&&e.message)||'加入失敗';leaveNet();S=null}
  NET.busy=false;render();
}
let wl=null;async function wakeLock(){try{if(navigator.wakeLock&&document.visibilityState==='visible')wl=await navigator.wakeLock.request('screen')}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&NET.mode&&!offline()){wakeLock();
  // back from the lock screen / another app: reconnect right away if the socket went quiet, then say we are here
  if(NET.client){if(Date.now()-(NET.lastRx||0)>6000){NET.lastRx=Date.now();try{NET.client.reconnect()}catch(e){}}else if(NET.hb)NET.hb()}}});
function setHash(){try{history.replaceState(null,'',location.pathname+location.search+'#room-'+NET.code+'-'+NET.bi)}catch(e){}}
function inviteLink(){return location.href.split('#')[0]+'#room-'+NET.code+'-'+NET.bi}
function leaveNet(){NET.timers.forEach(clearInterval);NET.timers=[];if(NET.client){try{NET.client.end(true)}catch(e){}}NET.client=null;
  NET.pending=[];NET.mode=null;NET.code=null;NET.online=new Map();NET.skew=0;try{wl&&wl.release()}catch(e){}try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
let lastN=0;
async function sendAct(a){let n=Date.now();if(n<=lastN)n=lastN+1;lastN=n;NET.pending.push({a,n,sent:Date.now()});NET.pending=NET.pending.slice(-8);
  if(NET.client)NET.client.publish(topic('a'),await seal({cid:CID,n,a}),{qos:1});render()}
function startAI(){NET.mode='ai';NET.skew=0;const sv=lsGet(LS_AI);S=sv&&sv.v&&sv.cfg&&sv.cfg.cats&&sv.bots?sv:aiState();
  if(!S.aiv){Object.values(S.bots).forEach(b=>{b.st='rand';delete b.play});S.aiv=2;if(!S.season)aiAssign(S)}render()}   // older saves had one fixed style
function startLocal(){NET.mode='local';NET.skew=0;const sv=lsGet(LS);S=sv&&sv.v&&sv.cfg&&sv.cfg.cats?sv:newState();render()}
function dispatch(a){
  if(!S)return;
  if(NET.mode==='guest'){sendAct(a);return}
  const prev=snapOf();
  if(apply(S,a,{cid:CID,role:roleOf(S,CID)})){fx(prev);commit()}else render();
}
function snapOf(){const g=S&&S.game;return S?(g?{log:g.log.length,bid:g.bid.amt,who:g.bid.who,turn:g.turn,gid:g.gid,idx:g.idx,phase:S.phase,sb:g.sb?Object.keys(g.sb).length:-1,grab:!!g.grab,rv:g.reveal?g.reveal.idx+':'+(g.reveal.win||'')+(g.reveal.retie||''):'',stage:g.stage,nomBy:g.nomBy,ev:g.ev?g.ev.n:0}:{phase:S.phase}):null}
/* transitions: a short title card between phases, and the sold card stays on screen for a moment with a stamp
   before the next card flips in, so screens never just jump */
const STAGES={mission:['🎯','抽任務卡','每人 3 張選 1 張'],auction:['🔨','競標開始','主題保密，喊價吧'],lineup:['📋','競標結束','排好陣容，準備開打'],results:['🏀','開打！','七戰四勝'],season:['🏁','季賽積分榜','']};
function stage(ph){const st=STAGES[ph];if(!st||NET.mode===null||window.BB_FAST)return;const el=document.getElementById('stagefx');if(!el)return;
  let sub=st[2];if(ph==='auction'&&S.game)sub=`${S.game.round?`季賽第 ${S.game.round} 局・`:''}共 ${S.game.items.length} 張牌・主題保密`;if(ph==='results'&&S.game&&S.game.sides.length===3)sub='三隊循環賽';
  el.innerHTML=`<div class="sfx"><div class="sic">${st[0]}</div><div class="stt">${st[1]}</div>${sub?`<div class="sst">${esc(sub)}</div>`:''}</div>`;
  el.classList.remove('on');void el.offsetWidth;el.classList.add('on');clearTimeout(ui.stageT);ui.stageT=setTimeout(()=>el.classList.remove('on'),1350);
  try{scrollTo({top:0,behavior:'smooth'})}catch(e){scrollTo(0,0)}}
function fx(prev){
  if(!prev||!S)return;if(prev.phase!==S.phase&&!lastView()){stage(S.phase);sfx('stage')}if(!S.game)return;const g=S.game,me=myRole(),mine=s=>s&&(me==='all'||me===s);
  if(prev.gid===g.gid&&S.phase==='auction'){
    if(g.reveal&&prev.rv!==g.reveal.idx+':'+(g.reveal.win||'')+(g.reveal.retie||'')&&!g.reveal.grab)sfx('reveal');
    else if(g.sb&&prev.sb>=0&&Object.keys(g.sb).length>prev.sb)sfx('tap');
    if(g.grab&&!prev.grab)sfx('grab');
    if(g.bid.amt>prev.bid&&!g.sb&&!g.grab&&g.price==null){if(mine(g.bid.who))sfx('bid');else if(prev.who&&mine(prev.who)&&me!=='all')sfx('outbid');else sfx('raise')}
    if(me!=='all'&&g.turn===me&&prev.turn!==me)sfx('turn');
    if(g.stage==='nom'&&prev.stage!=='nom'&&mine(g.nomBy)&&me!=='all')sfx('turn');
    if(g.ev&&g.ev.n!==prev.ev&&prev.gid===g.gid){sfx(g.ev.id==='coupon'?'coupon':'card');vibe(20)}}
  if(prev.gid===g.gid&&g.log.length>prev.log){const l=g.log[g.log.length-1];if(S.phase!=='auction'||window.BB_FAST)toast(l.who?`💰 ${nm(S,l.who)} $${l.amt}${l.full?`（💸 原價 $${l.full}）`:''}・${String(l.n).split(' ').slice(-1)[0]}${l.slot?`（${l.slot}）`:''}`:`🙅 ${l.n} 流標`);vibe(30);
    if(l.who){sfx('sold');if(l.full)sfx('coupon',0.25);if(mine(l.who)&&me!=='all')sfx('win',0.14)}else sfx('pass');
    if(S.phase==='auction'&&prev.idx!=null&&g.idx>prev.idx&&!window.BB_FAST){const hm=clamp((g.gapEnd||0)-now(),300,3800);ui.hold={gid:g.gid,k:prev.idx,l,at:Date.now(),until:Date.now()+hm};clearTimeout(ui.holdT);ui.holdT=setTimeout(()=>{ui.hold=null;render()},hm+10)}}
  else if(g.bid.amt>prev.bid)vibe(12);
}
setInterval(()=>{snapPrev=snapOf();tickAuth();tickBots()},250);
/* new-version check: browsers cache the page and a tab left open keeps the old copy, so look for a newer build when the
   app opens or comes back to the foreground (at most every 5 minutes) and offer a one-tap reload, never a forced one */
let NEWV=null,lastChk=0;
async function checkUpdate(){if(location.protocol!=='https:'||NEWV||Date.now()-lastChk<300000)return;lastChk=Date.now();
  try{const t=await (await fetch(location.pathname+'?v='+Date.now(),{cache:'no-store'})).text(),m=/APP[V]='([^']+)'/.exec(t);if(m&&m[1]!==APPV){NEWV=m[1];render()}}catch(e){}}
setTimeout(checkUpdate,3000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkUpdate()});

/* ---------- views ---------- */
let ui={quit:false,sel:null,themeOpen:false,reveal:new Set(),amt:{},pb:null,pbDone:new Set(),pbSp:null};
let tt;function toast(msg,ms=1900){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),ms)}
const fmt=v=>v==null?'–':(Math.round(v*10)/10).toFixed(1);
const yrs=p=>{if(!p.y0)return '';const s=y=>String(y%100).padStart(2,'0');return p.y0===p.y1?`${p.y0-1}-${s(p.y0)}`:`${p.y0-1}–${s(p.y1)}`};
const sub=p=>p.nostat?'查無資料・以替補水準計算':[p.tm,yrs(p)].filter(Boolean).join(' · ');
const myRole=()=>S?roleOf(S,CID):'spec';
const col=s=>`var(--${{A:'a',B:'b',C:'c3'}[s]})`;
const pend=()=>NET.mode==='guest'&&NET.pending.length?'<span class="spin" style="margin-left:6px"></span>':'';
function render(){
  const app=document.getElementById('app');let html;
  if(!THEMES.length)html=`<div class="center mut" style="margin-top:80px"><span class="spin"></span> 載入球員資料…</div>`;
  else if(!S||!NET.mode)html=`<div id="scr-home" class="screen">${vHome()}</div>`;
  else if(lastView())html=vRoomBar()+withView(()=>`<div id="scr-results${S.game.gid}" class="screen ${ui.pbFast?'fastrs':''}">${vResults()}</div>`);
  else html=vRoomBar()+`<div id="scr-${S.phase}${S.game?S.game.gid:''}" class="screen ${S.phase==='results'&&ui.pbFast?'fastrs':''}">${({lobby:vLobby,cards:vCards,mission:vMission,auction:vAuction,lineup:vLineup,results:vResults,season:vSeason}[S.phase]||vLobby)()}</div>`+(S.phase==='auction'&&S.game?cardFlash(S.game)+cardSheet():'');
  if(NEWV)html=`<button class="updb" data-act="reload">有新版本，點這裡更新${S&&S.phase==='auction'?'（這局打完再按也可以）':''}</button>`+html;
  const next=document.createElement('div');next.id='app';next.className='wrap';next.innerHTML=html;
  if(window.morphdom)morphdom(app,next,{onBeforeElUpdated:(f,t)=>{if(f===document.activeElement&&(f.tagName==='INPUT'||f.tagName==='TEXTAREA'))return false;if(f.isEqualNode&&f.isEqualNode(t))return false;if(f.dataset&&f.dataset.counting)return false;return true}});
  else app.innerHTML=html;
  runCounters();updateClocks();
}
const tickSeen={};
function updateClocks(){document.querySelectorAll('[data-end]').forEach(el=>{const end=+el.dataset.end,tot=+el.dataset.tot,r=Math.max(0,end-now());
  if(el.dataset.tick&&r>0&&r<=3200){const sec=Math.ceil(r/1000);if(tickSeen[end]!==sec){tickSeen[end]=sec;sfx(sec<=1?'last':'tick')}}
  const t=el.querySelector('.tx');if(t)t.textContent=(r/1000).toFixed(r<10000?1:0);const b=el.querySelector('i');if(b)b.style.width=(100*r/tot)+'%'})}
setInterval(updateClocks,200);
const counted=new Set();
function runCounters(){document.querySelectorAll('[data-count]').forEach(el=>{
  if(counted.has(el.id))return;counted.add(el.id);const to=+el.dataset.count,delay=+(el.dataset.delay||0)*1000,dur=900;el.dataset.counting='1';el.textContent='0';
  setTimeout(()=>{const t0=performance.now();const step=t=>{const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=Math.round(to*e);if(k<1)requestAnimationFrame(step);else delete el.dataset.counting};requestAnimationFrame(step)},delay)})}
function vHome(){
  const hm=/^#room-([a-z0-9]{6})(?:-(\d))?$/.exec(location.hash||''),inv=hm&&hm[1],last=(lsGet('bb_room')||'').split('-')[0];
  return `<header class="hero"><div class="logo">🏀</div><h1>BALLER<br><b>BID!</b></h1><div class="sub">球星喊價</div>
  <p>用有限預算標下 NBA 球星，最後用真實數據模擬對戰。2～3 人一起玩，也能一個人挑戰電腦。</p></header>
  ${inv?`<section class="card invite" style="border-color:var(--acc)"><div class="small mut">你被邀請加入房間</div><div class="code">${esc(inv.toUpperCase())}</div>
    <input data-in="myname" maxlength="14" placeholder="輸入你的名字" value="${esc(MYNAME)}" style="margin-top:12px;text-align:center">
    <button class="big" data-act="joinhash" ${NET.busy?'disabled':''}>${NET.busy?'<span class="spin"></span> 連線中…':'加入房間 →'}</button></section>`
  :`<section class="card"><h2>你的名字</h2><input data-in="myname" maxlength="14" placeholder="例如：Jerry" value="${esc(MYNAME)}"></section>`}
  ${NET.err?`<div class="err">${esc(NET.err)}</div>`:''}
  <button class="mode hot" data-act="create" ${NET.busy?'disabled':''}><span class="ic">🌐</span><span><b>線上對戰</b><span>產生邀請連結，朋友點開就能加入，不用登入</span></span></button>
  <button class="mode" data-act="ai"><span class="ic">🤖</span><span><b>挑戰電腦</b><span>一個人玩：跟 1～2 位 AI 總管搶球星</span></span></button>
  <button class="mode" data-act="local"><span class="ic">📱</span><span><b>同一台手機玩</b><span>大家輪流用一支手機出價</span></span></button>
  ${inv?'':`<section class="card"><h2>用房號加入</h2>
    <div class="row"><input data-in="code" maxlength="6" placeholder="6 位房號" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800" value="${esc(last||'')}">
    <button class="chip on" data-act="join" ${NET.busy?'disabled':''} style="flex:none">${NET.busy?'<span class="spin"></span>':'加入'}</button></div>
    <div class="small mut" style="margin-top:6px">重新整理或斷線後，用同一個房號就能回到房間。</div></section>`}
  ${rulesCard()}`;
}
function rulesCard(){return `<section class="card rules"><details><summary>📖 玩法 & 對戰怎麼算</summary>
  <h3>玩法</h3><ol>
  <li><b>輪流出價</b>：兩人時每張牌輪流先喊，三人時蛇形（A→B→C，下一輪 C→B→A）。輪到你就輸入金額，或按「不要」。</li>
  <li><b>時間</b>：沒人出價 20 秒、有人出價後 15 秒內沒動作，就算「不要」。其他人都不要，最高價得標。</li>
  <li><b>牌堆</b>：明星比較容易出現在牌堆裡。大家都不要的牌直接流標，並從保留池補一張明星，一局最多補 3 張。牌用完還缺人，就補「自由球員」（$0）。</li>
  <li><b>預算</b>：每個空位至少留 $1。沒花完的錢每 $1 加 0.3 實力，最多加 2.5。</li>
  <li><b>排陣</b>：90 秒（10 人 120 秒），拖曳或點兩位球員互換。</li>
  <li><b>對戰</b>：每兩隊打七戰四勝，系列賽贏最多的奪冠。</li>
  <li><b>卡片版本</b>：每張卡是球員某一段時期的版本，比賽用的是那段時期的數據；卡面的生涯數據和榮譽是整個生涯。卡上的標籤告訴你是哪一段：新秀年、生涯早期、巔峰期（他最強的五季）、生涯晚期，年份（例如 '92）可在進階設定關掉。</li>
  <li><b>挑戰電腦</b>：一個人跟 1～2 位 AI 總管對戰。電腦依自己陣容缺什麼、剩多少錢、場上還有哪些球員來估價，只能用跟你一樣的按鈕，看不到你的任務卡和暗標金額。新手常亂出價；普通會看陣容缺什麼；高手還會做任務、精算暗標。</li>
  <li><b>拍賣方式</b>（大廳選）：🔨 一般喊價；🤫 暗標（同時偷偷出價，最高價得標，平手加賽一次，再平手空位多的一方得標，加賽時畫面會先告訴你）；⚡ 降價搶標（標價從高往下掉，第一個按的人用當下價格買走，0.6 秒內同時按下就抽籤；降到 $1 還沒人要就流標）。季賽可選「每局輪換」。</li>
  <li><b>輪流提名</b>（選用）：桌上翻開 4 張，輪到的人挑一張拿出來拍，提名的人先出價。</li>
  <li><b>替補</b>（10 人）：5 個替補自己分配「替補後衛／替補鋒線／第六人」，至少各 1 位、第六人只能 1 位。換人時由對應角色上場，第六人上場最多；放錯角色會扣分，沒有能補的角色也會扣分。</li>
  <li><b>最後一隊</b>：其他人都滿了時，剩下那隊不用再競標：牌堆裡剩下的牌全部翻開，每位 $1，自己挑要哪幾位（不會再補新牌）。也可以都不要，讓自由球員補。</li>
  <li><b>🃏 能力卡</b>（選用）：開局 4 選 2，帶哪幾張是秘密，每張用一次，用的時候大家都看得到。🔄 換一張：還沒人出價的牌移到牌堆最後；💸 打折券：下一次得標 $4 以上打 85 折；🏟️ 主場優勢：對戰戰力 +1；🕵️ 球探報告：偷看接下來 3 張和一位對手的任務。</li>
  <li><b>🎯 任務卡</b>（選用）：開局每人 3 張選 1 張，任務保密，結算才揭曉。開打時達成就加戰力（卡片上寫多少就加多少）。會讓陣容變弱的任務（例如不靠 MVP）獎勵比較高。難度和獎勵依這次牌堆計算，牌堆不適合的任務不會發。</li>
  <li><b>🏁 季賽</b>（選用）：連打 3／5／7 局，冠軍 3 分、${'三人第二名 1 分、兩人輸家打滿七場 1 分'}，任務 +1（★★★ +2）。同分比冠軍數、系列賽勝負、淨勝分。可開平衡機制：上局冠軍預算 −10%、墊底 +10%。</li></ol>
  <h3>對戰怎麼算</h3><ul>
  <li><b>傳奇組合</b>：湊齊三巨頭或王朝核心（公牛、Showtime、熱火、勇士、GDP…）另外加 0.8–2 戰力。</li>
  <li><b>爆發之夜</b>：角色球員偶爾會打出生涯代表作，那場多拿好幾分。</li>
  <li><b>球星接管</b>：卡上標「爆發型」的球星（MVP、FMVP、兩屆以上年度一隊或 8 次以上全明星），每場約 5–7% 機會接管比賽，那場球隊多約 4 分。巔峰期機率最高。電腦出價只看一般數據，不算這個。</li>
  <li><b>看牌時間</b>：每張卡翻開先停幾秒（大廳可調），倒數完才能出價，電腦也得等。</li>
  <li><b>實力</b>：先發五人的 BPM 加總（以當年聯盟平均為基準），用 1,230 支真實球隊校正過。</li>
  <li><b>位置</b>：放到不熟的位置會打折。同位置一對一：小個子有速度，大個子有籃板和低位；空間型長人能拉開，但籃板吃虧。</li>
  <li><b>化學</b>：真實當過隊友加分、五人都能換防加分、有紀錄的隊內不合扣分。</li>
  <li><b>夢幻隊模式（10 人）</b>：替補約是先發 1/4 的影響力。火爆浪子可能吃兩次 T 被驅逐，犯規麻煩的人可能犯滿，都由最強的替補頂上。</li>
  <li><b>版本</b>：${APPV}</li>
  <li><b>數據</b>：Basketball-Reference。1974 年前部分數據是推估，卡片上標「估」。</li></ul></details></section>`}
function vRoomBar(){
  if(NET.mode==='ai')return `<div class="roombar"><span>🤖 挑戰電腦・${esc(botLv().nm)}</span><span class="grow"></span>${sfxBtn()}<button class="small mut" data-act="exit">離開</button></div>`;
  if(NET.mode==='local')return `<div class="roombar"><span>📱 同一台手機</span><span class="grow"></span>${sfxBtn()}<button class="small mut" data-act="exit">離開</button></div>`;
  const r=myRole(),label=ALL.includes(r)?nm(S,r):'觀眾';
  return `<div class="roombar"><span class="mut">房號</span><span class="code">${esc((NET.code||'').toUpperCase())}</span><span class="grow small">你是 <b>${esc(label)}</b>${pend()}</span>${sfxBtn()}<button class="small mut" data-act="exit">離開</button></div>${ui.verWarn?'<div class="err">⚠️ 你和房間裡其他人的遊戲版本不同，可能會出錯。請大家都重新整理網頁後再開房。</div>':''}
  ${NET.conn===false?`<div class="err"><span class="spin"></span> 網路斷線，重新連線中…</div>`:''}${NET.err?`<div class="err">${esc(NET.err)}</div>`:''}
  ${NET.mode==='host'&&S.phase!=='results'?`<div class="note" style="margin-top:8px">📌 遊戲由你的手機運算，請保持畫面開著。如果你斷線，其他玩家會在 15 秒後自動接手。</div>`:''}`;
}
function seatRow(k){
  const s=S.seats[k],me=s&&s.cid===CID,on=s&&(s.cid===CID||onlineSet().has(s.cid));
  const btn=!s?`<button data-act="seat" data-v="${k}">坐這裡</button>`:me?`<button data-act="seat" data-v="spec" style="background:#fff;color:var(--mut);border:1.5px solid var(--line)">離座</button>`:'';
  const watching=s&&S.last&&!(S.back&&S.back[s.cid])&&!me;
  return `<div class="seat ${k} ${me?'me':''}"><span class="lab">玩家 ${k}</span><span class="who">${s?`<span class="dot ${watching&&on?'pulse':''}" style="background:${!on?'#bbb':watching?'var(--acc)':'var(--ok)'}"></span> ${esc(s.name)}${me?'（你）':''}${watching&&on?' <span class="small" style="color:#d9730d">結算畫面中</span>':!on?' <span class="small mut">離線</span>':''}`:'<span class="mut">空位</span>'}</span>${btn}</div>`}
function vLobby(){
  const c=S.cfg,r=myRole(),isP=r==='all'||ALL.includes(r),sides=sidesOf(c.players),dis0=S.season?'disabled':'';let top='';
  if(NET.mode==='ai')top=aiLobby(sides,dis0);
  else if(NET.mode==='local')top=`<section class="card"><h2>玩家</h2>${sides.map(s=>`<div class="row" style="margin-bottom:8px"><span class="dot" style="background:${col(s)}"></span><input data-in="name" data-i="${s}" maxlength="12" value="${esc(S.names[s])}"></div>`).join('')}</section>`;
  else top=`<section class="card invite"><div class="small mut">房號</div><div class="code">${esc(NET.code.toUpperCase())}</div>
      <button class="big" data-act="share">📨 傳送邀請連結</button><div class="small mut" style="margin-top:8px;word-break:break-all">${esc(inviteLink())}</div>
      <div class="small mut" style="margin-top:6px">🔒 對戰內容有加密，只有拿到房號的人看得到。</div></section>
    <section class="card"><h2>座位</h2><div class="seats">${sides.map(seatRow).join('')}</div></section>`;
  const dis=!isP?'disabled':'';
  const mode=c.theme==='random'?'random':c.theme==='custom'?'custom':'pick';
  let themeBox=`<div class="seg mode">${[['random','🎲 隨機'],['pick','📌 指定'],['custom','✏️ 自訂']].map(([k,l])=>`<button class="chip ${mode===k?'on':''}" data-act="tmode" data-v="${k}" ${dis}>${l}</button>`).join('')}</div>`;
  if(mode==='random'){
    const pool=randPool(c),era=c.era||[0,0],teams=c.teams||[],need=c.players*(c.size||5);
    const decOpt=(sel,first)=>`<option value="">${first}</option>`+DECS.map(d=>`<option value="${d}" ${sel===d?'selected':''}>${d} 年代</option>`).join('');
    const rows=CATS.map(k=>{const on=c.cats.includes(k),n=catPool(c,k).length;
      const why=n?'':catCands(c,k).length?`合併後也不到 ${need} 人`:'這個年代沒有';
      return `<button class="crow ${on?'on':''} ${on&&!n?'zero':''}" data-act="cat" data-v="${k}" ${dis}><span class="ck">${on?'✓':''}</span><span class="grow"><b>${CATNAME[k]}</b><small>${CATDESC[k]}</small></span><span class="cn">${n?(on?`${n} 個`:`<small>${n} 個</small>`):`<small>0 個${on?'<br>'+why:''}</small>`}</span></button>`}).join('');
    const nc=c.cats.length;
    themeBox+=`<div class="small mut" style="margin:12px 0 6px">點卡片勾選類別（可複選）。開始時從勾選的類別裡抽一個主題，大家都不知道是哪個。${(c.size||5)===10||c.players===3?'人數不夠的主題，抽到時會自動合併同隊或相近年份的主題。':''}</div><div class="crows">${rows}</div>
      <div class="frow"><span class="fl">年代</span><div class="sel2"><select data-in="era0" ${dis}>${decOpt(c.era?era[0]:null,'不限')}</select><span class="mut">到</span><select data-in="era1" ${dis}>${decOpt(c.era?era[1]:null,'不限')}</select></div></div>
      <div class="small mut fh">選填。只影響有年代的類別，「特別」不受影響。</div>
      <div class="rtot ${pool.length?'':'bad'}">${pool.length?`🎲 共 ${pool.length} 個主題，開始時抽一個`:!nc?'還沒勾選類別：點上面的卡片勾選':'勾選的類別在這個年代沒有主題，請放寬年代或多勾幾類'}</div>
      <div class="small mut" style="margin-top:8px;text-align:center">想指定球隊或某幾屆？用上面的「📌 指定」，也可以設定成保密抽一個。</div>`;
  }else if(mode==='pick'){
    const cat=c.pcat||'夢幻隊',picks=c.picks||[],list=THEMES.filter(t=>t.cat===cat),pp=pickPool(picks),need=c.players*(c.size||5);
    const opt=t=>`<option value="${t.id}" ${picks.includes(t.id)?'disabled':''}>${esc(t.name)}${picks.includes(t.id)?'（已選）':''}</option>`;
    let ctl;
    if(cat==='夢幻隊')ctl=`<div class="seg ychips">${list.filter(t=>t.id!=='usaall').map(t=>{const on=picks.includes(t.id);return `<button class="chip ${on?'on':''}" data-act="ptog" data-v="${t.id}" ${dis}>${esc(t.name.replace(/（.*）/,''))}</button>`}).join('')}
      <button class="chip" data-act="pall" ${dis}>全選</button></div>`;
    else{let opts;
      if(cat==='隊史'){const by={};list.forEach(t=>{const k=t.fr||'';(by[k]=by[k]||[]).push(t)});
        opts=Object.keys(FRZH).filter(k=>by[k]).map(k=>`<optgroup label="${FRZH[k]}">${by[k].sort((x,y)=>(/\d{4}$/.test(x.id)?1:0)-(/\d{4}$/.test(y.id)?1:0)||x.y0-y.y0).map(opt).join('')}</optgroup>`).join('')}
      else if(cat==='陣容')opts=list.filter(t=>t.grp).map(t=>`<option value="${t.id}" ${picks.includes(t.id)?'disabled':''}>${esc(t.name)}（${t.tag.match(/^\d+/)[0]} 隊・${t.items.length} 人）${picks.includes(t.id)?'（已選）':''}</option>`).join('');
      else opts=list.map(opt).join('');
      ctl=`<select data-in="ptheme" ${dis}><option value="">＋ 加入${cat==='陣容'?'年代':'主題'}…</option>${opts}</select>`}
    const chosen=pp.ts.length?`<div class="picked">${pp.ts.map(t=>`<span class="pk">${esc(t.name)}<button data-act="pdel" data-v="${t.id}" ${dis} aria-label="移除">×</button></span>`).join('')}</div>${pp.ts.filter(t=>t.grp).map(t=>`<div class="small mut" style="margin-top:6px">${esc(t.name)}：${esc(t.tag.split('：')[1].split('・')[0])}</div>`).join('')}`:'';
    const one=c.pmode==='one',okOne=pp.ts.filter(t=>themeOk(t,c)),enough=one?okOne.length>0:pp.items.length>=need;
    const modeSel=pp.ts.length>1?`<div class="seg pmode" style="margin-top:10px">${[['merge','合併成一個卡池'],['one','🎲 保密抽其中一個']].map(([k,l])=>`<button class="chip ${(one?'one':'merge')===k?'on':''}" data-act="cfg" data-k="pmode" data-v="${k}" ${dis}>${l}</button>`).join('')}</div>`:'';
    themeBox+=`<div class="frow"><span class="fl">類別</span><select data-in="pcat" ${dis}>${CATS.map(k=>`<option value="${k}" ${k===cat?'selected':''}>${CATNAME[k]}</option>`).join('')}</select></div>
      <div style="margin-top:10px">${ctl}</div>${chosen}${modeSel}
      <div class="small ${pp.ts.length&&!enough?'errt':'mut'}" style="margin-top:8px">${!pp.ts.length?'可以選一個，也可以跨類別選好幾個（例如 2010 年代老鷹＋2010 年代塞爾提克）。':
        one&&pp.ts.length>1?`開始時從 ${okOne.length} 個主題裡抽一個${okOne.length<pp.ts.length?`（${pp.ts.length-okOne.length} 個不到 ${need} 人，不會被抽到）`:''}`+(enough?' ✓':`<br>⚠️ 選的主題都不到 ${need} 人，請改用合併或多選幾個`):
        `卡池 ${pp.items.length} 人${pp.ts.length>1?'（重複的球員只留數據最好的那個版本）':''}・${c.players} 人${c.size===10?'夢幻隊模式':''}需要 ${need} 人`+(enough?' ✓':`<br>⚠️ 卡池太少人，請多選幾個${cat==='夢幻隊'?'年份':'主題'}才能玩`)}</div>
      <div class="small" style="margin-top:6px;color:#b26a00">${one&&pp.ts.length>1?'🤫 大家知道候選名單，但不知道抽到哪一個':'⚠️ 所有人都會知道主題'}</div>`;
  }else themeBox+=`<div class="small mut" style="margin-top:10px">自己打名單，抓每個人的生涯巔峰 5 季數據。</div>`;
  if(c.theme==='custom'){const pc=parseCustom(c.custom.text);themeBox+=`<div style="margin-top:12px"><input data-in="cname" placeholder="主題名稱" value="${esc(c.custom.name)}" ${dis}>
    <textarea data-in="ctext" style="margin-top:8px" placeholder="一行一位，可加位置：&#10;Stephen Curry, PG&#10;Klay Thompson&#10;Dennis Rodman, PF" ${dis}>${esc(c.custom.text)}</textarea>
    <div class="small mut" style="margin-top:6px">已辨識 ${pc.filter(x=>!x.nostat).length} / ${pc.length} 位・至少 ${c.players*5} 位</div></div>`}
  const L=poolLenFor(c);
  const play=`<section class="card"><h2>玩法</h2><div class="otiles">
      <button class="otile ${c.mis?'on':''}" data-act="cfg" data-k="mis" data-v="${c.mis?0:1}" ${dis}><span class="oic">🎯</span><b>任務卡</b><small>每局 3 選 1，完成就加戰力</small><span class="osw"></span></button>
      <button class="otile ${c.cards?'on':''}" data-act="cfg" data-k="cards" data-v="${c.cards?0:1}" ${dis}><span class="oic">🃏</span><b>能力卡</b><small>每局 4 選 2，換牌、打折、主場、球探</small><span class="osw"></span></button>
      <button class="otile ${c.season?'on':''}" data-act="cfg" data-k="season" data-v="${c.season?0:5}" ${dis}><span class="oic">🏁</span><b>季賽</b><small>同一群人連打多局拼積分</small><span class="osw"></span></button></div>
      ${c.season?`<div class="frow" style="margin-top:12px"><span class="fl">局數</span><div class="seg">${SEASON_N.map(n=>`<button class="chip ${c.season===n?'on':''}" data-act="cfg" data-k="season" data-v="${n}" ${dis}>${n} 局</button>`).join('')}</div></div>
      <button class="crow ${c.bal!==false?'on':''}" style="margin-top:10px" data-act="cfg" data-k="bal" data-v="${c.bal!==false?0:1}" ${dis}><span class="ck">${c.bal!==false?'✓':''}</span><span class="grow"><b>平衡機制</b><small>上局冠軍下一局預算 −10%，積分墊底 +10%</small></span></button>
      <div class="small mut" style="margin-top:8px">積分：冠軍 3 分${c.players===3?'、第二名 1 分':'、輸家打滿七場拿 1 分'}${c.mis?'、完成任務 +1（★★★ +2）':''}。每局換新主題${c.theme==='random'||c.pmode==='one'?'，同一季不重複':''}。</div>`:''}
      ${c.mis&&!c.season?'<div class="small mut" style="margin-top:8px">任務保密，只有自己看得到，結算時才揭曉。</div>':''}${fmtLobby(c,dis)}</section>`;
  const cfg=play+`<section class="card"><h2>${NET.mode==='ai'?'對手':'人數'}</h2><div class="seg">${[2,3].map(n=>`<button class="chip ${c.players===n?'on':''}" data-act="cfg" data-k="players" data-v="${n}" ${dis}>${NET.mode==='ai'?`${n-1} 位電腦`:`${n} 人`}</button>`).join('')}</div></section>
    <section class="card"><h2>陣容</h2><div class="seg">${[[5,'正規 5 人'],[10,'夢幻隊模式 10 人']].map(([n,l])=>`<button class="chip ${(c.size||5)===n?'on':''}" data-act="cfg" data-k="size" data-v="${n}" ${dis}>${l}</button>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">${(c.size||5)===10?`5 先發＋5 替補，每人要標 10 位，卡池至少要 ${c.players*10} 人。建議預算 $${c.players===3?30:25} 以上。`:'5 位先發，標滿就開打。'}</div></section>
    <section class="card"><h2>每人預算</h2><div class="row wrapx">${[10,15,20,25].map(b=>`<button class="chip ${c.budget===b?'on':''}" data-act="cfg" data-k="budget" data-v="${b}" ${dis}>$${b}</button>`).join('')}
      <input data-in="budget" type="number" min="5" max="999" inputmode="numeric" style="width:90px" placeholder="自訂" value="${[10,15,20,25].includes(c.budget)?'':c.budget}" ${dis}></div></section>
    <section class="card"><h2>主題</h2>${themeBox}</section>
    ${L?`<section class="card"><h2>翻牌數量</h2><div class="row"><div class="stepper"><button data-act="cfg" data-k="draw" data-v="${c.draw-1}" ${dis}>−</button><div class="v">${c.draw}</div><button data-act="cfg" data-k="draw" data-v="${c.draw+1}" ${dis}>+</button></div><div class="small mut grow">張（主題共 ${L} 位）<br>每個位置保證至少 ${c.players*(c.size||5)/5} 位能打的人</div></div></section>`:''}
    <section class="card"><h2>看牌時間</h2><div class="row wrapx">${READ_OPTS.map(x=>`<button class="chip ${(c.read==null?5:c.read)===x?'on':''}" data-act="cfg" data-k="read" data-v="${x}" ${dis}>${x?x+' 秒':'不停'}</button>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">每張卡翻開後先停幾秒讓大家看清楚，倒數完才能出價（電腦也一樣要等）。大家都按「看好了」就提早開始。</div></section>
    <section class="card"><h2>進階</h2><div class="seg">
      <button class="chip ${c.showStats?'on':''}" data-act="cfg" data-k="showStats" data-v="${c.showStats?0:1}" ${dis}>${c.showStats?'✓ ':''}競標時顯示數據</button>
      <button class="chip ${c.hints?'on':''}" data-act="cfg" data-k="hints" data-v="${c.hints?0:1}" ${dis}>${c.hints?'✓ ':''}競標時提示隊友／不合</button>
      <button class="chip ${c.showYr!==false?'on':''}" data-act="cfg" data-k="showYr" data-v="${c.showYr!==false?0:1}" ${dis}>${c.showYr!==false?'✓ ':''}卡片顯示球季年份</button></div>
      <div class="small mut" style="margin-top:6px">前兩個會透露主題的球隊和年代，預設關閉。年份只透露年代，預設開啟；想更神秘可以關掉。每張卡都會標巔峰期／生涯早期／生涯晚期。</div></section>
    ${S.err?`<div class="err">${esc(S.err)}</div>`:''}
    ${isP?(waitingFor().length?`<button class="big" disabled>等 ${esc(waitingFor().join('、'))} 看完結算…</button>`:`<button class="big" data-act="start">${c.season?`開始季賽（${c.season} 局）→`:'開始競標 →'}</button>`):`<div class="note">觀眾無法變更設定。</div>`}`;
  const sc=Object.values(S.scores||{}).sort((a,b)=>b.w-a.w);
  const scores=sc.length?`<section class="card"><div class="row"><h2 class="grow" style="margin:0">🏆 戰績</h2>${isP?'<button class="small mut" data-act="resetScores">清除</button>':''}</div><div style="margin-top:8px">${sc.map(o=>`<div class="score"><span>${esc(o.n)}</span><b class="num" style="font-size:20px">${o.w} 冠${o.st?`<small style="font-size:13px;margin-left:6px;color:var(--gold)">🏁 ${o.st} 季冠</small>`:''}</b></div>`).join('')}</div></section>`:'';
  return top+lastSeasonCard()+cfg+scores+rulesCard();
}
/* ---------- short player intro (from Basketball-Reference awards & career totals) ---------- */
const TEAMZH={ATL:'老鷹',STL:'老鷹',MLH:'老鷹',TRI:'老鷹',BOS:'塞爾提克',BRK:'籃網',NJN:'籃網',NYN:'籃網',CHA:'黃蜂',CHO:'黃蜂',CHH:'黃蜂',CHI:'公牛',CLE:'騎士',DAL:'獨行俠',DEN:'金塊',DNN:'金塊',DET:'活塞',FTW:'活塞',GSW:'勇士',SFW:'勇士',PHW:'勇士',HOU:'火箭',SDR:'火箭',IND:'溜馬',LAC:'快艇',SDC:'快艇',BUF:'快艇',LAL:'湖人',MNL:'湖人',MEM:'灰熊',VAN:'灰熊',MIA:'熱火',MIL:'公鹿',MIN:'灰狼',NOP:'鵜鶘',NOH:'黃蜂',NOK:'黃蜂',NYK:'尼克',OKC:'雷霆',SEA:'超音速',ORL:'魔術',PHI:'76人',SYR:'國民',PHO:'太陽',POR:'拓荒者',SAC:'國王',KCK:'國王',KCO:'國王',CIN:'皇家',ROC:'皇家',SAS:'馬刺',SAA:'馬刺',TOR:'暴龍',UTA:'爵士',NOJ:'爵士',WAS:'巫師',WSB:'子彈',CAP:'子彈',BAL:'子彈',CHZ:'包裝工',CHP:'包裝工'};
function bioOf(p){if(!p.id||!BIOS||!own(BIOS.p,p.id))return null;const o={};BIOS.cols.forEach((c,i)=>o[c]=BIOS.p[p.id][i]);return o}
function roleTags(p){const t=[];if(num(p.pts,0)>=25)t.push('得分機器');if(num(p.astp,0)>=30)t.push('組織大師');else if(num(p.astp,0)>=22)t.push('傳球好手');
  if(num(p.trbp,0)>=17)t.push('籃板怪');if(num(p.blkp,0)>=4)t.push('護框長人');if(num(p.stlp,0)>=2.6)t.push('抄截高手');if(peOf(p)>=3.8&&spc(p)>=0.6)t.push('空間型長人');if(num(p.usg,20)<17&&num(p.dbpm,0)>=1.5)t.push('防守悍將');return t.slice(0,2)}
/* Taiwan fan nicknames: Jerry's list (PTT / 巴哈 / 痞客邦 sources), first nickname per player */
const NICK={gilgesh01:"SGA",loveke01:"愛神",abdulka01:"天勾",adamsst01:"水行俠",adebaba01:"阿爹",allenra02:"糖",anderky01:"慢速先生",antetgi01:"字母哥",anthoca01:"甜瓜",arenagi01:"Agent 0",artesro01:"世界和平",barklch01:"惡漢",birdla01:"大鳥",boguemu01:"強盜",bookede01:"書人",bradlsh01:"竹竿",bryanko01:"黑曼巴",butleji01:"士官長",capelca01:"餅皇",cartevi01:"加拿大航空",cassesa01:"外星人",chambwi01:"籃球皇帝",curryse01:"咖哩弟",curryst01:"我家咖喱・浪花兄弟",davisan02:"濃眉",derozde01:"DDR",doncilu01:"東 77",drexlcl01:"滑翔機",duncati01:"石佛",duranke01:"死神",edwaran01:"蟻人",embiijo01:"大帝",ervinju01:"J博士",ewingpa01:"Gorilla",fishede01:"小魚",francst01:"老大",garneke01:"狼王",gasolpa01:"西班牙兔子",georgpa01:"PG-13",gervige01:"冰人",ginobma01:"妖刀",greenac01:"鐵人",greendr01:"追夢",hamilri01:"面具人",hardaan01:"便士",hardati01:"甲蟲",hardeja01:"大鬍子",havlijo01:"小偷",haywago01:"星海哥",hillgr01:"好孩子",horryro01:"關鍵先生",howardw01:"魔獸",ilgauzy01:"大Z",irvinky01:"德魯大叔",iversal01:"答案",jamesle01:"小皇帝",johnsla02:"大媽",johnsma02:"魔術師",jokicni01:"小丑",jordami01:"飛人",kempsh01:"雨人",kiddja01:"發動機",kirilan01:"AK-47",kuminjo01:"苦命",leonaka01:"可愛",linje01:"豪神",majerda01:"震雷",malonka01:"郵差",malonmo01:"孤獨的勇士",maravpe01:"手槍",marbust01:"獨狼",mariosh01:"駭客任務",mcgratr01:"T-Mac",millere01:"終結者",mingya01:"小巨人",moblecu01:"老貓",mournal01:"大佐",mullich01:"上帝左手",murraja01:"屁孩",mutomdi01:"非洲大山",nashst01:"助推器",nowitdi01:"德國坦克",nurkiju01:"巨獸",oaklech01:"老橡樹",olajuha01:"大夢",onealsh01:"大鯊魚",parisro01:"酋長",parketo01:"法國跑車",paulch01:"CP3",paytoga01:"手套",piercpa01:"真理",pippesc01:"皮蓬",porzikr01:"KP",princta01:"王子",randoza01:"Z-Bo",robinda01:"海軍上將",rodmade01:"小蟲",rosede01:"飆風玫瑰",russebi01:"指環王",sampsra01:"超級彈簧腿",schrode01:"8400萬",scolalu01:"大鑽石",siakapa01:"洗牙啃",sprewla01:"狂人",stockjo01:"將軍",stoudam01:"小霸王",stoudda01:"小飛鼠",terryja01:"噴射機",thomais01:"微笑刺客",thompkl01:"浪花兄弟",vanexni01:"小精靈",wadedw01:"閃電俠",wallabe01:"大本鐘",wallara01:"怒吼天尊",waltobi01:"紅色巨人",webbech01:"國王",wembavi01:"斑馬",westbru01:"威少",westje01:"教父",wiggian01:"圍巾",wilkido01:"人類電影精華",willija02:"白巧克力",willizi01:"胖虎",worthja01:"眼鏡蛇"};
const nickOf=p=>p&&own(NICK,p.id)?NICK[p.id]:'';
function introBlock(p,key){const b=bioOf(p),tags=roleTags(p),ch=[],sk=[];
  if(b){if(b.hof)ch.push('🏛 名人堂');if(b.ring)ch.push(`🏆 總冠軍 ×${b.ring}`);if(b.fmvp)ch.push(`🏅 FMVP ×${b.fmvp}`);if(b.mvp)ch.push(`👑 MVP ×${b.mvp}`);if(b.dpoy)ch.push(`🛡 最佳防守 ×${b.dpoy}`);if(b.all1)ch.push(`年度第一隊 ×${b.all1}`);else if(b.alln)ch.push(`年度最佳陣容 ×${b.alln}`);
    if(b.as)ch.push(`全明星 ×${b.as}`);if(b.roy)ch.push('新人王');if(b.ad1)ch.push(`防守一隊 ×${b.ad1}`);if(b.ad2)ch.push(`防守二隊 ×${b.ad2}`);
    if(b.ar1&&!b.roy&&ch.length<4)ch.push('新秀一隊');if(!ch.length)ch.push('角色球員');
    const f=String(b.sk||'');if(f.includes('3'))sk.push('三分射手');if(f.includes('m'))sk.push('中投機器');if(f.includes('r'))sk.push('禁區殺手')}
  if(S&&S.game&&S.game.size===10){if(foulProne(p))sk.unshift('犯規麻煩');if(isHot(p))sk.unshift('火爆浪子')}
  const sg=sigOf(p);
  tags.forEach(t=>{if(!sk.includes(t))sk.push(t)});
  const chips=ch.slice(0,6).map(x=>`<span>${esc(x)}</span>`).concat(sk.slice(0,3).map(x=>`<span class="sk">${esc(x)}</span>`));
  const rev=ui.reveal.has(key);
  const line=b&&b.pts!=null?`生涯 ${b.g} 場・場均 ${fmt(b.pts)} 分 ${fmt(b.trb)} 籃板 ${fmt(b.ast)} 助攻`:'';
  const era=b?`${b.from-1}–${String(b.to%100).padStart(2,'0')} 年・主要效力${own(TEAMZH,b.tm)?TEAMZH[b.tm]:b.tm}${b.dy?`・${b.dy} 年選秀第 ${b.dp} 順位`:'・落選秀'}`:'';
  const hon=ch.slice(0,8).map(x=>`<span>${esc(x)}</span>`).join(''),sty=(sg?`<span class="sig">⭐ ${esc(sg.lab)}</span>`:'')+(TOMA.has(p.id)?`<span class="sig">🪓 戰斧暴扣</span>`:'')+sk.slice(0,3).map(x=>`<span class="sk">${esc(x)}</span>`).join('');
  return `<div class="intro2"><div class="irow"><i class="il">榮譽</i><div class="intro">${hon}</div></div>${sty?`<div class="irow"><i class="il">球風</i><div class="intro">${sty}</div></div>`:''}</div>${line?`<div class="small mut" style="margin-top:6px">${line}</div>`:''}
    ${b?(rev?`<div class="small" style="margin-top:4px">${esc(era)}</div>`:`<button class="link" data-act="reveal" data-v="${key}">看年代和球隊（會透露主題）</button>`):''}`}
const posChips=p=>`<div class="poss">${POS.map(s=>{const i=posInfo(p,s);return i.tier<=1?`<span class="${i.tier===0?'n':'c'}">${s}</span>`:''}).join('')}</div>`;
function legHintBox(g,pl){const H=legendHints(g,pl);if(!H.length)return '';
  return `<div class="mhint lgh">${H.map(h=>`<div style="color:${col(h.s)}">${h.L.ic} ${h.t==='complete'?`${esc(nm(S,h.s))} 拿下他就湊齊「${esc(h.L.nm)}」（+${legVal(h.L,h.L.need)} 戰力）`:`${esc(nm(S,h.s))} 拿下他，離「${esc(h.L.nm)}」只差 1 人`}</div>`).join('')}</div>`}
function chemHints(g,pl){const out=[];
  g.sides.forEach(s=>g.rosters[s].forEach(r=>{const q=g.items[r.k];const k=tmOn(g)?shared(pl,q):0;
    if(k>=2)out.push({s,t:`🤝 跟 ${nm(S,s)} 的 ${q.n} 同隊 ${k} 季`});if(feudOf(pl,q))out.push({s,t:`⚡ 跟 ${nm(S,s)} 的 ${q.n} 處不好`})}));return out}
function amtFor(g,s){const mn=g.bid.amt+1,mx=maxBid(g,s);let v=ui.amt[s];if(!(v>g.bid.amt))v=mn;return clamp(v,Math.min(mn,mx),mx)}
function bidRow(g,s,r,held){
  const full=openN(g,s)===0,lead=g.bid.who===s,mx=maxBid(g,s),mine=r==='all'||r===s,passed=g.pass[s],turn=g.turn===s;
  const out=full||passed||(!lead&&mx<=g.bid.amt);
  const rost=SLOTS(g).map(x=>{const q=g.rosters[s].find(y=>y.slot===x),L=isBench(x)?(q&&q.role?BROLE[q.role].sh:'替'):x;return q?`<span class="f ${isBench(x)?'bench':''}" id="r-${g.gid}-${s}-${x}-${q.k}"><b>${L}</b>${esc(g.items[q.k].n.split(' ').slice(-1)[0])}</span>`:`<span class="${isBench(x)?'bench':''}"><b>${L}</b>—</span>`}).join('');
  const offl=!offline()&&S.seats[s]&&S.seats[s].cid!==CID&&!onlineSet().has(S.seats[s].cid);
  const state=held?'':fmtBusy(g)?(offl?'📴 離線中・':'')+(full?'陣容已滿':fmtState(g,s)):(offl?'📴 離線中（自動跳過）・':'')+(full?'陣容已滿':passed?'不要了':lead?'領先中':(!lead&&mx<=g.bid.amt)?'錢不夠加價':turn?(mine?'輪到你出價':'出價中…'):'');
  const v=amtFor(g,s),can=mine&&turn&&!out&&v<=mx&&v>g.bid.amt;
  const fb=fmtBusy(g);
  const ctrl=held?'':fb?fmtCtrl(g,s,r)
    :mine&&!out&&!lead?`<div class="bidin"><button class="stp" data-act="step" data-who="${s}" data-v="-1" ${can&&v>g.bid.amt+1?'':'disabled'}>−</button>
      <input class="amt" type="number" inputmode="numeric" pattern="[0-9]*" data-in="amt" data-who="${s}" min="${g.bid.amt+1}" max="${mx}" value="${v}" ${turn?'':'disabled'} aria-label="出價金額">
      <button class="stp" data-act="step" data-who="${s}" data-v="1" ${can&&v<mx?'':'disabled'}>＋</button>
      <button class="bb go" data-act="bidv" data-who="${s}" ${can?'':'disabled'}>出價<small>$${v}</small></button></div>
    <div class="bbtns"><button class="bb all" data-act="bid" data-who="${s}" data-amt="${mx}" ${can?'':'disabled'}>全下 $${mx}</button>
      <button class="bb pass" data-act="pass" data-who="${s}">不要${turn?'':'（先跳過）'}</button></div>`:'';
  return `<div class="brow ${s} ${lead?'lead':''} ${out?'out':''} ${turn?'turn':''}"><div class="hd"><span class="nm">${turn?'▶ ':''}${esc(nm(S,s))}${r===s?'（你）':''}</span><span class="mx">${full?'':`最高 $${mx}`}</span><span class="mo">$${left(g,s)}${g.budAdj&&g.budAdj[s]?`<small class="${g.budAdj[s]<0?'dn':'up'}">${g.budAdj[s]<0?'冠軍稅':'補償'}</small>`:''}</span></div>
    ${misChip(g,s)}<div class="bd"><div class="rost">${rost}</div>${held?'':cardTray(g,s,r)}${state?`<div class="small ${turn&&mine?'':'mut'}" style="margin-top:6px">${state}</div>`:''}${ctrl}</div></div>`;
}
function clock(end,tot,label,tick){return `<div class="small mut" data-end="${end}" data-tot="${tot}" ${tick?'data-tick="1"':''} style="width:100%">${label} <b class="tx"></b> 秒<div class="cd"><i></i></div></div>`}
function vAuction(){
  const g=S.game,r=myRole();const H=ui.hold&&ui.hold.gid===g.gid&&Date.now()<ui.hold.until?ui.hold:null;const pl=H?g.items[H.k]:cur(g);if(!pl)return '';
  // the beat after a card: one focal message (the banner); the card shrinks to its name and the other rows step back
  if(H){const l=H.l;
    return `<div class="top"><div class="prog">第<b>${H.k+1}</b>/ ${g.items.length} 張</div>${roundPill(g)}<div class="small mut">下一張準備中…</div></div><div class="bar"><i style="width:${Math.round((H.k+1)/g.items.length*100)}%"></i></div>
      <div class="stage"><div class="pcard front held calm" id="held-${g.gid}-${H.k}"><div class="pname">${esc(pl.n)}</div></div></div>${g.reveal&&g.reveal.grab&&g.reveal.grab.length<2?'':revealBox(g,H.k)}${soldBanner(g,H)}
      ${g.sides.map(s=>{const h=bidRow(g,s,r,true);return h.replace('<div class="brow ','<div class="brow '+(s===l.who?'won ':'dim '))}).join('')}`}
  const pct=Math.round(g.idx/g.items.length*100);
  if(g.stage==='left')return `<div class="top"><div class="prog">第<b>${g.idx+1}</b>/ ${g.items.length} 張</div>${roundPill(g)}<span class="fpill">🧺 撿剩下的</span></div><div class="bar"><i style="width:${pct}%"></i></div>${misStrip(g)}
    ${leftPanel(g,r)}${g.sides.map(s=>bidRow(g,s,r,true)).join('')}`;
  if(g.stage==='nom')return `<div class="top"><div class="prog">第<b>${g.idx+1}</b>/ ${g.items.length} 張</div>${roundPill(g)}${fmtPill(g)}</div><div class="bar"><i style="width:${pct}%"></i></div>${misStrip(g)}
    ${nomPanel(g,r)}${g.sides.map(s=>bidRow(g,s,r,true)).join('')}${r==='all'||ALL.includes(r)?`<button class="quit" data-act="quit">${ui.quit?'再按一次確認放棄本局':'放棄本局'}</button>`:''}`;
  const card=`<div class="pcard front" id="card-${g.gid}-${g.idx}">${g.price!=null?`<div class="ptag">$${g.grab?g.grab.price:dutchAt(g,now())}</div>`:''}<div class="pname">${esc(pl.n)}</div>${nickOf(pl)?`<div class="nick"><span>${esc(nickOf(pl))}</span></div>`:''}${phaseBadge(pl,g)}${posChips(pl)}${introBlock(pl,g.gid+'-'+g.idx)}
      ${g.showStats?`<div class="psub">${esc(sub(pl))}</div><div class="pstats">${[['pts','PTS'],['trb','REB'],['ast','AST'],['stl','STL'],['blk','BLK']].map(([k,l])=>`<div><b>${fmt(pl[k])}</b><i>${l}</i></div>`).join('')}</div>`:''}</div>`;
  const hints=g.hints?chemHints(g,pl):[];
  const hintBox=hints.length?`<div class="chemh">${hints.map(h=>`<div style="color:${col(h.s)}">${esc(h.t)}</div>`).join('')}</div>`:'';
  const b=g.bid,rdg=inRead(g)&&!g.stage;
  const curBox=rdg?readBox(g,r):g.sb?(g.tie?revealBox(g,g.idx):'')+sealedBox(g):g.price!=null?snatchBox(g):`<div class="cur" style="${b.who?`border-color:${col(b.who)}`:''}"><div class="line">${!b.who?`<div class="mut">等待出價（最低 $1）</div>`:`<div class="amt" id="amt-${g.gid}-${g.idx}-${b.amt}-${b.who}" style="color:${col(b.who)}">$${b.amt}</div><div class="who">${esc(nm(S,b.who))}<br><span class="small mut">目前最高</span></div>`}</div>
    ${!g.turn?'':clock(g.deadline,b.who?T_BID:T_NOBID,`輪到 <b style="color:${col(g.turn)}">${esc(nm(S,g.turn))}</b>・`+(b.who?'不加價就算放棄：':'不出價就算不要：'),r===g.turn&&NET.mode!=='local')}</div>`;
  const ex=g.extra||0,base=g.base||g.items.length,openAll=g.sides.reduce((t,s)=>t+openN(g,s),0),left2=g.items.length-g.idx,canAdd=EXTRA_MAX-ex;
  const deckNote=pl.extra?`<div class="xnote">🔔 加牌 ${g.idx-base+1}/${ex}・流標換來的明星，${canAdd?`還能再補 ${canAdd} 張`:'這是最後幾張了'}</div>`
    :left2+canAdd<openAll+2&&left2<=openAll+1?`<div class="xnote warn">⚠️ 牌快不夠了：還剩 ${left2} 張${canAdd?`＋最多補 ${canAdd} 張`:''}，沒標到的位置會用自由球員補</div>`:'';
  return `<div class="top"><div class="prog">第<b>${g.idx+1}</b>/ ${g.items.length} 張</div>${roundPill(g)}${fmtPill(g)}<div class="small mut">之後還有 ${remain(g)-1} 張${canAdd?`<br><small>流標可補 ${canAdd} 張</small>`:''}</div></div>${deckNote}
  <div class="bar"><i style="width:${pct}%"></i></div>${misStrip(g)}<div class="stage">${card}</div>${mktStrip(g)}${legHintBox(g,pl)}${misHintBox(g,pl)}${hintBox}${curBox}
  ${g.sides.map(s=>bidRow(g,s,r,rdg)).join('')}
  ${r==='all'||ALL.includes(r)?`<button class="quit" data-act="quit">${ui.quit?'再按一次確認放棄本局':'放棄本局'}</button>`:''}`;
}
function vLineup(){
  const g=S.game,r=myRole();
  const panel=s=>{const mine=r==='all'||r===s,R=rosterOf(g,s),rd=g.ready[s];
    if(!mine)return `<section class="card"><div class="row"><b style="color:${col(s)}">${esc(nm(S,s))}</b><span class="grow"></span><span class="small ${rd?'':'mut'}">${rd?'✅ 已準備':'<span class="spin"></span> 排陣中…'}</span></div>
      <div class="small mut" style="margin-top:6px">${R.map(p=>esc(p.n)).join('、')}</div><div class="small mut" style="margin-top:4px">位置安排開打時才公開。</div></section>`;
    const plate=p=>{const pi=posInfo(p,p.slot),sel=ui.sel&&ui.sel.who===s&&ui.sel.slot===p.slot,b=isBench(p.slot),nk=nickOf(p);
      return `<div class="plate ${s} ${sel?'sel':''} ${b?'bench':''} ${rd?'locked':''}" data-act="${rd?'':'lu'}" data-who="${s}" data-v="${p.slot}" data-drag="${rd?'':s}">
        <span class="ps">${b?BROLE[p.role||'G'].sh:p.slot}</span><span class="pn"><b>${esc(String(p.n).toUpperCase())}</b>${b?roleChip(g,s,p,rd):''}<small>${nk?`“${esc(nk)}”・`:''}能打 ${canPlay(p).join(' ')||'—'}${pi.tier>0&&!b?` <i class="tag t${pi.tier}">${pi.lab}</i>`:''}</small><span class="pst">${p.fa?'自由球員（替補程度）':`<b>${fmt(p.pts)}</b> 分 <b>${fmt(p.trb)}</b> 板 <b>${fmt(p.ast)}</b> 助 <b>${fmt(p.stl)}</b> 抄 <b>${fmt(p.blk)}</b> 帽`}<i>$${p.price||0}</i></span></span><span class="grip" aria-hidden="true">⠿</span></div>`};
    const st=R.filter(p=>!isBench(p.slot)),bn=R.filter(p=>isBench(p.slot));
    return `<section class="board2 ${s}"><div class="bh"><span class="bt" style="color:${col(s)}">${esc(nm(S,s))}</span><span class="small" style="color:#aab4cc">剩 $${left(g,s)}</span></div>${misChip(g,s)}
      <div class="bsub">${rd?'已鎖定，等其他人…':(ui.sel&&ui.sel.who===s?'再點一位球員跟他交換':'拖曳 ⠿ 或點兩位球員互換'+(g.size===10?'（先發和替補也能互換）':''))}</div>
      <div class="blab">先發</div>${st.map(plate).join('')}${bn.length?`${benchSummary(g,s)}${bn.map(plate).join('')}`:''}
      <button class="${rd?'ghost':'big'}" style="margin-top:12px" data-act="ready" data-who="${s}" data-v="${rd?0:1}" ${!rd&&!benchOK(g,s)?'disabled':''}>${rd?'取消準備':'準備好了 ✓'}</button></section>`};
  return `<div class="center" style="margin-top:14px">${roundPill(g)}<div style="font-size:36px">📋</div><div style="font-weight:900;font-size:20px">賽前排陣</div>${lineupMisNote(g)}
    <div class="small mut" style="max-width:420px;margin:4px auto 0">同位置的球員會一對一。小個子打大位置靠速度、但籃板吃虧；大個子靠籃板和低位。對手的排法開打才公開。</div>
    <div style="max-width:300px;margin:8px auto 0">${clock(g.lineupEnd,T_LINEUP*(g.size===10?4/3:1),'時間到自動開打：')}</div></div>
    ${g.sides.map(panel).join('')}`;
}
const ar=(x,k,inv)=>{const m=x.m&&x.m[k];if(m==null||Math.abs(m-1)<0.1)return '';const good=inv?m<1:m>1;return `<i class="${good?'up':'dn'}">${m>1?'▲':'▼'}</i>`};
/* ---------- game-by-game playback ----------
 Built on each device from S.sim with seeded randomness, so every player sees the same games
 without sending anything extra over the network. Final scores and series results are the simulation's own. */
let pbCache={gid:null,d:null};
const lastN_=p=>String(p.n||'').split(' ').slice(-1)[0];
const callN=(p,r)=>{const k=nickOf(p);return k&&r()<0.5?k.split('・')[0]:lastN_(p)};
function splitInt(total,parts,r,sd=0.18){const w=[...Array(parts)].map(()=>Math.max(0.4,1+gauss(r)*sd));return alloc(total,w)}
function periods(sa,sb,ot,r){
  const oa=[],ob=[];for(let i=0;i<ot;i++){if(i<ot-1){const x=4+Math.floor(r()*8);oa.push(x);ob.push(x)}else{const lo=4+Math.floor(r()*7),d=Math.abs(sa-sb);oa.push(sa>sb?lo+d:lo);ob.push(sb>sa?lo+d:lo)}}
  const ra=sa-oa.reduce((t,x)=>t+x,0),rb=sb-ob.reduce((t,x)=>t+x,0);
  return [splitInt(ra,4,r).concat(oa),splitInt(rb,4,r).concat(ob)]}
function styleOf(p){const b=bioOf(p),f=String(b&&b.sk||''),pe=peOf(p);
  return{three:f.includes('3')||spc(p)>=0.5,mid:f.includes('m'),rim:f.includes('r'),big:pe>=4,guard:pe<=2.5,pass:num(p.astp,0)>=25,blk:num(p.blkp,0)>=3.5,stl:num(p.stlp,0)>=2.2,star:num(p.obpm,0)+num(p.dbpm,0)>=5}}
function pickW(arr,w,r){const W=w.reduce((a,b)=>a+b,0);let x=r()*W;for(let i=0;i<arr.length;i++){x-=w[i];if(x<=0)return arr[i]}return arr[arr.length-1]}
const PICK=(a,r)=>a[Math.floor(r()*a.length)];
const KTXT={three:['{n} 底角三分，刷！','{n} 接球就投，三分入網','{n} 運球拉開，三分命中！','{n} 頂著防守投進三分'],
  logo:['{n} 中場 Logo 超遠三分！全場沸騰'],mid:['{n} 後仰中距離，進！','{n} 急停跳投命中','{n} 罰球線跳投得手','{n} 轉身後仰，空心入網'],
  rim:['{n} 一步過人直搗籃下','{n} 歐洲步上籃得手','{n} 切入拋投進球'],and1:['{n} 切入硬擠，打進還加罰！'],
  dunk:['{n} 雙手暴扣！','{n} 單手戰斧劈扣！','{n} 隔人爆扣！籃框還在晃'],post:['{n} 禁區轉身強攻得手','{n} 背框單打，勾射進球','{n} 夢幻腳步晃開防守'],
  putback:['{n} 搶下進攻籃板補進','{n} 補籃得手'],ankle:['{n} 一記變向把防守者晃倒 😵 輕鬆上籃'],
  alley:['{a} 拋出空中接力，{n} 接球灌籃！'],assist:['{a} 不看人妙傳，{n} 輕鬆得分','{a} 精準長傳，{n} 快攻上籃'],
  block:['{n} 送出大火鍋！','{n} 把球搧到場邊！'],steal:['{n} 抄截，一路快攻！','{n} 預判傳球路線，抄截成功']};
const KPTS={three:3,logo:3,and1:3,mid:2,rim:2,dunk:2,post:2,putback:2,ankle:2,alley:2,assist:2,block:0,steal:0};
const KICO={boom:'💥',takeover:'👑',three:'🎯',logo:'🎯',mid:'🏀',rim:'🏀',and1:'💪',dunk:'💥',post:'🏀',putback:'🏀',ankle:'😵',alley:'🚀',assist:'🤝',block:'🚫',steal:'🧤',timeout:'⏸',run:'🔥',hot:'🔥',tech:'😤',ot:'⏱',clutch:'🏆',rest:'🪑',foul:'⚠️',foulout:'❌',eject:'🟥'};
/* signature traits of well-known stars (from widely cited "signature moves" lists and highlights).
   They change how a play is shown and nudge which play type a player picks; how often they happen is still
   tied to his numbers: chase-down blocks scale with block rate, swats only replace blocks the stats produce,
   clutch shooters get a bigger share of game-winners. */
const SIG={
 jamesle01:{lab:'追魂鍋',chase:1},
 wadedw01:{lab:'閃電切入',chase:1,k:{rim:['{n} 閃電切入，空中換手上籃']}},
 pippesc01:{lab:'全能防守',chase:1,stl:['{n} 長臂抄截，一路快攻']},
 wembavi01:{lab:'長臂封阻',kl:{three:'外星人三分'},swat:['{n} 長臂一揮，把切入的上籃直接搧飛！','外星人 {n} 的臂展太誇張，上籃被搧到場邊'],k:{three:['{n} 7 呎 4 的高度投三分，根本蓋不到']}},
 mutomdi01:{lab:'搖手指',swat:['{n} 大火鍋！還對對手搖搖手指 ☝️']},
 howardw01:{lab:'超人灌籃',sl:'超人封阻',k:{dunk:['{n} 超人起飛，雙手暴扣！']},swat:['{n} 從籃下飛出來，把球搧出界']},
 wallabe01:{lab:'大本鐘',swat:['{n} 大火鍋！大本鐘響了 🔔']},
 robinda01:{lab:'海軍上將',swat:['{n} 海軍上將補防，把上籃蓋掉']},
 garneke01:{lab:'狼王怒吼',swat:['{n} 火鍋之後對著籃框怒吼']},
 olajuha01:{lab:'夢幻舞步',sl:'歷史火鍋王',k:{post:['{n} 夢幻舞步晃翻防守，輕鬆放進'],mid:['{n} 夢幻舞步接後仰跳投']},swat:['{n} 退回禁區把上籃蓋掉']},
 abdulka01:{lab:'天勾',k:{post:['{n} 招牌天勾，沒人蓋得到'],mid:['{n} 招牌天勾，空心入網']}},
 nowitdi01:{lab:'金雞獨立',k:{mid:['{n} 金雞獨立後仰跳投，進！'],post:['{n} 背框單腳後仰，籃框都沒碰到']},clutch:1},
 jordami01:{lab:'後仰跳投',kl:{dunk:'罰球線灌籃'},k:{mid:['{n} 招牌後仰跳投，防守再好也沒用'],dunk:['{n} 罰球線起跳，空中飛人灌籃！']},clutch:1},
 bryanko01:{lab:'曼巴後仰',k:{mid:['{n} 曼巴式後仰跳投，被包夾照樣進'],three:['{n} 高難度後仰三分']},clutch:1},
 lillada01:{lab:'Dame Time',k:{three:['{n} 超遠距離三分，指著手腕 ⌚'],logo:['{n} Logo 三分！Dame Time ⌚']},clutch:1,ctxt:'Dame Time！⌚ {n} 超遠三分殺死比賽'},
 curryst01:{lab:'Logo 三分',kl:{three:'超遠三分'},k:{three:['{n} 運球晃開，超遠三分刷網','{n} 球還沒進就轉身慶祝，Night Night 😴'],logo:['{n} 中場 Logo 附近出手——刷！']},clutch:1},
 iversal01:{lab:'Crossover',k:{ankle:['{n} 招牌 crossover 把防守者晃倒，還跨過去 😏'],rim:['{n} 胯下運球加速，撞進人群上籃']}},
 hardeja01:{lab:'後撤步三分',kl:{rim:'歐洲步'},k:{three:['{n} 招牌後撤步三分！'],rim:['{n} 歐洲步騙過防守，上籃得手']}},
 ginobma01:{lab:'歐洲步',k:{rim:['{n} 招牌歐洲步，閃過兩個人上籃'],and1:['{n} 歐洲步硬切，打進還加罰！']}},
 duncati01:{lab:'擦板跳投',k:{mid:['{n} 招牌 45 度擦板跳投'],post:['{n} 低位轉身擦板進球']}},
 jokicni01:{lab:'Sombor Shuffle',kl:{post:'背框單打'},pl:'不看人妙傳',k:{mid:['{n} 單腳後仰 Sombor Shuffle，進！'],post:['{n} 背框慢慢磨，轉身放進']},pass:['{a} 不看人背後傳球，{n} 空檔得分','{a} 全場長傳妙傳，{n} 快攻上籃']},
 johnsma02:{lab:'不看人傳球',kl:{post:'小天勾'},k:{post:['{n} 招牌小天勾！']},pass:['{a} 不看人傳球，{n} 快攻得分','{a} 魔術般的妙傳，{n} 輕鬆上籃']},
 nashst01:{lab:'穿針引線',pass:['{a} 鑽進禁區再穿針引線，{n} 輕鬆得分']},
 stockjo01:{lab:'經典擋拆',pass:['{a} 經典擋拆，把球塞給 {n} 輕鬆得分']},
 paulch01:{lab:'控衛之神',kl:{mid:'罰球線中距離'},pass:['{a} 擋拆後擊地傳球，{n} 接球得分'],k:{mid:['{n} 招牌罰球線中距離']}},
 malonka01:{lab:'擋拆順下',kl:{post:'低位背打'},k:{mid:['{n} 擋拆後接球中距離，郵差送達 📮'],post:['{n} 背打轉身強硬得分']}},
 onealsh01:{lab:'大鯊魚灌籃',k:{dunk:['{n} 背框轉身暴扣，籃架都在晃！','{n} 雙手暴扣，差點把籃框扯下來'],post:['{n} 低位硬頂進禁區，強吃得分']}},
 cartevi01:{lab:'飛人灌籃',k:{dunk:['{n} 起跳越過防守者，半人半神暴扣！']}},
 antetgi01:{lab:'歐洲步暴扣',k:{dunk:['{n} 三分線起步，兩步就到籃下暴扣！'],rim:['{n} 歐洲步長驅直入']}},
 leonaka01:{lab:'大手抄截',kl:{mid:'後仰跳投'},stl:['{n} 大手一伸，直接把球摸走'],k:{mid:['{n} 底角後仰跳投——彈框四下，進了！']},clutch:1},
 allenra02:{lab:'底角三分',k:{three:['{n} 底角三分，教科書般的投籃']},clutch:1,ctxt:'{n} 退到底角接球——三分進！救命一擊'},
 millere01:{lab:'Miller Time',k:{three:['{n} 連續三分，還對觀眾比割喉手勢']},clutch:1},
 horryro01:{lab:'關鍵先生',clutch:1,ctxt:'關鍵先生 {n} 接球出手，致勝三分！'},
 irvinky01:{lab:'魔術運球',k:{rim:['{n} 魔術般運球，打板挑籃進'],ankle:['{n} 連續胯下，晃倒防守者']},clutch:1},
 duranke01:{lab:'死神跳投',k:{mid:['{n} 7 呎身高急停跳投，誰都蓋不到']}},
 westbru01:{lab:'全速推進',k:{dunk:['{n} 全速推進，一路衝刺暴扣！'],rim:['{n} 坦克式衝刺上籃']}},
 thompkl01:{lab:'手感爆發',k:{three:['{n} 接球就投，三分連發']}},
 butleji01:{lab:'Playoff Jimmy',clutch:1},
 rodmade01:{lab:'籃板蟲',k:{putback:['{n} 拼命搶下進攻籃板，補進']}}};
// shared trait: the league's famous tomahawk / power dunkers (from all-time best-dunker lists: Wilkins, Carter, Dr. J, Kemp, Drexler...)
const TOMA=new Set(['jamesle01','cartevi01','wilkido01','ervinju01','kempsh01','drexlcl01','thompda01','mcgratr01','griffbl01','moranja01','westbru01','edwaran01','willizi01','lavinza01','richaja01','smithjo03']);
const TOMA_TXT=['{n} 高高舉起單手，戰斧暴扣！','{n} 空中把球拉到腦後，戰斧式重扣，籃框還在晃 🪓','{n} 衝進禁區起飛，頂著防守者戰斧暴扣！','{n} 快攻一路殺到底，戰斧劈扣，全場起立 🪓'];
const sigOf=p=>p&&own(SIG,p.id)?SIG[p.id]:null;
// movement shooters: they run off screens for their threes; athletic freaks can still recover onto a step-back/fadeaway
const MOVERS=new Set(['curryst01','thompkl01','allenra02','millere01','redicjj01','korveky01','hamilri01','robindu01']);
const ATHL=new Set(['jamesle01','westbru01','antetgi01','davisan02','leonaka01','pippesc01','wembavi01','wadedw01','jordami01','garneke01','olajuha01','robinda01','moranja01','edwaran01']);
const OFFBALL_TXT=['{n} 無球跑動，繞過兩道掩護，接球三分刷！','{n} 從底線一路跑到側翼，接球就投，進！','{n} 繞掩護甩開防守，空檔三分！'];
function sigText(p,kind,a,r){const g=sigOf(p);if(g&&g.k&&g.k[kind]&&r()<0.85)return{txt:fill(PICK(g.k[kind],r),p,a,r),sig:(g.kl&&g.kl[kind])||g.lab,sp:p.n,sid:p.id};
  const ga=sigOf(a);if(a&&ga&&ga.pass&&(kind==='assist'||kind==='alley')&&r()<0.8)return{txt:fill(PICK(ga.pass,r),p,a,r),sig:ga.pl||ga.lab,sp:a.n,sid:a.id};
  return{txt:fill(PICK(KTXT[kind],r),p,a,r)}}
const SIGICO={jamesle01:'👑',wadedw01:'⚡',pippesc01:'🦇',wembavi01:'👽',mutomdi01:'☝️',howardw01:'🦸',wallabe01:'🔔',robinda01:'⚓',garneke01:'🐺',
 olajuha01:'🌀',abdulka01:'🪝',nowitdi01:'🦩',jordami01:'🐐',bryanko01:'🐍',lillada01:'⌚',curryst01:'😴',iversal01:'😵',hardeja01:'🧔',ginobma01:'🔀',
 duncati01:'🪨',jokicni01:'🃏',johnsma02:'🪄',nashst01:'🧵',stockjo01:'🤝',paulch01:'🧠',malonka01:'📮',onealsh01:'🦈',cartevi01:'🚀',antetgi01:'🦌',
 leonaka01:'🤖',allenra02:'🍬',millere01:'🔪',horryro01:'🎯',irvinky01:'🪄',duranke01:'💀',westbru01:'🏎️',thompkl01:'🔥',butleji01:'😤',rodmade01:'🪱'};
const SIGMOVE={olajuha01:'spin',abdulka01:'hook',johnsma02:'hook',nowitdi01:'fade',jordami01:'fade',bryanko01:'fade',jokicni01:'fade',hardeja01:'step',
 iversal01:'cross',irvinky01:'cross',ginobma01:'euro',antetgi01:'euro',duncati01:'bank',mutomdi01:'wag',lillada01:'deep',curryst01:'deep'};
function offKind(p,mates,r){const st=styleOf(p),c=[],w=[];const add=(k,x)=>{const i=c.indexOf(k);if(i>=0)w[i]+=x;else{c.push(k);w.push(x)}};
  add(st.big?'post':'rim',2);if(st.three)add('three',st.big?2:4);if(st.mid)add('mid',3);add('mid',1);
  if(st.rim)add('and1',1.2);if(st.big||st.rim)add('dunk',st.big?2:1.2);if(st.big)add('putback',1);if(st.guard)add('ankle',0.35);
  if(st.three&&st.star)add('logo',0.15);
  if(TOMA.has(p.id)){const i=c.indexOf('dunk');if(i>=0)w[i]*=2;else add('dunk',1.5)}
  const g=sigOf(p);if(g&&g.k)Object.keys(g.k).forEach(k=>{const i=c.indexOf(k);if(i>=0)w[i]*=3;else if(k==='logo'&&st.three)add('logo',0.7)});
  const k=pickW(c,w,r),passers=mates.filter(q=>q!==p&&styleOf(q).pass);
  if(passers.length&&k!=='putback'&&k!=='ankle'&&k!=='logo'&&r()<0.3){const a=PICK(passers,r);return{k:(k==='dunk'||k==='rim')&&r()<0.5?'alley':k==='three'?'three':'assist',a}}
  return{k,a:null}}
function fill(t,p,a,r){return t.replace('{n}',callN(p,r)).replace('{a}',a?callN(a,r):'')}
function gameEvents(z,game,boxA,boxB,R,r,inc,bo,tk){inc=inc||[];bo=bo||{};tk=tk||{};
  const [sa,sb,ot]=game,[qa,qb]=game.q,P=qa.length,ev=[];
  const teams={[z.a]:{box:boxA,R:R[z.a]},[z.b]:{box:boxB,R:R[z.b]}},other=s=>s===z.a?z.b:z.a,tn=s=>nm(S,s);
  const ptsOf=(T,x)=>{const b=T.box.find(y=>y.n===x.n);return b?b.pts:2};
  let toDone=false,techDone=!!(S.game&&S.game.size===10);const hot={};
  // a player who fouled out / was ejected disappears from later highlights
  const gone=(n,q,t)=>inc.some(i=>i.n===n&&(i.kind==='eject'||i.kind==='foulout')&&(q+t)>(i.q+i.t));
  const avail=(T,q,t)=>{const a=T.R.filter(p=>!gone(p.n,q,t));return a.length?a:T.R};
  for(let q=0;q<P;q++){const n=q<4?3:2;
    for(let i=0;i<n;i++){const frac=(i+0.35+r()*0.4)/n,len=q<4?12:5,mm=Math.max(0,len*(1-frac)),clk=`${Math.floor(mm)}:${String(Math.floor((mm%1)*60)).padStart(2,'0')}`;
      const side=r()<(qa[q]/(qa[q]+qb[q]||1))?z.a:z.b,T0=teams[side],O0=teams[other(side)],T={...T0,R:avail(T0,q,frac)},O={...O0,R:avail(O0,q,frac)};const x=r();let e;
      if(!toDone&&(q===1||q===2)&&x<0.12){toDone=true;e={kind:'timeout',side:other(side),txt:`${tn(other(side))} 叫暫停，教練氣得跳腳`}}
      else if(!techDone&&x<0.16&&T.R.some(p=>HOT.has(p.id))){techDone=true;const p=PICK(T.R.filter(p=>HOT.has(p.id)),r);e={kind:'tech',side,p:p.n,txt:`${callN(p,r)} 跟裁判理論，吃到技術犯規 😤`}}
      else if(x<0.27){const c=T.R.filter(y=>styleOf(y).blk),p=c.length&&r()<0.7?PICK(c,r):pickW(T.R,T.R.map(y=>num(y.blk,0.3)+0.1),r),sh=pickW(O.R,O.R.map(y=>ptsOf(O,y)+1),r);
        const gs=sigOf(p),useS=gs&&gs.swat&&r()<0.9;e={kind:'block',side,p:p.n,d:sh.n,txt:useS?fill(PICK(gs.swat,r),p,null,r):fill(PICK(KTXT.block,r),p,null,r)};if(useS){e.sig=gs.sl||gs.lab;e.sp=p.n;e.sid=p.id}}
      else if(x<0.36){const p=pickW(T.R,T.R.map(y=>num(y.stl,0.5)+0.1),r),gs=sigOf(p);const useS=gs&&gs.stl&&r()<0.7;e={kind:'steal',side,p:p.n,txt:useS?fill(PICK(gs.stl,r),p,null,r):fill(PICK(KTXT.steal,r),p,null,r)};if(useS){e.sig=gs.lab;e.sp=p.n;e.sid=p.id}
        // chase-down block: a trait player on the beaten team, chance scaled by his block rate
        const ch=O.R.filter(y=>sigOf(y)&&sigOf(y).chase);if(ch.length){const c2=PICK(ch,r),pc=0.35*clamp(num(c2.blkp,1)/2.2,0.3,1);
          if(r()<pc){e.chase=c2.n;e.txt+=`……${callN(c2,r)} 從後面追上來，追魂鍋！🚫`;e.sig='追魂鍋';e.sp=c2.n;e.sid=c2.id}}}
      else{const p=pickW(T.R,T.R.map(y=>ptsOf(T,y)+1),r),o=offKind(p,T.R,r);
        if(o.k==='three'&&MOVERS.has(p.id)&&r()<0.55){e={kind:'three',side,p:p.n,play:'offball',txt:fill(PICK(OFFBALL_TXT,r),p,null,r)}}
        else if(o.k==='dunk'&&TOMA.has(p.id)&&r()<0.65){e={kind:'dunk',side,p:p.n,txt:fill(PICK(TOMA_TXT,r),p,null,r),sig:'戰斧暴扣',sp:p.n,sid:p.id,ico:'🪓'}}
        else{const st2=sigText(p,o.k,o.a,r);e={kind:o.k,side,p:p.n,a:o.a&&o.a.n,txt:st2.txt};if(st2.sig){e.sig=st2.sig;e.sp=st2.sp;e.sid=st2.sid}}
        const hk=side+p.n;hot[hk]=(hot[hk]||0)+1;if(hot[hk]===3)ev.push({q,t:Math.min(0.99,frac+0.02),clk,side,kind:'hot',txt:`${callN(p,r)} 手感發燙！已經投進好幾球 🔥`})}
      e.q=q;e.t=frac;e.clk=clk;ev.push(e)}}
  const N=nm2=>{const p=[...teams[z.a].R,...teams[z.b].R].find(x=>x.n===nm2);return p?callN(p,r):String(nm2).split(' ').slice(-1)[0]};
  inc.forEach(i=>{const len=i.q<4?12:5,mm=Math.max(0,len*(1-i.t)),clk=`${Math.floor(mm)}:${String(Math.floor((mm%1)*60)).padStart(2,'0')}`,sub=i.sub?`，${N(i.sub)} 替補上場`:'';
    if(i.kind==='tech')ev.push({q:i.q,t:i.t,clk,side:i.side,kind:'tech',p:i.n,txt:`${N(i.n)} 跟裁判理論，吃到技術犯規 😤`});
    if(i.kind==='trouble')ev.push({q:i.q,t:i.t,clk,side:i.side,kind:'foul',p:i.n,txt:`${N(i.n)} ${i.q<2?'上半場就三犯':'第四次犯規'}，被換下場休息${sub}`});
    if(i.kind==='foulout')ev.push({q:i.q,t:i.t,clk,side:i.side,kind:'foulout',p:i.n,txt:`${N(i.n)} 六犯畢業，犯滿離場 ❌${sub}`});
    if(i.kind==='eject'){ev.push({q:i.q,t:Math.max(0,i.t-0.08),clk,side:i.side,kind:'tech',p:i.n,txt:`${N(i.n)} 情緒失控，吃到第一次技術犯規 😤`});
      ev.push({q:i.q,t:i.t,clk,side:i.side,kind:'eject',p:i.n,txt:`${N(i.n)} 第二次技術犯規，被驅逐出場 🟥${sub}`})}});
  Object.entries(bo).forEach(([s,n])=>{const b=teams[s]&&teams[s].box.find(x=>x.n===n);if(!b)return;const q=Math.min(P-1,2),t=0.55+0.3*r(),mm=12*(1-t),clk=`${Math.floor(mm)}:${String(Math.floor((mm%1)*60)).padStart(2,'0')}`;
    ev.push({q,t,clk,side:s,kind:'boom',p:n,txt:`${N(n)} 打出生涯之夜，第三節就拿了 ${Math.max(12,Math.round(b.pts*0.7))} 分 🔥`})});
  Object.entries(tk).forEach(([s,n])=>{const b=teams[s]&&teams[s].box.find(x=>x.n===n);if(!b)return;const q=Math.min(P-1,3),t=0.3+0.25*r(),mm=12*(1-t),clk=`${Math.floor(mm)}:${String(Math.floor((mm%1)*60)).padStart(2,'0')}`;
    const p=teams[s].R.find(x=>x.n===n);ev.push({q,t,clk,side:s,kind:'takeover',p:n,sp:n,sid:p&&p.id,txt:`${N(n)} 接管比賽！球隊連續 ${3+Math.floor(r()*3)} 波進攻都交給他，全場 ${b.pts} 分`});
    // he takes the next couple of scoring plays of his team
    let k=0;ev.forEach(e=>{if(k<2&&e.side===s&&KPTS[e.kind]>0&&e.q===q&&e.t>t&&e.p!==n&&p){const st2=sigText(p,e.kind==='three'?'three':e.kind==='dunk'?'dunk':'mid',null,r);e.p=n;e.a=null;e.play=null;e.txt=st2.txt;delete e.sig;if(st2.sig){e.sig=st2.sig;e.sp=st2.sp;e.sid=st2.sid}e.kind=e.kind==='three'?'three':e.kind==='dunk'?'dunk':'mid';k++}})});
  ev.sort((x,y)=>(x.q+x.t)-(y.q+y.t));
  // scoring runs: three scoring plays in a row by one team
  let run=0,last=null;const runs=[];ev.forEach((e,i)=>{if(KPTS[e.kind]>0){if(e.side===last)run++;else{last=e.side;run=1}if(run===3)runs.push({q:e.q,t:Math.min(0.995,e.t+0.01),clk:e.clk,side:e.side,kind:'run',txt:`${tn(e.side)} 打出一波 ${8+Math.floor(r()*6)}–0 攻勢 🔥`})}});
  ev.push(...runs);
  const win=sa>sb?z.a:z.b,diff=Math.abs(sa-sb),W=teams[win],top=avail(W,P-1,0.97).slice().sort((x,y)=>ptsOf(W,y)-ptsOf(W,x)).slice(0,5),
    star=diff<=4?pickW(top,top.map(x=>(ptsOf(W,x)+2)*(sigOf(x)&&sigOf(x).clutch?3:1)),r):top[0];
  if(ot)ev.push({q:3,t:0.999,clk:'0:00',side:null,kind:'ot',txt:'平手！比賽進入延長賽'});
  if(diff>=15)ev.push({q:P-1,t:0.75,clk:'3:'+String(10+Math.floor(r()*49)),side:win,kind:'rest',txt:`${callN(star,r)} 坐上板凳休息，比賽提前分出勝負`});
  else ev.push({q:P-1,t:0.97,clk:'0:0'+(2+Math.floor(r()*7)),side:win,kind:diff<=4?'clutch':'mid',p:star.n,sig:diff<=4&&sigOf(star)&&sigOf(star).clutch?sigOf(star).lab:undefined,sp:star.n,sid:star.id,txt:diff<=4?(sigOf(star)&&sigOf(star).ctxt?fill(sigOf(star).ctxt,star,null,r):`關鍵時刻！${callN(star,r)} 投進致勝球！`):`${callN(star,r)} 連拿分數，鎖定勝局`});
  return ev.sort((x,y)=>(x.q+x.t)-(y.q+y.t))}
function pbData(){const g=S.game,sim=S.sim;if(pbCache.gid===g.gid+sim.champ)return pbCache.d;
  const ro={},base={};g.sides.forEach(s=>{ro[s]=rosterOf(g,s);base[s]=baseRate(ro[s],g,left(g,s))});
  const list=[];
  sim.series.forEach((z,si)=>{const ra=pairRate(base[z.a],ro[z.a],ro[z.b]),rb=pairRate(base[z.b],ro[z.b],ro[z.a]);
    const pa0=withBench(ro[z.a],ra.per),pb0=withBench(ro[z.b],rb.per);
    const r=rng(hash(g.gid+z.a+z.b+'pb'));let wa=0,wb=0;
    z.games.forEach((gm,gi)=>{const [sa,sb,ot]=gm,last=gi===z.games.length-1,inc=(z.inc&&z.inc[gi])||[],pa=withMins(pa0,inc),pbb=withMins(pb0,inc);
      const bg=(z.bo&&z.bo[gi])||{},tg=(z.tk&&z.tk[gi])||{},bA=last?z.box[z.a]:boxFor(pa.map(x=>x.p),pa,sa,r,bg[z.a],tg[z.a]),bB=last?z.box[z.b]:boxFor(pbb.map(x=>x.p),pbb,sb,r,bg[z.b],tg[z.b]);
      const game=[sa,sb,ot];game.q=periods(sa,sb,ot,r);
      const ev=gameEvents(z,game,bA,bB,{[z.a]:pa.map(x=>x.p),[z.b]:pbb.map(x=>x.p)},r,inc,bg,tg);
      sa>sb?wa++:wb++;
      const all=bA.map(x=>({...x,s:z.a})).concat(bB.map(x=>({...x,s:z.b})));const pog=all.sort((x,y)=>(y.pts+1.2*y.reb+1.5*y.ast+2*y.stl+2*y.blk)-(x.pts+1.2*x.reb+1.5*x.ast+2*x.stl+2*x.blk))[0];
      list.push({si,gi,z,sa,sb,ot,q:game.q,ev,wa,wb,pog,last,bA,bB,inc,bo:bg,tk:tg})})});
  pbCache={gid:g.gid+sim.champ,d:list};return list}
const PB_Q=6000,PB_HOLD=2600,PB_SEG=1150,PB_POST=550;
function pbDur(G){return G.q[0].length*PB_Q+PB_HOLD}
const pbDefSp=()=>1;
/* playback clock: virtual game time advances at the chosen speed, but slows down around key moments
   (close game late, lead changes, game winners) and a little for highlight plays, so they can be followed */
function scoreAt(G,pe){const qa=G.q[0],qb=G.q[1],P=qa.length,full=Math.floor(pe);let a=0,b=0;
  for(let i=0;i<P;i++){if(i<full){a+=qa[i];b+=qb[i]}else if(i===full){const f=pe-full;a+=Math.floor(qa[i]*f);b+=Math.floor(qb[i]*f)}}return a-b}
function slowWins(G){if(G.slow)return G.slow;const W=[];const P=G.q[0].length;
  G.ev.forEach(x=>{if(DEAD.has(x.kind)&&x.kind!=='ot')return;const T=(x.q+x.t)*PB_Q,pe=x.q+x.t,d0=scoreAt(G,Math.max(0,pe-0.3)),d1=scoreAt(G,Math.min(P,pe+0.02)),late=x.q>=3&&x.t>0.45||x.q>=4;
    let w=null;
    if(x.kind==='clutch')w={rate:0.3,zoom:1,lab:'🎬 致勝球'};
    else if(x.chase)w={rate:0.35,zoom:1,lab:'🎬 追魂鍋'};
    else if(x.sig)w={rate:0.5,zoom:1,lab:`⭐ 招牌：${x.sig}`};
    else if(x.q>=2&&Math.sign(d0)!==Math.sign(d1)&&d1!==0&&d0!==0)w={rate:0.4,zoom:1,lab:'🎬 逆轉！'};
    else if(late&&Math.abs(d1)<=5)w={rate:0.4,zoom:1,lab:'🎬 關鍵時刻'};
    else if(x.kind==='ot')w={rate:0.5,zoom:0,lab:'⏱ 延長賽'};
    else if(['dunk','alley','logo','block','ankle'].includes(x.kind))w={rate:0.6,zoom:0,lab:''};
    if(w)W.push({a:T-1500,b:T+PB_POST+300,...w})});
  return G.slow=W}
const warpAt=(G,vt)=>{let r=1,w=null;for(const x of slowWins(G))if(vt>=x.a&&vt<=x.b&&x.rate<r){r=x.rate;w=x}return{r,w}};
function pbAdvance(){const p=ui.pb;if(!p)return;const now=Date.now(),dt=Math.min(250,now-(p.last||now));p.last=now;const G=pbData()[p.k];if(!G)return;
  p.vt+=dt*p.sp*warpAt(G,p.vt).r}
function pbState(){const L=pbData(),p=ui.pb;if(!p||p.gid!==S.game.gid)return null;
  const G=L[p.k];if(!G)return null;const e=p.vt,P=G.q[0].length,pe=Math.min(P,e/PB_Q);return{L,G,e,P,pe,done:e>=P*PB_Q,next:e>=pbDur(G)}}
function pbStart(){ui.pb={gid:S.game.gid,k:0,vt:0,last:Date.now(),sp:ui.pbSp||pbDefSp()}}
// the title moment: final buzzer, then the crowd. A cheer and fanfare when you (or anyone, on a shared phone) win; polite applause when you lose
function champSound(d){const ch=S.sim&&S.sim.champ,me=myRole(),won=me==='all'||me==='spec'||me===ch,t=d||0;
  sfx('horn',t);if(won){sfx('cheer',t+0.55);sfx('champ',t+1.2)}else sfx('applause',t+0.6)}
function pbNext(){const L=pbData();if(ui.pb.k+1>=L.length){ui.pbDone.add(S.game.gid);champSound();ui.pbFast=true;ui.pb=null}else{ui.pb.k++;ui.pb.vt=0;ui.pb.last=Date.now()}render();scrollTo(0,0)}
setInterval(()=>{if(!S)return;withView(()=>{if(S.phase!=='results'||!S.sim||!ui.pb||ui.pbDone.has(S.game.gid))return;pbAdvance();const st=pbState();if(st&&st.next&&ui.pb.auto!==false)return pbNext();render()})},150);

/* ---------- mini court (top-down, canvas) ----------
 Each highlight is played as a full possession: the ball is brought up the floor from where the last play ended,
 the offense runs a set that fits the shooter (isolation for stars, pick-and-roll, ball swing for shooters,
 post entry for bigs), then the shot. Steals turn into fast breaks the other way. Teams switch ends at halftime. */
const CW=360,CH=200,HX={L:22,R:338},HY=100;
const SET=[[118,100],[88,30],[88,170],[42,52],[20,140]];
const DEAD=new Set(['timeout','run','hot','tech','foul','foulout','eject','ot','rest','boom','takeover']);
function teamCol(s){const v=getComputedStyle(document.documentElement).getPropertyValue({A:'--a',B:'--b',C:'--c3'}[s]||'--a').trim();return v||'#2f7cf6'}
function court(ctx){ctx.fillStyle='#f3e3c6';ctx.fillRect(0,0,CW,CH);ctx.strokeStyle='rgba(120,80,30,.45)';ctx.lineWidth=1.2;
  ctx.strokeRect(4,4,CW-8,CH-8);ctx.beginPath();ctx.moveTo(CW/2,4);ctx.lineTo(CW/2,CH-4);ctx.stroke();ctx.beginPath();ctx.arc(CW/2,HY,22,0,7);ctx.stroke();
  for(const [hx,d] of [[HX.L,1],[HX.R,-1]]){ctx.fillStyle='rgba(239,120,40,.12)';ctx.fillRect(d>0?4:CW-4-62,HY-24,62,48);ctx.strokeRect(d>0?4:CW-4-62,HY-24,62,48);
    ctx.beginPath();ctx.moveTo(d>0?4:CW-4,HY-86);ctx.lineTo(hx+d*14,HY-86);ctx.arc(hx,HY,87,d>0?-1.4:Math.PI+1.4,d>0?1.4:Math.PI-1.4,d<0);ctx.lineTo(d>0?4:CW-4,HY+86);ctx.stroke();
    ctx.strokeStyle='#e8772e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(hx,HY,5,0,7);ctx.stroke();ctx.strokeStyle='rgba(120,80,30,.45)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(hx-d*6,HY-9);ctx.lineTo(hx-d*6,HY+9);ctx.stroke()}}
/* who is on the floor: starters, plus anyone the play-by-play needs (a bench scorer checks in for the closest
   position), minus players who fouled out / were ejected / sit with foul trouble. So the dots always match the text. */
function lineupAt(G,z,full,ev,upto,e){const ro={[z.a]:starters(full[z.a]).slice(),[z.b]:starters(full[z.b]).slice()},out=new Set();
  const by=(s,n)=>full[s].find(p=>p.n===n);
  const put=(s,n,keep)=>{if(!n||out.has(n)||ro[s].some(p=>p.n===n))return;const p=by(s,n);if(!p)return;let bi=-1,bd=1e9;
    const grp=p.role&&BROLE[p.role]?BROLE[p.role].pos:null;ro[s].forEach((q,i)=>{if(keep.includes(q.n))return;const d=Math.abs(peOf(q)-peOf(p))-(isBench(q.slot)?0.01:0)+(grp&&!grp.includes(q.slot)?5:0);if(d<bd){bd=d;bi=i}});if(bi>=0)ro[s][bi]={...p,slot:ro[s][bi].slot}};
  const items=ev.slice(0,upto+1).map(x=>({x,T:x.T})).concat((G.inc||[]).filter(i=>i.kind!=='tech'&&(i.q+i.t)*PB_Q<=e).map(i=>({i,T:(i.q+i.t)*PB_Q}))).sort((a,b)=>a.T-b.T);
  for(const it of items){if(it.i){const i=it.i;if(i.kind!=='trouble')out.add(i.n);const k=ro[i.side].findIndex(p=>p.n===i.n);
      if(k>=0){const sb=(i.sub&&by(i.side,i.sub))||full[i.side].find(p=>!ro[i.side].some(q=>q.n===p.n)&&!out.has(p.n));if(sb)ro[i.side][k]={...sb,slot:ro[i.side][k].slot}}continue}
    const x=it.x;if(DEAD.has(x.kind)&&!x.p)continue;const o=x.side===z.a?z.b:z.a;if(!x.side)continue;
    if(x.kind==='block'){put(x.side,x.p,[x.p]);put(o,x.d,[x.d])}else if(x.kind==='steal'){put(x.side,x.p,[x.p]);put(o,x.chase,[x.chase])}
    else if(!DEAD.has(x.kind)){put(x.side,x.p,[x.p,x.a]);put(x.side,x.a,[x.p,x.a])}}
  return ro}
const lerp=(a,b,u)=>a+(b-a)*u,ease=u=>u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2,cl01=u=>Math.max(0,Math.min(1,u)),seg=(u,a,b)=>cl01((u-a)/(b-a));
const L2=(p,q,u)=>[lerp(p[0],q[0],u),lerp(p[1],q[1],u)];
const at=(right,dx,y)=>[right?HX.R-dx:HX.L+dx,y],hoop=right=>[right?HX.R:HX.L,HY];
const attacksRight=(z,side,q)=>(side===z.a)!==(q>=2);
const SUFX=new Set(['Jr.','Sr.','II','III','IV']);
function shortName(p){const nk=nickOf(p),k=nk?nk.split('・')[0]:'';const parts=String(p.n||'').split(' ').filter(Boolean);let last=parts[parts.length-1]||'';
  if(SUFX.has(last)&&parts.length>2)last=parts[parts.length-2];if(last.length>9&&k)return k;
  const s=(parts.length>1?parts[0][0]+'.':'')+last;return s.length>11?(k||last.slice(0,10)):s}
function pathAt(pts,v){const seg2=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg2.push(d);tot+=d}
  let t=v*tot;for(let i=0;i<seg2.length;i++){if(t<=seg2[i]||i===seg2.length-1){const f=seg2[i]?Math.min(1,t/seg2[i]):1;return L2(pts[i],pts[i+1],f)}t-=seg2[i]}return pts[pts.length-1]}
function guardAt(o,right,dist){const h=hoop(right),dx=h[0]-o[0],dy=h[1]-o[1],d=Math.hypot(dx,dy)||1,g=Math.min(dist,d*0.6);return[o[0]+dx/d*g,o[1]+dy/d*g-3]}
function guard(o,right){const h=hoop(right),dx=h[0]-o[0],dy=h[1]-o[1],d=Math.hypot(dx,dy)||1,g=Math.min(16,d*0.35);return[o[0]+dx/d*g,o[1]+dy/d*g-5]}
function setLayout(off,def,right,ro,jit){const P={};ro[off].forEach((p,i)=>{const [dx,y]=SET[i];P[off+i]=at(right,dx+Math.sin(jit+i)*3,y+Math.cos(jit*1.2+i)*3)});
  ro[def].forEach((p,i)=>{P[def+i]=guard(P[off+i],right)});return P}
function tipoff(z,ro){const P={};[z.a,z.b].forEach((s,k)=>ro[s].forEach((p,i)=>{const ang=(i/5)*Math.PI*2+(k?0.6:0),r=i===4?8:34;P[s+i]=[CW/2+(k?6:-6)+Math.cos(ang)*r*(i===4?1:1),HY+Math.sin(ang)*r*0.8]}));return P}
function playType(E,p){if(E.kind==='three'||E.kind==='logo')return'swing';if(E.kind==='post'||E.kind==='putback')return'post';if(E.kind==='assist'||E.kind==='alley')return'pnr';
  return styleOf(p).star||E.kind==='clutch'?'iso':'drive'}
function shotDx(kind,seed){return kind==='logo'?150:kind==='three'?92:kind==='mid'?52:kind==='post'?24:12}
// where everyone stands when a play ends (start point of the next possession)
function endLayout(E,z,ro,prevL){if(!E||DEAD.has(E.kind))return prevL;
  const off=E.kind==='block'||E.kind==='steal'?(E.side===z.a?z.b:z.a):E.side,def=off===z.a?z.b:z.a,right=attacksRight(z,off,E.q),P={};
  if(E.kind==='steal'){const run=!right;ro[E.side].forEach((p,i)=>{P[E.side+i]=at(run,i===0?14:40+i*12,HY+(i-2)*24)});ro[off].forEach((p,i)=>{P[off+i]=at(run,60+i*14,HY+(i-2)*30)});return P}
  ro[off].forEach((p,i)=>{const [dx,y]=SET[i];P[off+i]=at(right,dx*0.6,lerp(HY,y,0.7))});ro[def].forEach((p,i)=>{P[def+i]=guard(P[off+i],right)});return P}
/* playback sound: each highlight makes its sound at the moment it lands on court (the ball through the net, the hand on
   the ball), not when its line appears in the feed. Jumps in the clock (seeking, a new game) make no sound, and at high
   speed the per-sound minimum gaps in sfx() keep it from turning into noise. */
const PB_SND={three:'swish',logo:'swish',dunk:'dunk',alley:'dunk',rim:'net',mid:'net',post:'net',putback:'net',and1:'net',ankle:'net',assist:'net',
  block:'block',steal:'steal',clutch:'clutch',takeover:'ooh',boom:'ooh',run:'ooh',foul:'whistle',tech:'whistle',eject:'whistle',foulout:'whistle',timeout:'whistle',ot:'horn'};
let pbSnd={k:null,e:0};
function pbSound(G,ev,e,done){const k=G.si+'-'+G.gi;if(pbSnd.k!==k||e<pbSnd.e||e-pbSnd.e>1200||done){pbSnd={k,e};return}const e0=pbSnd.e;pbSnd.e=e;
  ev.forEach((x,i)=>{const nm=PB_SND[x.kind];if(!nm)return;let T=x.T;const s0=i>0?ev[i-1].T+PB_POST:0;
    if(x.kind==='steal')T=s0+0.5*(x.T-s0);else if(x.kind==='block')T=s0+0.9*(x.T-s0);else if(DEAD.has(x.kind))T=x.T-400;
    if(T>e0&&T<=e)sfx(nm)})}
function courtFrame(){requestAnimationFrame(courtFrame);const cv=document.getElementById('court');if(!cv||!S||document.hidden)return;
  withView(()=>{if(S.phase!=='results'||!ui.pb)return;const st=pbState();if(!st)return;const {G,e,done}=st,z=G.z;
  let ctx=null;try{ctx=cv.getContext('2d')}catch(_){}if(!ctx)return;const k=cv.width/CW;pbAdvance();
  const full={[z.a]:rosterOf(S.game,z.a),[z.b]:rosterOf(S.game,z.b)};
  const C={[z.a]:teamCol(z.a),[z.b]:teamCol(z.b)},jit=e/380;
  const ev=G.ev.map(x=>({...x,T:(x.q+x.t)*PB_Q}));
  let ci=ev.findIndex(x=>x.T+PB_POST>e);if(ci<0)ci=ev.length;
  const ro=lineupAt(G,z,full,ev,Math.min(ci,ev.length-1),e);
  let L=tipoff(z,ro);for(let i=0;i<ci;i++)L=endLayout(ev[i],z,ro,L);
  const E=done?null:ev[ci],s0=ci>0?ev[ci-1].T+PB_POST:0;pbSound(G,ev,e,done);
  let P={...L},ball=null,flash=null,hl=null,banner=null,fallen=null;
  const idx=(s,n)=>{const i=ro[s].findIndex(p=>p.n===n);return i>=0?i:(hash(String(n))%5)};
  if(E&&!DEAD.has(E.kind)){
    const off=E.kind==='block'||E.kind==='steal'?(E.side===z.a?z.b:z.a):E.side,def=off===z.a?z.b:z.a,right=attacksRight(z,off,E.q),H=hoop(right);
    let u=cl01((e-s0)/Math.max(1,E.T-s0));const pu=e>E.T?cl01((e-E.T)/PB_POST):0,seed=hash(E.txt+E.clk);
    // possessions alternate: if the last play should have handed the ball to the other team, show their empty trip first
    let nat=null;for(let i=ci-1;i>=0;i--){const x=ev[i];if(DEAD.has(x.kind))continue;nat=x.kind==='block'?x.side:(x.side===z.a?z.b:z.a);break}
    let inTrip=false;if(nat&&nat!==off){const rD=attacksRight(z,def,E.q),SE=setLayout(def,off,rD,ro,jit),uE=seg(u,0,0.42),mv=ease(seg(uE,0,0.6));
      if(uE<1){inTrip=true;Object.keys(SE).forEach(kk=>{P[kk]=L2(L[kk]||SE[kk],SE[kk],mv)});const sh=P[def+1],H2=hoop(rD);
        if(uE<0.62){const q=P[def+0];ball=[q[0]+(rD?3:-3),q[1]+2,Math.abs(Math.sin(e/85))*3]}
        else if(uE<0.9){const v=seg(uE,0.62,0.9);ball=[lerp(sh[0],H2[0],v),lerp(sh[1],HY,v),Math.sin(Math.PI*v)*18]}
        else{const v=seg(uE,0.9,1),rb=P[off+4];ball=[lerp(H2[0],rb[0],v),lerp(HY,rb[1],v),8*Math.sin(Math.PI*v)];flash=['🧱 沒進！籃板',v]}}
      L=SE;u=seg(u,0.42,1)}
    const si=E.kind==='steal'?1+(seed%4):E.kind==='block'?idx(off,E.d):idx(off,E.p),sp=ro[off][si]||ro[off][0];
    const type=E.kind==='block'||E.kind==='steal'?'drive':E.play||playType(E,sp);
    play:{if(inTrip)break play;
    const S0=setLayout(off,def,right,ro,jit),uA=ease(seg(u,0,0.3));
    Object.keys(S0).forEach(kk=>{P[kk]=L2(L[kk]||S0[kk],S0[kk],uA)});
    let holder=0;const pass=[];// [time, toIndex]
    const big=ro[off][4]?4:3,ang=((seed%100)/100*2.2-1.1);
    const mv=E.sig&&E.sid&&E.sp===(ro[off][si]||{}).n?SIGMOVE[E.sid]:null,sdx=shotDx(E.kind)*(mv==='deep'&&E.kind==='three'?1.3:1);
    const spot=[right?H[0]-Math.cos(ang)*sdx:H[0]+Math.cos(ang)*sdx,HY+Math.sin(ang)*sdx*0.9];
    const uB=seg(u,0.3,0.72),uC=seg(u,0.72,1);
    let trail=null;
    if(type==='offball'){const y0=P[off+si][1]>HY?1:-1,route=[P[off+si],at(right,34,HY+y0*46),at(right,10,HY+y0*8),at(right,12,HY-y0*40),at(right,40,HY-y0*78),spot];
      const scr1=si===4?3:4,scr2=si===3?2:3;const v=ease(seg(u,0.3,0.66));P[off+si]=pathAt(route,v);trail=pathAt(route,Math.max(0,v-0.16));
      P[off+scr1]=L2(P[off+scr1],at(right,14,HY+y0*6),ease(seg(u,0.3,0.45)));P[off+scr2]=L2(P[off+scr2],at(right,22,HY-y0*48),ease(seg(u,0.42,0.56)));
      pass.push([0.66,si])}
    else if(type==='swing'){const mid=si===1?2:1;pass.push([0.42,mid],[0.6,si]);P[off+si]=L2(P[off+si],spot,ease(seg(u,0.45,0.62)))}
    else if(type==='post'){P[off+si]=L2(P[off+si],at(right,24,HY+18),ease(seg(u,0.3,0.5)));pass.push([0.52,si])}
    else if(type==='pnr'){const scr=si===big?3:big,pg=0;const scrPos=[P[off+pg][0]+(right?14:-14),P[off+pg][1]+10];
      P[off+scr]=L2(P[off+scr],scrPos,ease(seg(u,0.3,0.45)));P[off+pg]=L2(P[off+pg],at(right,48,HY-10),ease(seg(u,0.48,0.64)));
      if(si!==pg){P[off+si]=L2(P[off+si],at(right,14,HY+12),ease(seg(u,0.5,0.66)));pass.push([0.66,si])}}
    else if(type==='iso'){[0,1,2,3,4].forEach(i=>{if(i===si)return;const cor=[[8,18],[8,182],[110,30],[110,170],[60,190]][i];P[off+i]=L2(P[off+i],at(right,cor[0],cor[1]),ease(uB))});
      if(si!==0)pass.push([0.38,si]);P[off+si]=L2(P[off+si],at(right,70,HY+(seed%2?-14:14)),ease(seg(u,0.35,0.5)));P[off+si][0]+=Math.sin(e/70)*2*(uB>0&&uB<1)}
    else{if(si!==0)pass.push([0.45,si])}
    const rimShot=['dunk','alley','rim','and1','ankle','putback','clutch'].includes(E.kind)&&!(E.kind==='clutch'&&styleOf(sp).three);
    const spd=p=>{const st=styleOf(p);return st.guard?1:st.big?0.78:0.9};
    if(E.kind==='steal'){
      // a pass gets picked off; the thief leads the break, the passer chases, the thief's wings fill the lanes
      const th=idx(E.side,E.p),run=!right,lead=[hoop(run)[0]+(run?-10:10),HY],passFrom=P[off+0],passTo=P[off+si],iu=0.55,pick=L2(passFrom,passTo,0.55);
      ro[def].forEach((p,i)=>{P[def+i]=L2(P[def+i],guardAt(P[off+i],right,12),uA)});
      if(u<iu){ball=u>0.42?[...L2(passFrom,passTo,seg(u,0.42,iu)*0.55),5]:[passFrom[0]+(right?3:-3),passFrom[1]+2,Math.abs(Math.sin(e/85))*3];
        P[def+th]=L2(P[def+th],pick,ease(seg(u,0.38,iu)))}
      else{const ru=seg(u,iu,1)+(pu*0.3),dir=run?1:-1;
        P[E.side+th]=L2(pick,lead,ease(cl01(ru)));const lp=P[E.side+th];
        P[off+0]=L2(passFrom,[lp[0]-dir*16,lp[1]+7],ease(cl01(ru*0.93)));
        const mates=ro[E.side].map((p,i)=>i).filter(i=>i!==th).sort((x,y)=>spd(ro[E.side][y])-spd(ro[E.side][x]));
        const lanes=[[at(run,34,38),1],[at(run,34,162),1],[at(run,95,HY+8),0.85],[at(run,150,HY-20),0.7]];
        mates.forEach((i,k)=>{const [tg,w]=lanes[k];P[E.side+i]=L2(P[E.side+i],tg,ease(cl01(ru*spd(ro[E.side][i])*1.05*w)))});
        ro[off].forEach((p,i)=>{if(i===0)return;P[off+i]=L2(P[off+i],at(run,60+i*16,HY+(i-2)*28),ease(cl01(ru*spd(p)*0.85)))});
        ball=[lp[0]+dir*3,lp[1]+2,Math.abs(Math.sin(e/75))*3];hl=E.side+th;
        if(E.chase){const ch=idx(off,E.chase),cs=P[off+ch],cu=cl01(ru*1.2);P[off+ch]=L2(cs,[lp[0]-dir*7,lp[1]-5],ease(cu));
          if(ru>0.85){const v=cl01((ru-0.85)/0.15+pu);ball=[lp[0]-dir*v*40,lp[1]+v*36,10*(1-v)];hl=off+ch;flash=['🚫 追魂鍋！',Math.min(1,v)]}
          else if(ru<0.35)flash=['🧤 抄截！',ru/0.35]}
        else if(ru<0.35)flash=['🧤 抄截！',ru/0.35];else if(pu)flash=['⚡ 快攻得手！',pu]}
    }else{
      // ---- offense: passes, the shot, bigs crash the glass ----
      let h=0,t0=-1;for(const [t,to] of pass){if(u>=t){h=to;t0=t}}
      const pi=pass.findIndex(x=>x[0]===t0),fromI=pi>0?pass[pi-1][1]:0;
      if(rimShot)P[off+si]=L2(P[off+si],[H[0]+(right?-9:9),HY+3],ease(uC));else P[off+si]=L2(P[off+si],spot,ease(seg(u,0.6,0.75)));
      // signature footwork
      const away=right?-1:1,base=[P[off+si][0],P[off+si][1]],me=P[off+si]=[P[off+si][0],P[off+si][1]];
      if(mv==='fade'&&u>0.7)me[0]+=away*11*ease(seg(u,0.72,0.86));
      if(mv==='step'&&u>0.6)me[0]+=away*15*ease(seg(u,0.6,0.7));
      if(mv==='spin'&&u>0.5&&u<0.82){const a2=seg(u,0.5,0.8)*Math.PI*2;me[0]+=(Math.cos(a2)-1)*9*away;me[1]+=Math.sin(a2)*9}
      if(mv==='euro'&&u>0.6&&u<0.95)me[1]+=Math.sin(seg(u,0.6,0.95)*Math.PI*2)*11;
      const shotU=rimShot?0.95:0.82;
      ro[off].forEach((p,i)=>{if(i!==si&&peOf(p)>=4&&u>shotU-0.08)P[off+i]=L2(P[off+i],at(right,20,HY+(i===4?16:-16)),ease(seg(u,shotU-0.08,1)))});
      const flying=t0>=0&&u-t0<0.06;
      if(flying){const a2=P[off+fromI],b2=P[off+h],v=(u-t0)/0.06;ball=[lerp(a2[0],b2[0],v),lerp(a2[1],b2[1],v),6*Math.sin(Math.PI*v)]}
      else if(u<shotU){const q=P[off+h];ball=[q[0]+(right?3:-3),q[1]+2,Math.abs(Math.sin(e/85))*3]}
      else{const v=seg(u,shotU,1),q=P[off+si];ball=[lerp(q[0],H[0],v),lerp(q[1],HY,v),Math.sin(Math.PI*v)*(E.kind==='three'||E.kind==='logo'?26:rimShot?4:16)*(mv==='hook'?2:1)]}
      const bp=flying?P[off+h]:(ball?[ball[0],ball[1]]:P[off+h]);
      // ---- defense: man-to-man that sags off non-shooters, helps from the weak side, rotates, switches and closes out ----
      const D={};ro[def].forEach((p,i)=>{const man=P[off+i],mp=ro[off][i],thr=styleOf(mp).three,onBall=i===h,near=Math.abs(man[1]-bp[1])<55;
        let g=guardAt(man,right,onBall?6:thr?9:near?14:24);
        if(!onBall&&!near)g=L2(g,[lerp(bp[0],H[0],0.55),lerp(bp[1],HY,0.6)],0.38);D[i]=g});
      if(type==='pnr'){const scr=si===big?3:big,a0=ro[def][0],aS=ro[def][scr],sw=canPlay(a0).length>=3&&canPlay(aS).length>=3;
        if(sw&&u>0.5){const t=ease(seg(u,0.5,0.6));D[0]=L2(D[0],guardAt(P[off+scr],right,8),t);D[scr]=L2(D[scr],guardAt(P[off+0],right,6),t)}
        else if(u>0.42&&u<0.72){D[scr]=L2(D[scr],P[off+0],0.55*Math.sin(Math.PI*seg(u,0.42,0.72)))}}
      if(type==='swing'&&t0>=0&&pi===pass.length-1){const cu=seg(u,t0,t0+0.16);D[si]=L2([lerp(bp[0],H[0],0.5),lerp(bp[1],HY,0.5)],guardAt(P[off+si],right,5),ease(cu))}
      if(rimShot&&u>0.55){let best=-1,bv=-1;ro[def].forEach((p,i)=>{if(i===si)return;const v=num(p.blkp,1)+peOf(p);if(v>bv){bv=v;best=i}});
        if(best>=0)D[best]=L2(D[best],[lerp(P[off+si][0],H[0],0.45),lerp(P[off+si][1],HY,0.45)],ease(seg(u,0.55,0.85)))}
      // contest: normally a step off the shooter; fadeaways / step-backs create space unless the defender is an athletic freak
      if(type==='offball'&&trail&&u<0.7)D[si]=[trail[0]+(right?6:-6),trail[1]+4];
      const cst=mv==='step'?0.6:0.7;if(!rimShot&&u>cst){const freak=ATHL.has((ro[def][si]||{}).id),sep=(mv==='fade'||mv==='step')?(freak?9:20):type==='offball'?(freak?10:18):9;
        const from=(mv==='fade'||mv==='step')?base:P[off+si],dx=H[0]-from[0],dy=HY-from[1],dd=Math.hypot(dx,dy)||1;
        D[si]=L2(D[si],[from[0]+dx/dd*sep,from[1]+dy/dd*sep-2],ease(seg(u,cst,cst+0.1)))}
      if(u>shotU)ro[def].forEach((p,i)=>{if(peOf(p)>=4&&i!==si)D[i]=L2(D[i],at(right,13,HY+(i%2?11:-11)),ease(seg(u,shotU,1)))});
      if(mv==='cross'&&u>0.55){D[si]=[D[si][0]-away*4,D[si][1]+16*ease(seg(u,0.55,0.66))];fallen=def+si}
      ro[def].forEach((p,i)=>{P[def+i]=L2(P[def+i],D[i],uA<1?uA*0.92:1)});
      if(E.kind==='block'&&u>0.8){const bl=idx(E.side,E.p);P[E.side+bl]=L2(P[E.side+bl],P[off+si],0.85);hl=E.side+bl;
        if(u>0.9||pu){const v=pu||0;ball=[P[off+si][0]+(right?-1:1)*v*60,P[off+si][1]+v*44,8*(1-v)];flash=['🚫 火鍋！',Math.max(seg(u,0.9,1)*0.3,v)]}}
      else{hl=off+si;if(pu){ball=[H[0],HY+pu*4,0];flash=[`${KICO[E.kind]||'🏀'} +${KPTS[E.kind]||2}`,pu]}}
    }}
  }else if(E&&DEAD.has(E.kind)&&e>E.T-400){banner=[`${KICO[E.kind]||''} ${{ot:'延長賽！',timeout:'暫停',run:'攻勢！',hot:'手感發燙',boom:'生涯之夜！',takeover:'接管比賽！',tech:'技術犯規',foul:'犯規麻煩',foulout:'犯滿離場',eject:'驅逐出場！',rest:'提前收工'}[E.kind]||''}`,cl01((e-E.T+400)/(PB_POST+400))]}
  if(E&&E.kind==='clutch'&&e>E.T)banner=['🏆 致勝球！',cl01((e-E.T)/PB_POST)];
  // camera: zoom in on the action during key moments
  const wa=warpAt(G,e),ww=wa.w;let zf=1,fx=CW/2,fy=HY;
  if(ww&&ww.zoom&&!done){const r=Math.min(cl01((e-ww.a)/450),cl01((ww.b-e)/450));zf=1+0.5*ease(r);const f=ball||[CW/2,HY];fx=f[0];fy=f[1]}
  const vw=CW/zf,vh=CH/zf;fx=Math.max(vw/2,Math.min(CW-vw/2,fx));fy=Math.max(vh/2,Math.min(CH-vh/2,fy));
  ctx.setTransform(k*zf,0,0,k*zf,k*(CW/2-fx*zf),k*(CH/2-fy*zf));court(ctx);
  const curOff=E&&!DEAD.has(E.kind)?(E.kind==='block'||E.kind==='steal'?(E.side===z.a?z.b:z.a):E.side):null;
  // draw players; offense names under the dots, defense names above (smaller)
  const lab=p=>shortName(p);
  [z.a,z.b].forEach(s=>ro[s].forEach((p,i)=>{const q=P[s+i];if(!q)return;const star=styleOf(p).star;if(fallen===s+i){ctx.save();ctx.globalAlpha=0.55}
    ctx.beginPath();ctx.arc(q[0],q[1]+1.6,7.5,0,7);ctx.fillStyle='rgba(0,0,0,.16)';ctx.fill();
    ctx.beginPath();ctx.arc(q[0],q[1],7,0,7);ctx.fillStyle=C[s];ctx.fill();ctx.lineWidth=hl===s+i?2.6:1.6;ctx.strokeStyle=hl===s+i?'#ffcf33':star?'#ffe9a8':'#fff';ctx.stroke();
    ctx.font='800 8.5px "Barlow Condensed","Noto Sans TC",system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='top';ctx.lineJoin='round';
    const t=lab(p),offNow=curOff?s===curOff:true,ty=offNow?q[1]+8.5:q[1]-17;ctx.globalAlpha=offNow||hl===s+i?1:0.7;if(!offNow)ctx.font='700 7.5px "Barlow Condensed","Noto Sans TC",system-ui,sans-serif';
    ctx.lineWidth=3;ctx.strokeStyle='rgba(20,26,46,.88)';ctx.strokeText(t,q[0],ty);ctx.fillStyle='#fff';ctx.fillText(t,q[0],ty);ctx.globalAlpha=1;if(fallen===s+i){ctx.restore();ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('😵',q[0]+10,q[1]-10)}}));
  if(!ball&&!done){const E2=E||{},off=E2.side||z.a,q=P[off+0]||P[z.a+0];if(q)ball=[q[0]+4,q[1]+2,Math.abs(Math.sin(e/90))*3]}
  if(ball)drawBall(ctx,ball[0],ball[1],ball[2]);
  // signature moment: big sticker over the player who owns it
  if(E&&E.sig&&!done&&e>E.T-700&&e<E.T+PB_POST+500){let q=null;[z.a,z.b].forEach(s=>ro[s].forEach((p,i)=>{if(p.n===E.sp)q=P[s+i]}));
    if(q){const v=cl01((e-E.T+700)/(PB_POST+1200)),bob=Math.sin(e/120)*2,ico=E.ico||SIGICO[E.sid]||'⭐';ctx.save();ctx.translate(q[0],q[1]-24+bob);
      if(SIGMOVE[E.sid]==='wag')ctx.rotate(Math.sin(e/90)*0.6);const sc=v<0.15?v/0.15*1.4:1.4-(v-0.15)*0.3;ctx.scale(sc,sc);ctx.globalAlpha=v>0.85?(1-v)/0.15:1;
      ctx.font='18px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ico,0,0);ctx.restore()}}
  ctx.setTransform(k,0,0,k,0,0);
  if(E&&E.sig&&!done&&e>E.T-700&&e<E.T+PB_POST+500){const lab=`⭐ 招牌：${E.sig}`;ctx.save();ctx.font='900 12px system-ui,sans-serif';const tw=ctx.measureText(lab).width+18;
    ctx.fillStyle='rgba(255,207,51,.95)';ctx.beginPath();ctx.roundRect?ctx.roundRect(CW/2-tw/2,8,tw,20,10):ctx.rect(CW/2-tw/2,8,tw,20);ctx.fill();
    ctx.fillStyle='#4a3200';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lab,CW/2,18.5);ctx.restore()}
  if(flash)pop(ctx,CW/2,44,flash[0],flash[1],18);if(banner)pop(ctx,CW/2,HY,banner[0],banner[1],18);
  if(ww&&ww.lab&&!done){ctx.save();ctx.globalAlpha=0.6+0.4*Math.abs(Math.sin(Date.now()/300));ctx.font='900 11px system-ui,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.lineWidth=3;ctx.strokeStyle='rgba(20,26,46,.85)';ctx.strokeText(ww.lab+(ww.rate<1?'・慢動作':''),10,CH-12);ctx.fillStyle='#ffcf33';ctx.fillText(ww.lab+(ww.rate<1?'・慢動作':''),10,CH-12);ctx.restore()}
  })}
/* the ball: orange leather with a light spot, and the black seams of a basketball (one straight seam each way and
   two curved ones), turning as it travels so a dribble or a pass reads as a spinning ball */
function drawBall(ctx,x,y,h){const R=4.8+h*0.09,cy=y-h;ctx.beginPath();ctx.ellipse(x,y+h*0.25+2,Math.max(2.2,4-h*0.05),Math.max(1.2,2-h*0.03),0,0,7);ctx.fillStyle=`rgba(0,0,0,${Math.max(.08,.2-h*.004)})`;ctx.fill();
  ctx.save();ctx.translate(x,cy);ctx.rotate((x*0.11+y*0.07+h*0.2)%(Math.PI*2));
  const gr=ctx.createRadialGradient(-R*0.35,-R*0.4,R*0.15,0,0,R);gr.addColorStop(0,'#ffb067');gr.addColorStop(0.55,'#ef7a22');gr.addColorStop(1,'#c4561a');
  ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.fillStyle=gr;ctx.fill();ctx.save();ctx.clip();
  ctx.strokeStyle='#3a1a08';ctx.lineWidth=Math.max(.55,R*0.12);ctx.lineCap='round';ctx.beginPath();
  ctx.moveTo(-R,0);ctx.lineTo(R,0);ctx.moveTo(0,-R);ctx.lineTo(0,R);
  ctx.moveTo(-R*0.62,-R*0.82);ctx.quadraticCurveTo(-R*0.12,0,-R*0.62,R*0.82);ctx.moveTo(R*0.62,-R*0.82);ctx.quadraticCurveTo(R*0.12,0,R*0.62,R*0.82);ctx.stroke();ctx.restore();
  ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.strokeStyle='#6a2e08';ctx.lineWidth=.8;ctx.stroke();ctx.restore()}
function pop(ctx,x,y,txt,u,size){const sc=u<.25?u/.25*1.2:1.2-(u-.25)*.27;ctx.save();ctx.globalAlpha=u>.8?(1-u)/.2:1;ctx.translate(x,y-u*8);ctx.scale(sc,sc);
  ctx.font=`900 ${size||16}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=4;ctx.strokeStyle='rgba(255,255,255,.92)';ctx.strokeText(txt,0,0);ctx.fillStyle='#1c2333';ctx.fillText(txt,0,0);ctx.restore()}
requestAnimationFrame(courtFrame);
function vPlayback(){const g=S.game,st=pbState();if(!st){pbStart();return vPlayback()}
  const {L,G,e,P,pe,done}=st,z=G.z,two=g.sides.length===2,ns=S.sim.series.length;
  const qa=G.q[0],qb=G.q[1],shown=()=>{const full=Math.floor(pe);let a=0,b=0;for(let i=0;i<P;i++){if(i<full){a+=qa[i];b+=qb[i]}else if(i===full){const f=pe-full;a+=Math.floor(qa[i]*f);b+=Math.floor(qb[i]*f)}}return[a,b]};
  const [ca,cb]=done?[G.sa,G.sb]:shown();
  const per=Math.min(P-1,Math.floor(pe)),pf=pe-Math.floor(pe),plen=per<4?12:5,left_=done?0:Math.max(0,plen*(1-pf));
  const perLab=i=>i<4?`第 ${i+1} 節`:(P>5?`延長 ${i-3}`:'延長賽');
  const clk=done?'終場':`${perLab(per)}・${Math.floor(left_)}:${String(Math.floor((left_%1)*60)).padStart(2,'0')}`;
  const evs=G.ev.filter(x=>(x.q+x.t)<=pe).slice().reverse().slice(0,4);
  const prevW=L.filter(x=>x.z===z&&x.gi<G.gi),wa=prevW.filter(x=>x.sa>x.sb).length+(done&&G.sa>G.sb?1:0),wb=prevW.filter(x=>x.sb>x.sa).length+(done&&G.sb>G.sa?1:0);
  const dots=s=>[0,1,2,3].map(i=>`<i class="${i<(s===z.a?wa:wb)?'on':''}" style="--c:${col(s)}"></i>`).join('');
  const qt=`<table class="qt"><tr><th></th>${qa.map((_,i)=>`<th>${i<4?i+1:'OT'}</th>`).join('')}<th>總</th></tr>
    ${[[z.a,qa,ca],[z.b,qb,cb]].map(([s,q,c])=>`<tr><td style="color:${col(s)}">${esc(nm(S,s))}</td>${q.map((x,i)=>`<td>${i<Math.floor(pe)||done?x:''}</td>`).join('')}<td><b>${c}</b></td></tr>`).join('')}</table>`;
  const win=G.sa>G.sb?z.a:z.b,over=Math.max(G.wa,G.wb)===4;
  const final=done?`<div class="pbfin" id="fin-${g.gid}-${G.si}-${G.gi}">
      <div class="small mut">本場最佳</div><div class="pog"><b style="color:${col(G.pog.s)}">${esc(G.pog.n)}</b> ${G.pog.pts} 分 ${G.pog.reb} 籃板 ${G.pog.ast} 助攻${G.pog.blk>=3?` ${G.pog.blk} 阻攻`:''}${G.pog.stl>=3?` ${G.pog.stl} 抄截`:''}</div>
      <div class="ser">${over?`🏁 系列賽結束：<b style="color:${col(win)}">${esc(nm(S,win))}</b> ${Math.max(G.wa,G.wb)}–${Math.min(G.wa,G.wb)} 勝出`:G.wa===G.wb?`系列賽 ${G.wa}–${G.wb} 平手`:`<b style="color:${col(G.wa>G.wb?z.a:z.b)}">${esc(nm(S,G.wa>G.wb?z.a:z.b))}</b> 系列賽 ${Math.max(G.wa,G.wb)}–${Math.min(G.wa,G.wb)} 領先`}</div></div>`:'';
  const isLast=ui.pb.k===L.length-1,gNo=ui.pb.k+1;
  return `<div class="pb">
    <div class="pbh"><span class="small mut">${two?'七戰四勝系列賽':`循環賽 第 ${G.si+1}/${ns} 組`}・第 ${G.gi+1} 場</span><button class="skipall" data-act="pbskip">跳過全部 ⏭</button></div>
    <div class="sb2"><div class="tm"><div class="tn" style="color:${col(z.a)}">${esc(nm(S,z.a))}</div><div class="dots">${dots(z.a)}</div></div>
      <div class="mid"><div class="scr"><span style="color:${col(z.a)}">${ca}</span><i>:</i><span style="color:${col(z.b)}">${cb}</span></div><div class="clk ${done?'end':''}">${clk}</div></div>
      <div class="tm"><div class="tn" style="color:${col(z.b)}">${esc(nm(S,z.b))}</div><div class="dots">${dots(z.b)}</div></div></div>
    <div class="courtw"><canvas id="court" width="${CW*2}" height="${CH*2}" aria-label="比賽動畫"></canvas></div>
    ${done?final:`<div class="feed">${evs.map(x=>`<div class="ev ${x.sig?'sigev':''}" id="ev-${g.gid}-${G.si}-${G.gi}-${G.ev.indexOf(x)}" style="${x.side?`border-left-color:${col(x.side)}`:''}"><span class="t">${x.q<4?'Q'+(x.q+1):'OT'} ${x.clk}</span><span class="ic">${x.sig?(x.ico||SIGICO[x.sid]||'⭐'):(KICO[x.kind]||'🏀')}</span>${x.sig?`<b class="sgl">⭐ ${esc(x.sig)}</b>`:''}${esc(x.txt)}</div>`).join('')||'<div class="small mut" style="text-align:center;padding:12px">跳球，比賽開始！</div>'}</div>`}
    ${qt}
    <div class="pbc"><button class="ghost" data-act="pbsp">⏩ ${ui.pb.sp}x</button>
      <button class="big" data-act="pbnext">${done?(isLast?'看最終結算 →':'下一場 →'):'⏭ 跳過這場'}</button></div>
    <div class="small mut" style="text-align:center;margin-top:6px">第 ${gNo} / ${L.length} 場</div></div>`}
function boLine(z,k){const has=A=>A&&A.some(x=>x&&Object.keys(x).length);if(!has(z.bo)&&!has(z.tk))return '';let L=[];try{L=pbData().filter(G=>G.si===k)}catch(e){}
  const row=(A,lab)=>{if(!has(A))return '';const items=[];A.forEach((bg,gi)=>Object.entries(bg||{}).forEach(([s,n])=>{const G=L.find(x=>x.gi===gi),b=G&&(s===z.a?G.bA:G.bB).find(x=>x.n===n);
    items.push(`<span style="color:${col(s)}">G${gi+1} ${esc(String(n).split(' ').slice(-1)[0])}${b?` ${b.pts} 分`:''}</span>`)}));
    return `<div class="small" style="margin-top:4px">${lab}：${items.join('・')}</div>`};
  return row(z.tk,'球星接管')+row(z.bo,'爆發之夜')}
function vResults(){
  const g=S.game,sim=S.sim,r=myRole();if(!sim)return `<div class="center mut" style="margin-top:60px"><span class="spin"></span> 模擬中…</div>`;
  if(!ui.pbDone.has(g.gid))return vPlayback();
  const id=g.gid,sides=g.sides,T=sim.teams,N=s=>`<b style="color:${col(s)}">${esc(nm(S,s))}</b>`;
  const champ=sim.champ,two=sides.length===2,z0=sim.series[0];
  const head=two?`<div class="champ rs" style="--d:1.5s"><div class="t">CHAMPION</div><div class="w">🏆 ${N(champ)}</div><div class="small mut">七戰四勝系列賽 ${Math.max(z0.wa,z0.wb)}–${Math.min(z0.wa,z0.wb)}${z0.upset?'・😱 爆冷！':''}</div></div>`
    :`<div class="champ rs" style="--d:1.5s"><div class="t">CHAMPION</div><div class="w">🏆 ${N(champ)}</div><div class="small mut">三隊循環賽，系列賽勝場最多</div></div>`;
  const ser=sim.series.map((z,k)=>{const pA=Math.round(z.p*100);return `<div class="series"><div class="grow">${N(z.a)} <span class="mut small">vs</span> ${N(z.b)}
      <div class="gms">${z.games.map(([x,y,ot])=>`<span style="color:${x>y?col(z.a):col(z.b)}">${x}–${y}${ot?' OT':''}</span>`).join('')}</div>
      ${(z.inc||[]).some(x=>x.some(i=>i.kind!=='tech'&&i.kind!=='trouble'))?`<div class="small" style="margin-top:4px;color:#ffb4a8">${z.inc.flatMap((x,gi)=>x.filter(i=>i.kind==='eject'||i.kind==='foulout').map(i=>`${i.kind==='eject'?'🟥':'❌'} G${gi+1} ${esc(String(i.n).split(' ').slice(-1)[0])} ${i.kind==='eject'?'被驅逐':'犯滿'}`)).join('・')}</div>`:''}
      ${boLine(z,k)}<div class="small mut" style="margin-top:2px">單場勝率 ${pA}% : ${100-pA}%・系列賽 ${Math.round(z.pser*100)}% : ${100-Math.round(z.pser*100)}%${z.upset?'・<b style="color:var(--gold)">爆冷</b>':''}</div></div>
      <div class="sc"><span id="s${k}a-${id}" data-count="${z.wa}" data-delay="${ui.pbFast?0.5:2.0}" style="color:${col(z.a)}">${z.wa}</span>–<span id="s${k}b-${id}" data-count="${z.wb}" data-delay="${ui.pbFast?0.5:2.0}" style="color:${col(z.b)}">${z.wb}</span></div></div>`}).join('');
  const std=two?'':`<table class="std"><tr><th>排名</th><th>系列勝</th><th>場次</th><th>實力</th></tr>${sim.order.map((s,i)=>`<tr><td>${i+1}. ${N(s)}</td><td>${T[s].sw}</td><td>${T[s].gw}–${T[s].gl}</td><td>${T[s].grade}</td></tr>`).join('')}</table>`;
  const board=`<div class="board rs" style="--d:1.8s"><div class="lab">${two?'系列賽':'循環賽'}</div><div style="text-align:left;margin-top:6px">${ser}</div>${std}
    ${sim.mvp?`<div class="small mut" style="margin-top:8px">冠軍 MVP：${esc(sim.mvp.n)}（決勝場 ${sim.mvp.pts} 分 ${sim.mvp.reb} 籃板 ${sim.mvp.ast} 助攻）</div>`:''}</div>`;
  const teamBlock=(s,d0)=>{const R=rosterOf(g,s),t=T[s];
    const rows=R.map((p,i)=>{const pi=posInfo(p,p.slot);return `<div class="srow ${s} rs ${isBench(p.slot)?'bench':''}" style="--d:${(d0+0.1*i).toFixed(2)}s"><div class="sl">${isBench(p.slot)?roleLab(p.role,true):esc(p.slot)}</div><div class="bd"><span class="pr">$${p.price}</span><div class="nm">${esc(p.n)}</div>
      <div class="sb">${esc(sub(p))}${p.est&&p.est.length?' · 估':''}${pi.tier>0?`<i class="tag t${pi.tier}">${pi.lab}</i>`:''}</div>
      <div class="st">${[['pts','PPG'],['trb','RPG'],['ast','APG'],['stl','SPG'],['blk','BPG']].map(([k,l])=>`<div><b>${fmt(p[k])}</b><i>${l}</i></div>`).join('')}</div></div></div>`}).join('');
    return `<div class="teamhead ${s} rs" style="--d:${(d0-0.1).toFixed(2)}s"><span class="nm">${esc(nm(S,s))}</span><span class="grow small mut">花 $${g.spent[s]}・剩 $${left(g,s)}</span><span class="grade">${t.grade}</span><span class="pct">贏過本主題 ${t.pct}% 的隨機陣容</span></div>${rows}`};
  let d=2.6;const blocks=sim.order.map(s=>{const h=teamBlock(s,d);d+=0.6;return h}).join('');
  const chemCard=`<section class="card rs" style="--d:${d}s"><h2>🧪 化學反應</h2>${sides.map(s=>{const c=T[s].chem,L=[];const ps=[...c.pairs].sort((x,y)=>y.k-x.k);
      (c.lg||[]).forEach(x=>L.push(`<div class="lgline">${x.ic} <b>傳奇組合・${esc(x.nm)}</b> <b class="lgv">+${x.v}</b><div class="small mut">${x.ns.map(esc).join('・')}</div></div>`));
      ps.slice(0,3).forEach(p=>L.push(`<div>🤝 ${esc(p.a)} ＋ ${esc(p.b)}：真實隊友 ${p.k} 季</div>`));if(ps.length>3)L.push(`<div class="small mut">…還有 ${ps.length-3} 組${c.tm>=2.5?'（已達上限）':''}</div>`);
      if(c.sw)L.push(`<div>🔄 全員換防：${c.swN} 人能守 3 個以上位置</div>`);
      c.feuds.forEach(f=>L.push(`<div>⚡ ${esc(f.a)} ✕ ${esc(f.b)}${f.lv===2?'（嚴重）':''}<div class="small mut">${esc(f.t)} ${FEUDS.some(x=>x.u===f.u)?`<a href="${esc(f.u)}" target="_blank" rel="noopener noreferrer">來源</a>`:''}</div></div>`));
      return `<div class="chemt">${N(s)}${L.join('')||'<div class="small mut">沒有特別的化學反應</div>'}</div>`}).join('')}${!tmOn(g)?'<div class="small mut" style="margin-top:6px">單季陣容主題大家本來就是隊友，不計隊友默契。</div>':''}</section>`;
  const pc=v=>`${v>1?'+':''}${Math.round((v-1)*100)}%`;
  const why=(n,m)=>{const L=[];if(m.why.includes('speed'))L.push(`速度優勢 得分 <b class="up">${pc(m.pts)}</b>`);if(m.why.includes('post'))L.push(`體型優勢 得分 <b class="up">${pc(m.pts)}</b>、籃板 <b class="up">${pc(m.reb)}</b>`);
    if(m.why.includes('speed')&&m.reb<0.99)L.push(`籃板 <b class="dn">${pc(m.reb)}</b>`);if(m.why.includes('size'))L.push(`守禁區吃力、阻攻 <b class="dn">${pc(m.blk)}</b>`);if(m.why.includes('handle'))L.push(`運球推進失誤 <b class="dn">${pc(m.tov)}</b>`);
    if(m.why.includes('stretch'))L.push(`外線拉開空間 得分 <b class="up">${pc(m.pts)}</b>、離籃框遠籃板 <b class="dn">${pc(m.reb)}</b>`);if(m.why.includes('pulled'))L.push(`被拉出禁區 阻攻 <b class="dn">${pc(m.blk)}</b>、卡位搶籃板 <b class="up">${pc(m.reb)}</b>`);
    return L.length?`<div class="small">${esc(n)}：${L.join('、')}</div>`:''};
  const muCard=sim.series.some(z=>z.mu.length)?`<section class="card rs" style="--d:${d+0.1}s"><h2>🆚 位置與對位</h2>${sim.series.map(z=>z.mu.length?`<details ${sim.series.length===1?'open':''} style="margin-top:6px"><summary class="small">${esc(nm(S,z.a))} vs ${esc(nm(S,z.b))}</summary>${z.mu.map(m=>{const v=m.fa-m.fb;
      return `<div class="mis"><div><b>${m.slot}</b>｜<span style="color:${col(z.a)}">${esc(m.a)}</span> vs <span style="color:${col(z.b)}">${esc(m.b)}</span> <i class="tag t1">${Math.abs(v)<0.5?'互有勝負':esc(nm(S,v>0?z.a:z.b))+' 佔上風'}</i></div>${why(m.a,m.ma)}${why(m.b,m.mb)}</div>`}).join('')}</details>`:'').join('')}</section>`:'';
  const rowT=(lab,expl,f)=>{const vals=sides.map(f),mx=Math.max(...vals);return `<tr><td>${lab}<small>${expl}</small></td>${vals.map(v=>`<td class="${Math.abs(v-mx)<0.05&&vals.some(x=>Math.abs(x-v)>0.05)?'w':''}">${(v>0?'+':'')+v.toFixed(1)}</td>`).join('')}</tr>`};
  const cmp=`<section class="card rs" style="--d:${d+0.2}s"><h2>⚖️ 實力拆解（每 100 回合淨勝分）</h2><table class="cmp"><tr><th></th>${sides.map(s=>`<th style="color:${col(s)}">${esc(nm(S,s))}</th>`).join('')}</tr>
    ${rowT('進攻影響力','得分效率、助攻、失誤、進攻籃板（OBPM）',s=>T[s].base.O)}
    ${rowT('防守影響力','抄截、阻攻、防守籃板（DBPM）',s=>T[s].base.D)}
    ${rowT('球權重疊',`使用率合計 ${sides.map(s=>Math.round(T[s].base.U)+'%').join(' / ')}`,s=>T[s].base.usgAdj)}
    ${rowT('位置與對位','平均每場對位結果',s=>T[s].posAdj)}
    ${rowT('隊友默契','真實當過隊友',s=>T[s].base.tmAdj)}
    ${sides.some(s=>T[s].base.lgAdj)?rowT('傳奇組合','三巨頭／王朝核心',s=>T[s].base.lgAdj||0):''}
    ${rowT('全員換防','五人都能守多位置',s=>T[s].base.swAdj)}
    ${rowT('更衣室不合','有記錄的隊內不合',s=>T[s].base.fdAdj)}
    ${g.size===10?rowT('替補深度','5 位替補比起板凳等級球員',s=>T[s].base.benchAdj||0):''}
    ${rowT('省錢紅利','剩下的錢',s=>T[s].base.savAdj)}
    ${S.game.cards?rowT('🏟️ 主場優勢','能力卡',s=>T[s].base.hcAdj||0):''}
    ${g.misRes?rowT('任務獎勵','完成任務的加成',s=>T[s].base.misAdj||0):''}
    ${rowT('<b>總評</b>','',s=>T[s].base.net+T[s].posAdj)}</table>
    <div class="small mut" style="margin-top:8px">每 1 分總評差距 ≈ 每場多贏 0.8 分（用 1,230 支真實球隊校正）。單場有約 ±13 分的運氣，所以系列賽也可能爆冷。</div></section>`;
  const boxT=(z,s)=>`<table class="box"><tr><th>${esc(nm(S,s))}</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th></tr>${z.box[s].map(x=>`<tr><td>${esc(isBench(x.slot)?'替':x.slot)} ${esc(x.n)}</td><td>${x.pts}${ar(x,'pts')}</td><td>${x.reb}${ar(x,'reb')}</td><td>${x.ast}${ar(x,'ast')}</td><td>${x.stl}${ar(x,'stl')}</td><td>${x.blk}${ar(x,'blk')}</td><td>${x.tov}${ar(x,'tov',1)}</td></tr>`).join('')}</table>`;
  const owned=new Set(sides.flatMap(s=>g.rosters[s].map(x=>g.items[x.k].n)));const leftover=g.pool.map(p=>p.n).filter(n=>!owned.has(n));
  const isP=r==='all'||ALL.includes(r);
  return `  <div class="reveal rs" style="--d:1.3s"><div class="lab">THE THEME WAS</div><div class="tn">${esc(g.theme.name)}</div>${g.theme.tag?`<div class="tt">${esc(g.theme.tag)}</div>`:''}<div class="tt" style="margin-top:6px">比的是各自在當年的統治力（以當年聯盟平均為基準）</div></div>
  ${head}${seasonGain(g,sim)}${board}${misResults(g,2.4)}${blocks}${chemCard}${muCard}${cmp}
  <section class="card rs" style="--d:${d+0.3}s">${sim.series.map(z=>`<details style="margin-top:6px"><summary>📊 決勝場 Box Score：${esc(nm(S,z.a))} ${z.games[z.games.length-1][0]}–${z.games[z.games.length-1][1]} ${esc(nm(S,z.b))}</summary>${boxT(z,z.a)}${boxT(z,z.b)}<div class="small mut" style="margin-top:4px">▲▼ 代表因為位置或對位，比他平常明顯多／少。</div></details>`).join('')}
  <details style="margin-top:12px"><summary>🧾 競標紀錄（${g.log.length} 張）</summary><div class="log">${g.log.map((l,k)=>`<div><span>${k+1}. ${esc(l.n)}</span><span style="color:${l.who?col(l.who):'var(--mut)'}">${l.who?esc(nm(S,l.who))+' $'+l.amt:'流標'}</span></div>`).join('')}</div></details>
  ${leftover.length?`<details style="margin-top:12px"><summary>👀 主題裡沒被標走的 ${leftover.length} 位</summary><div class="small" style="margin-top:8px;color:#3d4458">${leftover.map(esc).join('、')}</div></details>`:''}</section>
  <div class="rs" style="--d:${d+0.4}s"><button class="ghost" data-act="copy">📋 複製結果（貼到群組）</button>
  ${g.round?seasonWaitNote():''}${isP?`<button class="big" data-act="again">${g.round?(S.season&&S.season.done?'🏆 看季賽頒獎 →':'🏁 看季賽積分榜 →'):'回到大廳 →'}</button>`:`<button class="big" data-act="specback">${g.round?'看季賽積分榜 →':'回到大廳 →'}</button>`}</div>`;
}
function seasonGain(g,sim){if(!g.round)return '';const se=S.season||S.lastSeason;if(!se)return '';const R=se.rounds.find(x=>x.k===g.round);if(!R)return '';
  return `<div class="sgainc rs" style="--d:1.65s"><div class="small mut">🏁 季賽 第 ${g.round}/${g.rounds} 局・本局積分</div><div class="sgain">${g.sides.map(s=>{const p=R.pts[s];return `<span style="border-color:${col(s)}"><b style="color:${col(s)}">${esc(nm(S,s))} +${p.t}</b>${p.b?` <small>${p.b===3?'冠軍':sim.order.indexOf(s)===1&&g.sides.length===3?'第二':'打滿七場'} +${p.b}</small>`:''}${p.m?` <small>🎯 +${p.m}</small>`:''}</span>`}).join('')}</div></div>`}
function summaryText(){
  const g=S.game,sim=S.sim;let t=`🏀 BALLER BID 球星喊價｜主題：${g.theme.name}\n🏆 冠軍：${nm(S,sim.champ)}\n`;
  sim.series.forEach(z=>t+=`${nm(S,z.a)} ${z.wa}–${z.wb} ${nm(S,z.b)}\n`);
  if(g.misRes)g.sides.forEach(s=>{const x=g.misRes[s];if(x)t+=`🎯 ${nm(S,s)}：${misOf(x.id).nm} ${x.done?'✓ 達成':'✗ 未達成'}\n`});
  g.sides.forEach(s=>{t+=`\n${nm(S,s)}（評級 ${sim.teams[s].grade}・花 $${g.spent[s]}）\n`;rosterOf(g,s).forEach(p=>t+=`  ${isBench(p.slot)?roleLab(p.role):p.slot} ${p.n} $${p.price}\n`)});return t}
async function copyText(txt,okMsg){try{await navigator.clipboard.writeText(txt);toast(okMsg)}catch(e){toast('複製失敗，請長按手動複製')}}

/* ---------- events ---------- */
/* drag a lineup plate onto another to swap them (pointer events, works with touch) */
let drag=null;
document.addEventListener('pointerdown',e=>{const pl=e.target.closest('[data-drag]');if(!pl||!pl.dataset.drag||!e.target.closest('.grip'))return;
  e.preventDefault();const r=pl.getBoundingClientRect();const gh=pl.cloneNode(true);gh.classList.add('ghost2');gh.style.width=r.width+'px';gh.style.left=r.left+'px';gh.style.top=r.top+'px';document.body.appendChild(gh);
  drag={who:pl.dataset.drag,from:pl.dataset.v,gh,dy:e.clientY-r.top,dx:e.clientX-r.left,over:null};pl.classList.add('dragging')});
document.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();drag.gh.style.top=(e.clientY-drag.dy)+'px';drag.gh.style.left=(e.clientX-drag.dx)+'px';
  drag.gh.style.display='none';const el=document.elementFromPoint(e.clientX,e.clientY);drag.gh.style.display='';
  const t=el&&el.closest('[data-drag]');document.querySelectorAll('.plate.over').forEach(x=>x.classList.remove('over'));
  drag.over=t&&t.dataset.drag===drag.who&&t.dataset.v!==drag.from?t.dataset.v:null;if(drag.over)t.classList.add('over')},{passive:false});
document.addEventListener('pointerup',()=>{if(!drag)return;const d=drag;drag=null;d.gh.remove();document.querySelectorAll('.plate.over,.plate.dragging').forEach(x=>x.classList.remove('over','dragging'));
  if(d.over){ui.sel=null;dispatch({a:'swap',who:d.who,x:d.from,y:d.over})}});
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t||t.disabled)return;const a=t.dataset.act,d=t.dataset;
  if(a!=='quit')ui.quit=false;if(a!=='endSeason')ui.endSe=false;
  switch(a){
    case 'local':return startLocal();
    case 'ai':return startAI();
    case 'ailv':return dispatch({a:'ailv',v:d.v});
    case 'aist':return dispatch({a:'aist',s:d.who,v:d.v});
    case 'create':return createRoom();
    case 'join':return joinRoom(document.querySelector('[data-in="code"]').value);
    case 'joinhash':{const m=/^#room-([a-z0-9]{6})(?:-(\d))?$/.exec(location.hash);if(m)joinRoom(m[1],m[2]!=null?+m[2]:undefined);return}
    case 'reload':return location.reload();
    case 'exit':if(!offline())leaveNet();else NET.mode=null;S=null;return render();
    case 'share':{const url=inviteLink(),txt='來玩 BALLER BID 球星喊價！點連結直接加入：';
      if(navigator.share){navigator.share({title:'BALLER BID 球星喊價',text:txt,url}).catch(()=>{})}else copyText(txt+url,'邀請連結已複製 ✅');return}
    case 'copy':return withView(()=>copyText(summaryText(),'已複製 ✅'));
    case 'copyseason':return copyText(seasonText(),'已複製 ✅');
    case 'mstrip':e.preventDefault();ui.mstrip=!ui.mstrip;return render();
    case 'peek':ui.peek=d.who;clearTimeout(ui.peekT);ui.peekT=setTimeout(()=>{ui.peek=null;render()},5000);return render();
    case 'sready':return dispatch({a:'sready',v:d.v==='1'});
    case 'again':ui.backGid=S.last?S.last.game.gid:S.game&&S.game.gid;scrollTo(0,0);return dispatch({a:'again'});
    case 'specback':ui.backGid=S.last?S.last.game.gid:S.game&&S.game.gid;scrollTo(0,0);return render();
    case 'pbsp':case 'pbnext':case 'pbskip':return withView(()=>pbAct(a));
    case 'reveal':ui.reveal.add(d.v);return render();
  }
  function pbAct(a){switch(a){
    case 'pbsp':{const p=ui.pb;if(!p)return;p.sp=ui.pbSp=p.sp>=4?1:p.sp+1;return render()}
    case 'pbnext':{const st=pbState();if(!st)return;if(!st.done){ui.pb.vt=st.P*PB_Q;return render()}return pbNext()}
    case 'pbskip':if(!ui.pbDone.has(S.game.gid))champSound(0.2);ui.pbDone.add(S.game.gid);ui.pbFast=true;ui.pb=null;render();return scrollTo(0,0);
  }}
  switch(a){
    case 'reveal':ui.reveal.add(d.v);return render();
    case 'seat':return dispatch({a:'seat',seat:d.v,name:MYNAME});
    case 'theme':return dispatch({a:'cfg',cfg:{theme:d.id}});
    case 'tmode':return dispatch({a:'cfg',cfg:{theme:d.v}});
    case 'ptog':{const p=new Set(S.cfg.picks||[]);p.has(d.v)?p.delete(d.v):p.add(d.v);return dispatch({a:'cfg',cfg:{picks:[...p]}})}
    case 'pall':{const ids=THEMES.filter(t=>t.cat===(S.cfg.pcat||'夢幻隊')&&t.id!=='usaall').map(t=>t.id);const p=new Set(S.cfg.picks||[]);const all=ids.every(x=>p.has(x));ids.forEach(x=>all?p.delete(x):p.add(x));return dispatch({a:'cfg',cfg:{picks:[...p]}})}
    case 'tdel':return dispatch({a:'cfg',cfg:{teams:(S.cfg.teams||[]).filter(x=>x!==d.v)}});
    case 'tclr':return dispatch({a:'cfg',cfg:{teams:[]}});
    case 'pdel':return dispatch({a:'cfg',cfg:{picks:(S.cfg.picks||[]).filter(x=>x!==d.v)}});
    case 'cat':{const c=new Set(S.cfg.cats);c.has(d.v)?c.delete(d.v):c.add(d.v);return dispatch({a:'cfg',cfg:{cats:[...c]}})}
    case 'cfg':{const val=['showStats','hints','mis','bal','cards','showYr'].includes(d.k)?d.v==='1':['pmode','fmt'].includes(d.k)?d.v:+d.v;return dispatch({a:'cfg',cfg:{[d.k]:val}})}
    case 'csel':{const g=S.game,who=d.who||(NET.mode==='local'?g.sides.find(s=>!g.cards[s].pick):myRole());let L=(ui.csel&&ui.csel.gid===g.gid&&ui.csel.who===who?ui.csel.ids:g.cards[who]&&g.cards[who].pick)||[];L=L.slice();
      const i=L.indexOf(d.v);if(i>=0)L.splice(i,1);else{L.push(d.v);if(L.length>CARD_PICK)L.shift()}ui.csel={gid:g.gid,who,ids:L};return render()}
    case 'cpick':{const g=S.game;const ids=ui.csel&&ui.csel.gid===g.gid&&ui.csel.who===d.who?ui.csel.ids:g.cards[d.who].pick;ui.csel=null;return dispatch({a:'card',id:'pick',who:d.who,ids})}
    case 'cinfo':ui.csheet={who:d.who,id:d.v};return render();
    case 'cclose':ui.csheet=null;return render();
    case 'cuse':{const x=ui.csheet;ui.csheet=null;if(!x)return render();return dispatch({a:'card',id:d.v,who:x.who,t:d.t,idx:S.game.idx})}
    case 'mpick':return dispatch({a:'mpick',who:d.who,i:+d.i});
    case 'endSeason':if(!ui.endSe){ui.endSe=true;return render()}ui.endSe=false;scrollTo(0,0);return dispatch({a:'endSeason'});
    case 'closeSeason':scrollTo(0,0);return dispatch({a:'closeSeason'});
    case 'bid':ui.amt={};return dispatch({a:'bid',who:d.who,amt:+d.amt,idx:S.game.idx});
    case 'bidv':return bidTyped(d.who);
    case 'step':{const g=S.game;ui.amt[d.who]=clamp(amtFor(g,d.who)+(+d.v),g.bid.amt+1,maxBid(g,d.who));const el=document.querySelector(`[data-in="amt"][data-who="${d.who}"]`);if(el)el.value=ui.amt[d.who];return render()}
    case 'pass':return dispatch({a:'pass',who:d.who,idx:S.game.idx});
    case 'lsel':ui.leftSel={gid:S.game.gid,idx:S.game.idx,j:+d.v};return render();
    case 'lpick':if(d.v==='')return;return dispatch({a:'lpick',j:+d.v,who:S.game.solo.who,idx:S.game.idx});
    case 'lnone':if(!ui.lnone){ui.lnone=true;return render()}ui.lnone=false;return dispatch({a:'lnone',who:S.game.solo.who,idx:S.game.idx});
    case 'nompick':ui.nomSel={gid:S.game.gid,idx:S.game.idx,j:+d.v};return render();
    case 'nominate':if(d.v==='')return;return dispatch({a:'nominate',who:S.game.nomBy,j:+d.v,idx:S.game.idx});
    case 'sstep':{const g=S.game,lo=g.tie?g.tie.amt:0,k='s'+g.idx+d.who,cur0=ui.amt[k]!=null?ui.amt[k]:(+(document.querySelector(`[data-in="samt"][data-who="${d.who}"]`)||{}).value||0);ui.amt[k]=clamp(cur0+(+d.v),lo,maxBid(g,d.who));return render()}
    case 'sbid':{const g=S.game,k='s'+g.idx+d.who,el=document.querySelector(`[data-in="samt"][data-who="${d.who}"]`);let v=+d.amt;if(el&&!t.classList.contains('pass'))v=parseInt(el.value,10);
      const lo=g.tie?g.tie.amt:0,mx=maxBid(g,d.who);if(isNaN(v)||v<lo)return toast(`至少 $${lo}`);if(v>mx)return toast(`你最多只能出 $${mx}（要留錢補滿陣容）`);return dispatch({a:'sbid',who:d.who,amt:v,idx:g.idx})}
    case 'rdone':{const g=S.game,me=myRole();return dispatch({a:'rdone',who:me==='all'||!g.sides.includes(me)?g.sides[0]:me})}
    case 'grab':sfx('grab');return dispatch({a:'grab',who:d.who,idx:S.game.idx,p:dutchAt(S.game,now())});
    case 'spass':return dispatch({a:'spass',who:d.who,idx:S.game.idx});
    case 'brole':return dispatch({a:'brole',who:d.who,slot:d.v,role:d.role});
    case 'sfx':{const nx=(SFX.lv+2)%3;sfxSet(nx);toast(['🔇 音效關閉','🔈 音效：小聲','🔊 音效：正常'][nx],1200);if(nx)setTimeout(()=>sfx('bid'),60);return render()}
    case 'lu':{const who=d.who,sl=d.v;if(ui.sel&&ui.sel.who===who){const x=ui.sel.slot;ui.sel=null;if(x===sl)return render();return dispatch({a:'swap',who,x,y:sl})}ui.sel={who,slot:sl};return render()}
    case 'ready':ui.sel=null;return dispatch({a:'ready',who:d.who,v:d.v==='1'});
    case 'quit':if(!ui.quit){ui.quit=true;return render()}ui.quit=false;return dispatch({a:'quit'});
    default:return dispatch({a});
  }
});
let deb={};const debounced=(k,fn,ms=600)=>{clearTimeout(deb[k]);deb[k]=setTimeout(fn,ms)};
document.addEventListener('input',e=>{
  const t=e.target,k=t.dataset.in;if(!k)return;
  if(k==='myname'){MYNAME=clean(t.value);lsSet('bb_name',MYNAME)}
  if(k==='name'){const s=t.dataset.i;S.names[s]=t.value;debounced('names',()=>dispatch({a:'names',[s]:S.names[s]}))}
  if(k==='cname'||k==='ctext'){const c=S.cfg.custom;const nc={name:k==='cname'?t.value:c.name,text:k==='ctext'?t.value:c.text};S.cfg.custom=nc;debounced('custom',()=>dispatch({a:'cfg',cfg:{custom:nc}}),700)}
  if(k==='samt'){const v=parseInt(t.value,10),g=S.game;if(g)ui.amt['s'+g.idx+t.dataset.who]=isNaN(v)?0:v;const go=document.querySelector(`[data-act="sbid"][data-who="${t.dataset.who}"]:not(.pass) small`);if(go)go.textContent='$'+(isNaN(v)?'':v);return}
  if(k==='amt'){const v=parseInt(t.value,10);ui.amt[t.dataset.who]=isNaN(v)?0:v;const go=document.querySelector(`[data-act="bidv"][data-who="${t.dataset.who}"] small`);if(go)go.textContent='$'+(isNaN(v)?'':v);return}
  if(k==='budget'){const v=parseInt(t.value,10);if(v>=5)debounced('budget',()=>dispatch({a:'cfg',cfg:{budget:v}}),700)}
});
function bidTyped(who){const g=S.game;if(!g)return;const el=document.querySelector(`[data-in="amt"][data-who="${who}"]`);const v=el?parseInt(el.value,10):amtFor(g,who),mx=maxBid(g,who);
  if(isNaN(v)||v<=g.bid.amt)return toast(`至少要出 $${g.bid.amt+1}`);if(v>mx)return toast(`你最多只能出 $${mx}（要留錢補滿陣容）`);
  if(el)el.blur();ui.amt={};return dispatch({a:'bid',who,amt:v,idx:g.idx})}
document.addEventListener('change',e=>{const t=e.target,k=t.dataset&&t.dataset.in;if(!k||t.tagName!=='SELECT'||!S)return;const v=t.value,c=S.cfg;
  if(k==='era0'||k==='era1'){const o=c.era?[...c.era]:[null,null];o[k==='era0'?0:1]=v?+v:null;let era=null;
    if(o[0]!=null||o[1]!=null){const a=o[0]!=null?o[0]:o[1],b=o[1]!=null?o[1]:o[0];era=[a,b]}return dispatch({a:'cfg',cfg:{era}})}
  if(k==='team'){if(!v)return;t.value='';return dispatch({a:'cfg',cfg:{teams:[...(c.teams||[]),v]}})}
  if(k==='pcat')return dispatch({a:'cfg',cfg:{pcat:v}});
  if(k==='ptheme'){if(!v)return;t.value='';return dispatch({a:'cfg',cfg:{picks:[...(c.picks||[]),v]}})}
});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.target.dataset)return;if(e.target.dataset.in==='code')joinRoom(e.target.value);if(e.target.dataset.in==='amt')bidTyped(e.target.dataset.who)});
window.addEventListener('hashchange',()=>{if(!NET.mode)render()});

(async()=>{try{await loadData()}catch(e){document.getElementById('app').innerHTML='<div class="err">球員資料載入失敗，請重新整理。</div>';return}render()})();
