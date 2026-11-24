/* ---------- 戰術 (team tactics) ----------
   Each team picks one offense and one defense in the lineup phase. Talent (BPM) stays the base; a tactic adds a small,
   uncertain edge on top:
   - fit: how well the five starters suit the scheme (a five-out offense with non-shooters is worse than none);
   - counters: some offenses tend to do well or badly against some defenses (switching smothers pick-and-roll but
     hands post scorers mismatches; zone and drop pack the paint but give up threes; blitzing a star forces the ball
     to his teammates, which ball-movement teams punish). These are tendencies, not rules: the size depends on how
     well both sides fit their schemes, every game draws its own execution, and a team that loses a game adjusts;
   - variance: three-point-heavy offenses and gambling defenses widen a team's range of scores, fast pace narrows it
     (more possessions, the better team shows through). A weaker team can take on risk on purpose;
   - 核心擋拆 (heliocentric): one creating star with shooters around him plays above the sum of the parts, and that
     star gets more chances to take a game over.
   Magnitudes: fit about -1..+1.5 rating points, the star system up to +1.2, a counter up to about +-1.3, against
   typical team ratings of 15-30, so tactics swing close matchups but do not overturn a clear talent gap. */
const TAC_O={
  five:{nm:'五外拉開',d:'五個人都能站外線，拉開空間找三分和切入',need:'射手，尤其是會投的長人'},
  helio:{nm:'核心擋拆',d:'球交給一位持球核心，其他人拉開等球',need:'一位會組織的球星＋射手，球權不要太分散'},
  post:{nm:'內線強攻',d:'球往禁區送，低位單打、搶進攻籃板',need:'低位得分手、籃板好的長人'},
  run:{nm:'跑轟快攻',d:'搶斷、搶到籃板就全速推進',need:'抄截高手、會傳球的後衛'},
  motion:{nm:'傳導進攻',d:'不停傳球跑位，人人都可能出手',need:'三位以上會傳球的人'}};
const TAC_D={
  switch:{nm:'全員換防',d:'遇到掩護就換人，不讓擋拆成形',need:'能守多個位置的人'},
  drop:{nm:'護框收縮',d:'長人守在籃下，放對手投中距離',need:'護框長人'},
  zone:{nm:'區域聯防',d:'各守一區塞住禁區，藏住弱防守者',need:'護框長人＋外圍有人能抄'},
  blitz:{nm:'包夾壓迫',d:'包夾持球者，逼他把球交出去',need:'抄截高手、防守好的人'}};
const TO_K=Object.keys(TAC_O),TD_K=Object.keys(TAC_D);
// offense advantage before centering (+ = the offense tends to do well). Double-centered below so neither an offense
// nor a defense is better in general; only the pairing matters.
const TAC_RAW={five:{switch:-0.5,drop:1,zone:1,blitz:0},helio:{switch:-1,drop:0.5,zone:-0.5,blitz:-1},post:{switch:1,drop:-1,zone:-1,blitz:0.5},
  run:{switch:0,drop:0.5,zone:0.5,blitz:-0.5},motion:{switch:0,drop:0,zone:1,blitz:1}};
const TAC_M=(()=>{const M={};const rm={},cm={};let all=0;TO_K.forEach(o=>{rm[o]=TD_K.reduce((t,d)=>t+TAC_RAW[o][d],0)/TD_K.length});
  TD_K.forEach(d=>{cm[d]=TO_K.reduce((t,o)=>t+TAC_RAW[o][d],0)/TO_K.length});TO_K.forEach(o=>TD_K.forEach(d=>all+=TAC_RAW[o][d]));all/=TO_K.length*TD_K.length;
  TO_K.forEach(o=>{M[o]={};TD_K.forEach(d=>M[o][d]=+(TAC_RAW[o][d]-rm[o]-cm[d]+all).toFixed(3))});return M})();
const TAC_VAR_O={five:0.14,helio:0.06,post:0,run:-0.07,motion:-0.04},TAC_VAR_D={switch:0,drop:0,zone:0.06,blitz:0.08};
const FIT_O=2.4,FIT_D=1.6,HELIO_K=1.2,CNT_K=1.3,TK_HELIO=1.6;

