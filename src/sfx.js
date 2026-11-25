/* ---------- sound ----------
 Small synthesized sounds (no files to download). Guidelines followed:
 - one shared AudioContext, unlocked on the first tap (browsers block audio before a user gesture);
 - iPhone: Web Audio counts as "ambient" sound and is muted by the silent switch, so while sound is on the page asks
   for the "playback" audio session (iOS 17+). It also resumes from the "interrupted" state and rebuilds the context
   after the page comes back from the background, where Safari can leave it silent;
 - every sound goes through master gain -> compressor/limiter, so nothing can clip or jump out;
 - phone speakers reproduce little below ~250 Hz, so every sound has its body in the mid range (low thumps only add
   weight on headphones);
 - peak gains stay well below 1, attacks are a few ms and decays exponential (no clicks, no harsh edges);
 - each play gets a slight random pitch and level change so repeated sounds do not feel canned;
 - button presses get very short, quiet clicks with a clear hierarchy: confirm buttons a brighter "press", choices a
   light tick, back/pass a lower soft tap, disabled buttons nothing;
 - sound never carries information on its own: everything it marks is also shown on screen.
 Three levels (normal / quiet / off), remembered on this device. */
const SFX={lv:2,ctx:null,out:null,last:{},stale:false};
const SFX_LV=[0,0.5,1];                          // off, quiet, normal
try{const v=JSON.parse(localStorage.getItem('bb_sfx'));if(v===0||v===1||v===2)SFX.lv=v}catch(e){}
function sfxSession(on){try{if(navigator.audioSession)navigator.audioSession.type=on?'playback':'auto'}catch(e){}}
function sfxInit(){if(SFX.ctx||!SFX.lv)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{const c=new AC(),m=c.createGain(),k=c.createDynamicsCompressor();m.gain.value=SFX_LV[SFX.lv];
    k.threshold.value=-18;k.knee.value=12;k.ratio.value=6;k.attack.value=0.003;k.release.value=0.18;m.connect(k);k.connect(c.destination);SFX.ctx=c;SFX.out=m}catch(e){}}
function sfxUnlock(){if(!SFX.lv)return;sfxSession(true);
  if(SFX.stale&&SFX.ctx){try{SFX.ctx.close()}catch(e){}SFX.ctx=null;SFX.out=null}SFX.stale=false;
  sfxInit();const c=SFX.ctx;if(c&&c.state!=='running')c.resume().catch(()=>{})}
['touchend','click','keydown','pointerup'].forEach(ev=>document.addEventListener(ev,sfxUnlock,{passive:true,capture:true}));
// Safari can come back from the background with a context that reports "running" but stays silent: rebuild it on the next tap
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&SFX.ctx)SFX.stale=true});
function sfxSet(lv){SFX.lv=lv;try{localStorage.setItem('bb_sfx',JSON.stringify(lv))}catch(e){}sfxSession(!!lv);
  if(lv)sfxUnlock();if(SFX.out)SFX.out.gain.setTargetAtTime(SFX_LV[lv],SFX.ctx.currentTime,0.05)}
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
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+0.002);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(bp);bp.connect(g);g.connect(SFX.out);s.start(t);s.stop(t+dur+0.02);s.onended=()=>{s.disconnect();bp.disconnect();g.disconnect()}}
// a crowd: a band-passed noise bed whose level wanders like many voices, a few rising "woo" voices and scattered claps.
// Built fresh each time with random timing, so no two cheers sound the same.
function crowd(c,t,{dur=2.6,peak=0.16,voices=6,claps=26,bed=true}){
  if(bed){const n=Math.floor(c.sampleRate*dur),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let last=0;
    for(let i=0;i<n;i++){const w=Math.random()*2-1;last=0.97*last+0.03*w;d[i]=w*0.6+last*3}           // white + a little brown: fuller, less hiss
    const s=c.createBufferSource(),g=c.createGain();s.buffer=b;
    [[500,0.9,1],[1100,0.9,0.8],[2300,1.1,0.45]].forEach(([f,q,k])=>{const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f;bp.Q.value=q;const gg=c.createGain();gg.gain.value=k;s.connect(bp);bp.connect(gg);gg.connect(g)});
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak*0.55,t+0.12);g.gain.exponentialRampToValueAtTime(peak,t+0.45);
    for(let x=0.5;x<dur*0.55;x+=0.07)g.gain.setTargetAtTime(peak*(0.78+Math.random()*0.3),t+x,0.04);   // the swell of many voices
    g.gain.setTargetAtTime(0.0001,t+dur*0.55,dur*0.16);g.connect(SFX.out);s.start(t);s.stop(t+dur+0.05);s.onended=()=>{s.disconnect();g.disconnect()}}
  for(let i=0;i<voices;i++){const st=t+0.1+Math.random()*0.45,len=1+Math.random()*1.1,f=260+Math.random()*260,o=c.createOscillator(),bp=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(f,st);o.frequency.linearRampToValueAtTime(f*1.18,st+0.35);o.frequency.linearRampToValueAtTime(f*1.05,st+len);
    bp.type='bandpass';bp.frequency.value=900+Math.random()*500;bp.Q.value=3;
    g.gain.setValueAtTime(0.0001,st);g.gain.exponentialRampToValueAtTime(0.012,st+0.15);g.gain.exponentialRampToValueAtTime(0.0001,st+len);
    o.connect(bp);bp.connect(g);g.connect(SFX.out);o.start(st);o.stop(st+len+0.05);o.onended=()=>{o.disconnect();bp.disconnect();g.disconnect()}}
  for(let i=0;i<claps;i++)burst(c,t+0.15+Math.random()*(dur*0.8),{f:1400+Math.random()*1600,q:1.2,dur:0.018,peak:0.04+Math.random()*0.05})}
