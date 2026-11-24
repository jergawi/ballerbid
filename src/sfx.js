/* ---------- sound ----------
 Small synthesized sounds (no files to download). Guidelines followed:
 - one shared AudioContext, created on the first tap (browsers block audio before a user gesture);
 - every sound goes through master gain -> compressor/limiter, so nothing can clip or jump out;
 - peak gains stay well below 1, attacks are a few ms and decays exponential (no clicks, no harsh edges);
 - each play gets a slight random pitch and level change so repeated sounds do not feel canned;
 - frequent sounds (bids, ticks) are short and soft; only rare moments (sold to you, champion) are brighter;
 - sound never carries information on its own: everything it marks is also shown on screen.
 Three levels (normal / quiet / off), remembered on this device. */
const SFX={lv:1,ctx:null,out:null,last:{}};
const SFX_LV=[0,0.32,0.6];                       // off, quiet, normal
try{const v=JSON.parse(localStorage.getItem('bb_sfx'));if(v===0||v===1||v===2)SFX.lv=v;else SFX.lv=2}catch(e){SFX.lv=2}
function sfxInit(){if(SFX.ctx||!SFX.lv)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{const c=new AC(),m=c.createGain(),k=c.createDynamicsCompressor();m.gain.value=SFX_LV[SFX.lv];
    k.threshold.value=-20;k.knee.value=12;k.ratio.value=6;k.attack.value=0.003;k.release.value=0.18;m.connect(k);k.connect(c.destination);SFX.ctx=c;SFX.out=m}catch(e){}}
function sfxUnlock(){sfxInit();const c=SFX.ctx;if(c&&c.state==='suspended')c.resume().catch(()=>{})}
['pointerdown','keydown','touchend'].forEach(ev=>document.addEventListener(ev,sfxUnlock,{passive:true}));
function sfxSet(lv){SFX.lv=lv;try{localStorage.setItem('bb_sfx',JSON.stringify(lv))}catch(e){}if(lv)sfxInit();if(SFX.out)SFX.out.gain.setTargetAtTime(SFX_LV[lv],SFX.ctx.currentTime,0.05)}
const jit=(x,p)=>x*(1+(Math.random()*2-1)*p);
// one oscillator voice with an exponential envelope
function voice(c,t,{type='sine',f,f2,dur=0.12,peak=0.2,a=0.004,detune=0}){const o=c.createOscillator(),g=c.createGain();o.type=type;
  o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);o.detune.value=detune;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(SFX.out);o.start(t);o.stop(t+dur+0.02);o.onended=()=>{o.disconnect();g.disconnect()}}
// a short band-passed noise burst (knocks, taps, rustle)
function burst(c,t,{f=2000,q=1.5,dur=0.06,peak=0.15,f2}){const n=Math.max(1,Math.floor(c.sampleRate*dur)),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();s.buffer=b;bp.type='bandpass';
  bp.frequency.setValueAtTime(f,t);if(f2)bp.frequency.exponentialRampToValueAtTime(f2,t+dur);bp.Q.value=q;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+0.003);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(bp);bp.connect(g);g.connect(SFX.out);s.start(t);s.stop(t+dur+0.02);s.onended=()=>{s.disconnect();bp.disconnect();g.disconnect()}}
const SND={
  tap:(c,t)=>burst(c,t,{f:jit(3600,.08),q:3,dur:0.03,peak:0.09}),
  bid:(c,t)=>{const f=jit(880,.03);voice(c,t,{type:'triangle',f,dur:0.09,peak:0.16});voice(c,t+0.05,{type:'sine',f:f*1.5,dur:0.12,peak:0.10})},
  raise:(c,t)=>{voice(c,t,{type:'triangle',f:jit(660,.03),dur:0.08,peak:0.12})},
  outbid:(c,t)=>{voice(c,t,{type:'triangle',f:jit(620,.02),dur:0.11,peak:0.15});voice(c,t+0.1,{type:'triangle',f:jit(470,.02),dur:0.16,peak:0.13})},
  turn:(c,t)=>{voice(c,t,{f:jit(1046,.02),dur:0.18,peak:0.12});voice(c,t+0.07,{f:jit(1568,.02),dur:0.22,peak:0.07})},
  tick:(c,t)=>burst(c,t,{f:jit(1500,.05),q:6,dur:0.045,peak:0.12}),
  last:(c,t)=>{burst(c,t,{f:jit(1900,.04),q:7,dur:0.05,peak:0.14});voice(c,t,{f:jit(1320,.02),dur:0.07,peak:0.05})},
  sold:(c,t)=>{voice(c,t,{f:jit(150,.04),f2:70,dur:0.16,peak:0.34});burst(c,t,{f:jit(2400,.05),q:2,dur:0.035,peak:0.16});voice(c,t+0.09,{f:jit(120,.04),f2:60,dur:0.12,peak:0.16})},
  win:(c,t)=>{[784,988,1318].forEach((f,i)=>voice(c,t+i*0.07,{type:'triangle',f:jit(f,.01),dur:0.22,peak:0.11}))},
  pass:(c,t)=>burst(c,t,{f:900,f2:300,q:1,dur:0.22,peak:0.08}),
  reveal:(c,t)=>{for(let i=0;i<8;i++)burst(c,t+i*0.06,{f:jit(700+i*90,.05),q:2,dur:0.05,peak:0.04+i*0.009});voice(c,t+0.52,{type:'triangle',f:jit(988,.02),dur:0.2,peak:0.13})},
  go:(c,t)=>{voice(c,t,{type:'square',f:jit(1175,.01),dur:0.07,peak:0.05});voice(c,t,{f:jit(1175,.01),dur:0.16,peak:0.12})},
  grab:(c,t)=>{voice(c,t,{type:'triangle',f:jit(520,.02),f2:1040,dur:0.12,peak:0.14})},
  stage:(c,t)=>{voice(c,t,{f:jit(392,.01),f2:523,dur:0.35,peak:0.06,a:0.06});voice(c,t+0.05,{f:jit(587,.01),f2:784,dur:0.35,peak:0.04,a:0.06})},
  champ:(c,t)=>{[523,659,784,1046].forEach((f,i)=>voice(c,t+i*0.11,{type:'triangle',f,dur:i===3?0.55:0.2,peak:0.12}));voice(c,t+0.33,{f:523,dur:0.6,peak:0.06})},
  error:(c,t)=>voice(c,t,{type:'triangle',f:jit(220,.02),dur:0.12,peak:0.08})};
const SFX_GAP={tap:40,tick:250,raise:90,bid:90};
function sfx(name,delay){if(!SFX.lv||!SND[name])return;sfxInit();const c=SFX.ctx;if(!c||c.state!=='running')return;const n=performance.now();
  if(n-(SFX.last[name]||0)<(SFX_GAP[name]||120))return;SFX.last[name]=n;try{SND[name](c,c.currentTime+0.01+(delay||0))}catch(e){}}