// player traits used by the schemes (0..1)
const tShoot=p=>{const f=String((bioOf(p)||{}).sk||'');return Math.max(spc(p),f.includes('3')?0.7:0,f.includes('m')?0.35:0)};
const tRim=p=>clamp((num(p.blkp,1)-1.5)/3.5,0,1),tStl=p=>clamp((num(p.stlp,1.5)-1.3)/1.5,0,1),tPass=p=>clamp((num(p.astp,12)-8)/24,0,1);
const tDef=p=>clamp((num(p.dbpm,0)+1)/4,0,1),tVers=p=>{const n=canPlay(p).length;return n>=3?1:n===2?0.5:0};
const tMean=a=>a.length?a.reduce((t,x)=>t+x,0)/a.length:0,tTop=(a,n)=>a.slice().sort((x,y)=>y-x).slice(0,n);
function helioStar(R){let best=null,bv=-1;R.forEach(p=>{const v=crea(p)*Math.max(0.5,pval(p));if(v>bv){bv=v;best=p}});return best}
function tacRaw(Rall){const R=starters(Rall),bigs=R.filter(p=>p.slot==='PF'||p.slot==='C');
  const sh=R.map(tShoot),star=helioStar(R),oth=R.filter(p=>p!==star),us=tTop(oth.map(p=>num(p.usg,18)),1)[0]||18;
  const O={five:0.6*tMean(sh)+0.4*tMean(bigs.map(tShoot)),
    helio:star?0.45*crea(star)*clamp(pval(star)/7,0,1)+0.35*tMean(oth.map(tShoot))+0.2*(1-clamp((us-22)/10,0,1)):0,
    post:0.4*Math.max(0,...R.map(postS))+0.3*tMean(bigs.map(rebS))+0.3*Math.min(1,R.filter(p=>peOf(p)>=4).length/2),
    run:0.35*tMean(tTop(R.map(tStl),3))+0.35*Math.max(0,...R.filter(p=>p.slot==='PG'||p.slot==='SG').map(tPass))+0.3*R.filter(p=>peOf(p)<=3.5).length/5,
    motion:0.6*Math.min(1,R.filter(p=>tPass(p)>=0.3).length/3)+0.4*(1-clamp((Math.max(...R.map(p=>num(p.usg,18)))-tMean(R.map(p=>num(p.usg,18))))/14,0,1))};
  const D={switch:tMean(R.map(tVers)),drop:0.7*Math.max(0,...bigs.map(tRim))+0.3*tMean(R.map(tDef)),
    zone:0.5*Math.max(0,...R.map(tRim))+0.25*tMean(R.map(tStl))+0.25*tMean(R.map(tDef)),blitz:0.6*tMean(tTop(R.map(tStl),3))+0.4*tMean(R.map(tDef))};
  Object.keys(O).forEach(k=>O[k]=clamp(O[k],0,1));Object.keys(D).forEach(k=>D[k]=clamp(D[k],0,1));
  return{O,D,star:star&&star.n,starGap:star?pval(star)-tMean(oth.map(pval)):0}}
/* the raw scores above live on different scales (most lineups have two bigs, few have five shooters), so each is
   turned into a percentile against 600 random five-man lineups drawn from the whole card pool: "契合 80" means this
   lineup suits the scheme better than 80% of random lineups. Built once, from a fixed seed, the same on every device. */