const SND={
  // buttons (5-60 ms, quiet)
  tap:(c,t)=>burst(c,t,{f:jit(3400,.08),q:3,dur:0.018,peak:0.14}),
  tick2:(c,t)=>{burst(c,t,{f:jit(2800,.06),q:4,dur:0.014,peak:0.08});voice(c,t,{f:jit(1760,.03),dur:0.035,peak:0.035})},
  press:(c,t)=>{burst(c,t,{f:jit(3000,.06),q:3,dur:0.016,peak:0.14});voice(c,t+0.004,{type:'triangle',f:jit(1180,.03),f2:1420,dur:0.06,peak:0.08})},
  back:(c,t)=>{burst(c,t,{f:jit(1500,.06),q:2.5,dur:0.02,peak:0.08});voice(c,t,{f:jit(700,.03),f2:560,dur:0.05,peak:0.035})},
  // game events
  bid:(c,t)=>{const f=jit(880,.03);voice(c,t,{type:'triangle',f,dur:0.09,peak:0.16});voice(c,t+0.05,{type:'sine',f:f*1.5,dur:0.12,peak:0.10})},
  raise:(c,t)=>{voice(c,t,{type:'triangle',f:jit(660,.03),dur:0.08,peak:0.13})},
  outbid:(c,t)=>{voice(c,t,{type:'triangle',f:jit(620,.02),dur:0.11,peak:0.15});voice(c,t+0.1,{type:'triangle',f:jit(470,.02),dur:0.16,peak:0.13})},
  turn:(c,t)=>{voice(c,t,{f:jit(1046,.02),dur:0.18,peak:0.13});voice(c,t+0.07,{f:jit(1568,.02),dur:0.22,peak:0.08})},
  tick:(c,t)=>burst(c,t,{f:jit(1500,.05),q:6,dur:0.045,peak:0.12}),
  // Dutch clock step: a soft wooden tick that climbs as the price nears $1 (tension builds without getting louder)
  dtick:(c,t,p)=>{const k=clamp(10-(p||10),0,9);burst(c,t,{f:1100+k*120,q:7,dur:0.035,peak:0.08});voice(c,t,{type:'triangle',f:520+k*45,dur:0.06,peak:0.045})},
  last:(c,t)=>{burst(c,t,{f:jit(1900,.04),q:7,dur:0.05,peak:0.14});voice(c,t,{f:jit(1320,.02),dur:0.07,peak:0.05})},
  // gavel: wood knock in the mid range, a low thump for headphones underneath
  sold:(c,t)=>{burst(c,t,{f:jit(2400,.05),q:2,dur:0.03,peak:0.16});voice(c,t,{type:'triangle',f:jit(420,.04),f2:300,dur:0.12,peak:0.2});voice(c,t,{f:jit(150,.04),f2:80,dur:0.16,peak:0.18});
    burst(c,t+0.1,{f:jit(2000,.05),q:2,dur:0.025,peak:0.09});voice(c,t+0.1,{type:'triangle',f:jit(360,.04),f2:260,dur:0.1,peak:0.12})},
  win:(c,t)=>{[784,988,1318].forEach((f,i)=>voice(c,t+i*0.07,{type:'triangle',f:jit(f,.01),dur:0.22,peak:0.12}))},
  pass:(c,t)=>burst(c,t,{f:1100,f2:450,q:1.2,dur:0.2,peak:0.09}),
  reveal:(c,t)=>{for(let i=0;i<8;i++)burst(c,t+i*0.06,{f:jit(800+i*100,.05),q:2,dur:0.05,peak:0.045+i*0.009});voice(c,t+0.52,{type:'triangle',f:jit(988,.02),dur:0.2,peak:0.14})},
  go:(c,t)=>{voice(c,t,{type:'square',f:jit(1175,.01),dur:0.07,peak:0.05});voice(c,t,{f:jit(1175,.01),dur:0.16,peak:0.13})},
  grab:(c,t)=>{voice(c,t,{type:'triangle',f:jit(520,.02),f2:1040,dur:0.12,peak:0.15})},
  stage:(c,t)=>{voice(c,t,{f:jit(392,.01),f2:523,dur:0.35,peak:0.07,a:0.06});voice(c,t+0.05,{f:jit(587,.01),f2:784,dur:0.35,peak:0.05,a:0.06})},
  // ability card: a rising shimmer (noise sweep + bright arpeggio), clearly special but short
  card:(c,t)=>{burst(c,t,{f:600,f2:5200,q:1.4,dur:0.32,peak:0.06});[659,880,1175,1568].forEach((f,i)=>voice(c,t+0.05+i*0.055,{type:'triangle',f:jit(f,.01),dur:0.24,peak:0.09}));
    voice(c,t+0.27,{f:2093,dur:0.35,peak:0.04})},
  coupon:(c,t)=>{voice(c,t,{type:'triangle',f:jit(1318,.01),dur:0.08,peak:0.1});voice(c,t+0.08,{type:'triangle',f:jit(1760,.01),dur:0.14,peak:0.1});burst(c,t+0.08,{f:6000,q:3,dur:0.08,peak:0.04})},
  // final buzzer: a short, slightly rough two-tone horn in the mid range (phone speakers carry it)
  horn:(c,t)=>{[[440,0.034],[554,0.027]].forEach(([f,p])=>{const o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain();o.type='square';o.frequency.value=f;lp.type='lowpass';lp.frequency.value=1700;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(p,t+0.02);g.gain.setValueAtTime(p,t+0.62);g.gain.exponentialRampToValueAtTime(0.0001,t+0.8);
    o.connect(lp);lp.connect(g);g.connect(SFX.out);o.start(t);o.stop(t+0.85);o.onended=()=>{o.disconnect();lp.disconnect();g.disconnect()}})},
  cheer:(c,t)=>crowd(c,t,{dur:2.8,peak:0.17,voices:7,claps:30}),
  applause:(c,t)=>crowd(c,t,{dur:1.9,peak:0.05,voices:0,claps:34}),
  champ:(c,t)=>{[523,659,784,1046].forEach((f,i)=>voice(c,t+i*0.11,{type:'triangle',f,dur:i===3?0.55:0.2,peak:0.13}));voice(c,t+0.33,{f:523,dur:0.6,peak:0.07})},
  error:(c,t)=>voice(c,t,{type:'triangle',f:jit(300,.02),f2:240,dur:0.12,peak:0.09})};
