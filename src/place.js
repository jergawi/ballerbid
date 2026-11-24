/* ---------- automatic placement ----------
 A won card goes straight onto the roster; nobody has to pick a spot mid-auction. After every sale the buyer's whole
 roster is re-arranged: the best starting five by value and position fit, the rest on the bench with roles. Starter
 spots stay open when no owned player fits them well, so "open spots" keep meaning "what this team still needs".
 Players fine-tune everything in the lineup screen (drag to swap, tap a bench role), so this choice never locks
 anyone in. Slot missions (e.g. a classic center at C) get a nudge so the arrangement already shows them done. */
const PLACE_PEN=[0,0.6,2.2,4.5],   // value lost playing a position: natural / can play / stretch / wrong
      PLACE_EMPTY=1,               // an open starter spot is worth about an average future buy
      PLACE_BENCH=0.3,             // bench players count for less than starters
      PLACE_STAY=0.05,             // tie-break: leave players where they are
      PLACE_MIS=1.5,               // nudge for the player a slot mission needs
      PLACE_NAT=0.1;               // tie-break: closer to his listed position (Jordan SG, not PG)
// distance from his listed position; moving down (a SG at PG) costs a little more than moving up (to SF)
const natGap=d=>PLACE_NAT*(d<0?1.3:1)*Math.abs(d);
function autoPlace(g,s){const E=g.rosters[s];if(!E.length)return;
  const cap=SLOTS(g).length-POS.length,P=E.map(r=>g.items[r.k]),v=P.map(p=>p.fa?-1:pval(p));
  const M=g.mis&&g.mis[s],mm=M&&M.pick!=null?misOf(M.opts[M.pick].id):null,slotMis=mm&&mm.k==='slot'?mm:null;
  const sc=POS.map((sl,j)=>E.map((r,i)=>v[i]-PLACE_PEN[Math.min(3,posInfo(P[i],sl).tier)]-natGap(j+1-peOf(P[i]))+(r.slot===sl?PLACE_STAY:0)+(slotMis&&slotMis.slot===sl&&slotMis.f(P[i])?PLACE_MIS:0)));
  const benchSc=E.map((r,i)=>PLACE_BENCH*v[i]+(isBench(r.slot)?PLACE_STAY:0));
  // exhaustive search: each starter spot takes an unused player or stays open (at most 11^5 leaves for 10-man)
  let best=-Infinity,bestA=null;const A=[],used=E.map(()=>false);
  (function go(j,tot,n){
    if(j===POS.length){if(E.length-n>cap)return;let t=tot;E.forEach((_,i)=>{if(!used[i])t+=benchSc[i]});if(t>best){best=t;bestA=A.slice()}return}
    for(let i=0;i<E.length;i++)if(!used[i]){used[i]=true;A[j]=i;go(j+1,tot+sc[j][i],n+1);used[i]=false}
    if(E.length-n<=cap+POS.length-j-1){A[j]=-1;go(j+1,tot+PLACE_EMPTY,n)}})(0,0,0);
  const onB=E.filter((_,i)=>!bestA.includes(i)).sort((a,b)=>pval(g.items[b.k])-pval(g.items[a.k]));
  bestA.forEach((i,j)=>{if(i>=0){E[i].slot=POS[j];delete E[i].role}});
  onB.forEach((r,j)=>{r.slot=BENCH[j];r.role=natRole(g.items[r.k])});
  benchFix(g,s)}
// short "where did he go" note for the sale toast
const placeNote=(g,s,k)=>{const e=g.rosters[s].find(r=>r.k===k);return !e?'':isBench(e.slot)?roleLab(e.role):'先發 '+e.slot};