let TAC_CAL=null;
function tacCal(){if(TAC_CAL)return TAC_CAL;const pool=[];const seen=new Set();THEMES.forEach(t=>t.items.forEach(p=>{if(!p.fa&&!seen.has(p.id+p.y0)){seen.add(p.id+p.y0);pool.push(p)}}));
  const r=rng(hash('tac-cal-v1')),O={},D={};TO_K.forEach(k=>O[k]=[]);TD_K.forEach(k=>D[k]=[]);
  for(let i=0;i<600&&pool.length>=5;i++){const pick=[];while(pick.length<5){const p=pool[Math.floor(r()*pool.length)];if(!pick.includes(p))pick.push(p)}
    const L=pick.slice().sort((a,b)=>peOf(a)-peOf(b)).map((p,j)=>({...p,slot:POS[j]})),f=tacRaw(L);TO_K.forEach(k=>O[k].push(f.O[k]));TD_K.forEach(k=>D[k].push(f.D[k]))}
  Object.values(O).concat(Object.values(D)).forEach(a=>a.sort((x,y)=>x-y));return TAC_CAL={O,D}}
const pctIn=(a,v)=>{if(!a.length)return v;let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<v)lo=m+1;else hi=m}let e=lo;while(e<a.length&&a[e]===v)e++;return clamp(((lo+e)/2)/a.length,0,1)};
function tacFit(R){const f=tacRaw(R),C=tacCal(),O={},D={};TO_K.forEach(k=>O[k]=pctIn(C.O[k],f.O[k]));TD_K.forEach(k=>D[k]=pctIn(C.D[k],f.D[k]));return{...f,O,D}}
const bestOf=o=>Object.keys(o).reduce((a,b)=>o[b]>o[a]?b:a);
function tacOf(g,s){const t=g.tac&&g.tac[s],F=tacFit(rosterOf(g,s));return{o:t&&TAC_O[t.o]?t.o:bestOf(F.O),d:t&&TAC_D[t.d]?t.d:bestOf(F.D),F,auto:!t}}
/* bots: easy picks among its three best fits at random, normal takes its best fit, hard also looks at what the
   other teams are likely to run (their best fits) and adds the expected counter */
function botTac(g,s){const lv=(S.bots&&S.bots[s]&&S.bots[s].lv)||S.botLv||'normal',F=tacFit(rosterOf(g,s)),r=rng(hash(g.gid+s+'tac'));
  if(lv==='easy'){const pk=o=>{const k=Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,3);return k[Math.floor(r()*k.length)]};return{o:pk(F.O),d:pk(F.D)}}
  if(lv!=='hard')return{o:bestOf(F.O),d:bestOf(F.D)};
  // rivals' lineups are hidden until tip-off, so a hard bot guesses them: the five best cards on their roster by the
  // public 攻守貢獻, lined up by size. It never reads their actual lineup or their tactic choice.
  const guess=R=>R.filter(p=>!p.fa).sort((a,b)=>pubVal(b)-pubVal(a)).slice(0,5).sort((a,b)=>peOf(a)-peOf(b)).map((p,j)=>({...p,slot:POS[j]}));
  const opp=g.sides.filter(x=>x!==s).map(x=>{const f=tacFit(guess(rosterOf(g,x)));return{o:bestOf(f.O),d:bestOf(f.D),f}});
  const so={},sd={};TO_K.forEach(o=>so[o]=FIT_O*F.O[o]+tMean(opp.map(q=>CNT_K*TAC_M[o][q.d]*(0.5+0.5*F.O[o])*(0.5+0.5*q.f.D[q.d]))));
  TD_K.forEach(d=>sd[d]=FIT_D*F.D[d]-tMean(opp.map(q=>CNT_K*TAC_M[q.o][d]*(0.5+0.5*q.f.O[q.o])*(0.5+0.5*F.D[d]))));return{o:bestOf(so),d:bestOf(sd)}}
// the fixed part of a team's tactic edge (fit + star system), and the counter of its offense against a defense
function tacBase(T){let v=FIT_O*(T.F.O[T.o]-0.45)+FIT_D*(T.F.D[T.d]-0.45),helio=0;
  if(T.o==='helio')helio=HELIO_K*clamp(T.F.starGap/6,0,1)*T.F.O.helio;return{fit:+(v).toFixed(2),helio:+helio.toFixed(2)}}