const SFX_GAP={tap:35,tick2:35,press:35,back:35,tick:250,raise:90,bid:90};
// gesture: called inside a tap, so a context that is still resuming may queue the sound (it plays as soon as it resumes)
function sfx(name,delay,gesture,arg){if(!SFX.lv||!SND[name])return;sfxInit();const c=SFX.ctx;if(!c)return;if(c.state!=='running'){c.resume().catch(()=>{});if(!gesture)return}
  const n=performance.now();if(n-(SFX.last[name]||0)<(SFX_GAP[name]||120))return;SFX.last[name]=n;try{SND[name](c,c.currentTime+0.01+(delay||0),arg)}catch(e){}}
// button sounds: one family, chosen by what the button does
const BTN_PRESS=/^(start|create|joinhash|ai|local|nominate|lpick|sbid|bidv|bid|grab|mpick|ready|again|cpick|cuse|cardgo)$/,BTN_BACK=/^(pass|spass|exit|quit|lnone|ccancel)$/;
document.addEventListener('click',e=>{const b=e.target.closest('button,[data-act]');if(!b||b.disabled||b.dataset.act==='sfx')return;
  const a=b.dataset.act||'',pass=b.classList.contains('pass');
  sfx(pass||BTN_BACK.test(a)?'back':BTN_PRESS.test(a)||b.classList.contains('big')?'press':/^(cfg|cat|tmode|ptog|ailv|nompick|lsel|csel|brole|lu|step|sstep|peek)$/.test(a)||b.classList.contains('chip')?'tick2':'tap',0,true)},true);
