/* ---------- game log: every finished game is saved on this device (last 80), and can be exported as one JSON file
   to hand to Claude for balance work: prices paid vs card value, who won, what the bots did, takeovers, formats.
   Nothing leaves the device unless the player exports it. ---------- */
const LS_LOG='bb_logs_v1',LOG_MAX=80;
function logAll(){try{const x=JSON.parse(localStorage.getItem(LS_LOG)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function logRecord(){const g=S&&S.game,sim=S&&S.sim;if(!g||!sim||S.phase!=='results'||!g.gid)return;
  ui.logged=ui.logged||new Set();if(ui.logged.has(g.gid))return;ui.logged.add(g.gid);
  try{const L=logAll();if(L.some(x=>x.gid===g.gid))return;
    const r2=x=>Math.round(x*100)/100,c=S.cfg||{};
    const team=s=>{const R=rosterOf(g,s);return{name:nm(S,s),human:!(typeof isBot==='function'&&isBot(s)),bot:S.bots&&S.bots[s]||null,left:left(g,s),
      str:r2(strength(R,g,left(g,s))),rows:R.map(p=>({id:p.id,n:p.n,slot:p.slot,role:p.role||null,price:p.price,ovr:ovrOf(p),pub:r2(pubVal(p)),pv:r2(pval(p)),ph:phaseOf(p)||null,tk:r2(tkRate(p))}))}};
    const rec={gid:g.gid,v:APPV,t:Date.now(),mode:NET.mode,me:myRole(),
      cfg:{players:g.sides.length,size:g.size,budget:g.budget,fmt:g.fmt||c.fmt||'open',nom:!!g.nom,mis:!!c.mis,cards:!!c.cards,read:g.read,ovr:g.ovr!==false,showStats:!!g.showStats,botLv:S.botLv||null,round:g.round||0},
      teams:Object.fromEntries(g.sides.map(s=>[s,team(s)])),
      buys:g.log.map(l=>({n:l.n,who:l.who||null,amt:l.amt||0})),
      series:sim.series.map(z=>({a:z.a,b:z.b,wa:z.wa,wb:z.wb,p:r2(z.p),games:z.games.map(x=>[x[0],x[1]]),tk:z.tk||[],bo:z.bo||[]})),
      champ:sim.champ||null,mis:g.misRes||null};
    L.push(rec);while(L.length>LOG_MAX)L.shift();
    for(let k=0;k<5;k++){try{localStorage.setItem(LS_LOG,JSON.stringify(L));break}catch(e){L.splice(0,Math.ceil(L.length/4))}}   // full storage: drop the oldest quarter and retry
  }catch(e){console.warn('log',e)}}
async function logExport(){const L=logAll();if(!L.length){toast('還沒有紀錄：打完一局就會自動存');return}
  const d=new Date(),ds=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const body=JSON.stringify({app:'BALLER BID',v:APPV,exported:d.toISOString(),games:L});
  const name=`ballerbid-log-${ds}.json`,file=new File([body],name,{type:'application/json'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'BALLER BID 遊戲紀錄'});return}}catch(e){if(e&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast('已下載 '+name)}
function logBtn(){const n=logAll().length;return `<button class="ghost" data-act="logexp">匯出遊戲紀錄（${n} 局，給 Claude 分析）</button>`}