const tacCounter=(A,B)=>CNT_K*TAC_M[A.o][B.d]*(0.5+0.5*A.F.O[A.o])*(0.5+0.5*B.F.D[B.d]);
function tacResolve(g){g.tacR={};g.sides.forEach(s=>{const t=tacOf(g,s);if(t.auto&&typeof isBot==='function'&&isBot(s)){const b=botTac(g,s);t.o=b.o;t.d=b.d}
  g.tacR[s]={o:t.o,d:t.d,F:t.F,auto:t.auto,...tacBase(t)}})}
// short soft hints for the picker: what an offense / a defense usually does well or badly against
function tacHint(kind,k){if(kind==='o'){const row=TAC_M[k],good=TD_K.filter(d=>row[d]>=0.35).map(d=>TAC_D[d].nm),bad=TD_K.filter(d=>row[d]<=-0.35).map(d=>TAC_D[d].nm);
    return (good.length?`通常好打：${good.join('、')}`:'')+(good.length&&bad.length?'；':'')+(bad.length?`容易卡住：${bad.join('、')}`:'')}
  const good=TO_K.filter(o=>TAC_M[o][k]<=-0.35).map(o=>TAC_O[o].nm),bad=TO_K.filter(o=>TAC_M[o][k]>=0.35).map(o=>TAC_O[o].nm);
  return (good.length?`通常守得住：${good.join('、')}`:'')+(good.length&&bad.length?'；':'')+(bad.length?`比較怕：${bad.join('、')}`:'')}
function tacPanel(g,s,rd){const t=tacOf(g,s),bo=bestOf(t.F.O),bd=bestOf(t.F.D),pc=x=>Math.round(x*100);
  const chip=(kind,k,nm,fit,best,on)=>`<button class="tc ${on?'on':''}" data-act="tac" data-who="${s}" data-k="${kind}" data-v="${k}" ${rd?'disabled':''}>${nm}<i>${pc(fit)}</i>${best?'<em>推薦</em>':''}</button>`;
  const O=TAC_O[t.o],D=TAC_D[t.d];
  return `<div class="tacbox"><div class="blab">戰術 <span class="tacsub">數字是陣容契合度</span></div>
    <div class="tacrow"><span class="tl">進攻</span><div class="tcs">${TO_K.map(k=>chip('o',k,TAC_O[k].nm,t.F.O[k],k===bo,k===t.o)).join('')}</div></div>
    <div class="tacd"><b>${O.nm}</b>：${O.d}。需要${O.need}。<span class="mut">${tacHint('o',t.o)}</span></div>
    <div class="tacrow"><span class="tl">防守</span><div class="tcs">${TD_K.map(k=>chip('d',k,TAC_D[k].nm,t.F.D[k],k===bd,k===t.d)).join('')}</div></div>
    <div class="tacd"><b>${D.nm}</b>：${D.d}。需要${D.need}。<span class="mut">${tacHint('d',t.d)}</span></div>
    ${t.o==='helio'&&t.F.star?`<div class="tacd">核心：<b>${esc(t.F.star)}</b>。他越比隊友強、隊友越會投，這套越好用，他接管比賽的機會也變多。</div>`:''}
    <div class="tacd mut">克制只是傾向：每場執行好壞不同，輸球的一方也會調整。對手選什麼要開打才知道。</div></div>`}
// one line per series for the results
function tacLine(z){if(!z.tac)return '';const A=z.tac[z.a],B=z.tac[z.b],nmA=esc(nm(S,z.a)),nmB=esc(nm(S,z.b));
  const ca=tacCounter(A,B),cb=tacCounter(B,A),edge=x=>x>=0.35?'佔上風':x<=-0.35?'被限制':'互有來回';
  return `<div class="small" style="margin-top:4px;line-height:1.6">戰術：<span style="color:${col(z.a)}">${nmA}</span> ${TAC_O[A.o].nm}／${TAC_D[A.d].nm} vs <span style="color:${col(z.b)}">${nmB}</span> ${TAC_O[B.o].nm}／${TAC_D[B.d].nm}<br>
    <span class="mut">${nmA}的進攻${edge(ca)}，${nmB}的進攻${edge(cb)}</span></div>`}
