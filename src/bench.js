/* ---------- bench roles (10-man mode) ----------
 Five bench spots, each holding one of three roles: 替補後衛 (covers PG/SG), 替補鋒線 (covers SF/PF/C) and one 第六人
 (covers anyone and plays the most). A bench needs at least one guard, one forward and exactly one sixth man; the
 rest is the player's choice. A player in a role he cannot play still counts but loses value, like a starter out of
 position. Substitutions (rest, foul trouble, ejections) come from the matching role, so a bench with no backup big
 pays for it when a big man gets into foul trouble. */
const BROLE={G:{nm:'替補後衛',sh:'後衛',pos:['PG','SG'],w:0.2,mins:0.3},F:{nm:'替補鋒線',sh:'鋒線',pos:['SF','PF','C'],w:0.2,mins:0.3},X:{nm:'第六人',sh:'6th',pos:['PG','SG','SF','PF','C'],w:0.35,mins:0.5}};
const BROLES=['G','F','X'];
const natRole=p=>{const c=canPlay(p);return (c.includes('PG')||c.includes('SG'))&&peOf(p)<=2.6?'G':'F'};
// how well a player fits a bench role: best position tier among the role's positions
function roleFit(p,role){if(p.fa)return{tier:0,mult:1};const R=BROLE[role]||BROLE.X;let t=9;R.pos.forEach(x=>{t=Math.min(t,posInfo(p,x).tier)});
  return{tier:t,mult:t===0?1:t===1?0.85:0.6}}
const benchVal0=p=>shr(p.obpm,p,REPL.obpm)+shr(p.dbpm,p,REPL.dbpm);
// value of the whole bench against replacement level, plus penalties for a role nobody on the bench can really cover
function benchValue(Bn){if(!Bn.length)return{adj:0,missG:false,missF:false};const repl=REPL.obpm+REPL.dbpm;let adj=0;
  Bn.forEach(p=>{const r=BROLE[p.role]?p.role:natRole(p),f=roleFit(p,r);adj+=BROLE[r].w*(benchVal0(p)*f.mult-repl)});
  const covers=grp=>Bn.some(p=>{const r=p.role||natRole(p);return (r===grp||r==='X')&&roleFit(p,grp).tier<=1});
  const missG=!covers('G'),missF=!covers('F');if(missG)adj-=0.8;if(missF)adj-=0.8;
  return{adj,missG,missF}}
// the bench player who comes in for a starter at this slot
function subFor(slot,Bn,used){const grp=['PG','SG'].includes(slot)?'G':'F',free=Bn.filter(p=>!used.has(p.n));if(!free.length)return null;
  const score=p=>{const r=p.role||natRole(p),t=posInfo(p,slot).tier;return (r==='X'&&t<=1?0:r===grp?1:r==='X'?2:3)*10+t-benchVal0(p)/20};
  return free.slice().sort((a,b)=>score(a)-score(b))[0]}
// roles live on the roster entries (g.rosters[s][i].role); keep them valid: one sixth man, at least one guard and one forward
function benchFix(g,s){if(g.size!==10)return;const E=g.rosters[s].filter(r=>isBench(r.slot));if(!E.length)return;const P=r=>g.items[r.k];
  E.forEach(r=>{if(!BROLE[r.role])r.role=natRole(P(r))});
  const xs=E.filter(r=>r.role==='X');
  if(xs.length!==1){const best=E.slice().sort((a,b)=>benchVal0(P(b))-benchVal0(P(a)))[0];E.forEach(r=>{if(r.role==='X'&&r!==best)r.role=natRole(P(r))});best.role='X'}
  ['G','F'].forEach(grp=>{if(E.some(r=>r.role===grp))return;const other=grp==='G'?'F':'G',pool=E.filter(r=>r.role===other);
    if(!pool.length)return;const pick=pool.slice().sort((a,b)=>roleFit(P(a),grp).tier-roleFit(P(b),grp).tier||benchVal0(P(a))-benchVal0(P(b)))[0];
    if(pool.length>1||E.length<=2)pick.role=grp})}
const benchOK=(g,s)=>{if(g.size!==10)return true;const E=g.rosters[s].filter(r=>isBench(r.slot));if(E.length<5)return true;
  return E.filter(r=>r.role==='X').length===1&&E.some(r=>r.role==='G')&&E.some(r=>r.role==='F')};
const roleLab=(r,short)=>BROLE[r]?(short?BROLE[r].sh:BROLE[r].nm):'替補';
