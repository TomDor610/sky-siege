// Procedural sound (Web Audio, no files): effects + gentle lute-style music.
//
// Rules:
// - Never touches game state and never calls Math.random (own PRNG below), so
//   it cannot change the simulation. The baseline tests run with audio active.
// - The AudioContext is created on the first real user gesture (browser policy).
// - Settings live in localStorage 'skysiege_sound' = {muted, sfx, music}.
// - Each effect is throttled by AudioContext time and voices are capped, so a
//   burst of events (or a synchronous test loop) cannot pile up nodes.
import {G} from './state.js';
import {viewW} from './view.js';
import {store} from './util.js';

const KEY='skysiege_sound';
const MAX_VOICES=24;
const SFX_VOL=0.55,MUSIC_VOL=0.2;

let settings={muted:false,sfx:true,music:true};
try{const s=JSON.parse(store.get(KEY)||'null');if(s&&typeof s==='object')settings=Object.assign(settings,s);}catch(e){}

let ac=null,master,sfxBus,musicBus,noiseBuf;
let voices=0;
const lastPlay={},played={};
const listeners=[];

// --- own PRNG (mulberry32), so audio never consumes Math.random
let seed=0x5eed;
const prng=()=>{seed=(seed+0x6d2b79f5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};

// ---------- settings ----------
export function soundSettings(){return Object.assign({},settings);}
export function setSound(patch){
  Object.assign(settings,patch);
  store.set(KEY,JSON.stringify(settings));
  applyLevels();
  listeners.forEach(f=>f(settings));
}
export function onSoundChange(f){listeners.push(f);}
function applyLevels(){
  if(!ac)return;
  const t=ac.currentTime;
  master.gain.setTargetAtTime(settings.muted?0:1,t,0.03);
  sfxBus.gain.setTargetAtTime(settings.sfx?SFX_VOL:0,t,0.03);
  musicBus.gain.setTargetAtTime(settings.music?MUSIC_VOL*duck:0,t,0.3);
}

// ---------- context ----------
function ensure(){
  if(ac)return true;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  try{ac=new AC();}catch(e){return false;}
  master=ac.createGain();
  const comp=ac.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;
  master.connect(comp);comp.connect(ac.destination);
  sfxBus=ac.createGain();sfxBus.connect(master);
  musicBus=ac.createGain();musicBus.connect(master);
  noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=prng()*2-1;
  master.gain.value=settings.muted?0:1;sfxBus.gain.value=settings.sfx?SFX_VOL:0;musicBus.gain.value=0;
  applyLevels();
  return true;
}
const live=()=>ac&&ac.state==='running';

// ---------- building blocks ----------
function voice(dur){
  if(voices>=MAX_VOICES)return false;
  voices++;setTimeout(()=>voices--,Math.ceil(dur*1000)+50);
  return true;
}
function out(bus,vol,pan){
  const g=ac.createGain();g.gain.value=vol;
  if(pan&&ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(bus);}else g.connect(bus);
  return g;
}
function env(g,t,a,d,peak){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d);}
function tone(dest,{type='sine',f0,f1=f0,t=ac.currentTime,a=0.005,d=0.2,vol=0.3}){
  const o=ac.createOscillator(),g=ac.createGain();o.type=type;
  o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+a+d);
  env(g,t,a,d,vol);o.connect(g);g.connect(dest);o.start(t);o.stop(t+a+d+0.05);
}
function noise(dest,{type='lowpass',f0=1000,f1=f0,q=1,t=ac.currentTime,a=0.005,d=0.3,vol=0.3}){
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();
  s.buffer=noiseBuf;s.loop=true;f.type=type;f.Q.value=q;
  f.frequency.setValueAtTime(f0,t);if(f1!==f0)f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+a+d);
  env(g,t,a,d,vol);s.connect(f);f.connect(g);g.connect(dest);s.start(t,prng()*0.5);s.stop(t+a+d+0.05);
}

// distance from the camera -> volume and stereo pan
function place(x){
  if(x===undefined||!G||!G.cam)return {v:1,pan:0};
  const cx=G.cam.x+viewW/2,dx=x-cx;
  return {v:Math.max(0.12,1-Math.abs(dx)/1600),pan:Math.max(-0.8,Math.min(0.8,dx/900))};
}

// ---------- effects ----------
const GAP={drop:0.05,boom:0.06,hit:0.08,ballista:0.08,archers:0.12,mangonel:0.15,crossbow:0.06,rearm:0.4,empty:0.3,defDown:0.1,pot:0.08,thunk:0.06,stall:0.6,click:0.04,launch:0.3,planeDown:0.2,castleFall:1,win:1,lose:1};
const DUR={drop:0.45,boom:1.1,hit:0.3,ballista:0.35,archers:0.35,mangonel:0.5,crossbow:0.2,rearm:0.5,empty:0.1,defDown:0.6,pot:0.7,thunk:0.1,stall:0.25,click:0.05,launch:0.5,planeDown:1.4,castleFall:2.4,win:1.6,lose:1.6};

export function sfx(name,o={}){
  if(!live()||settings.muted||!settings.sfx)return;
  const now=ac.currentTime;
  if(now-(lastPlay[name]??-9)<(GAP[name]||0.05))return;
  if(!voice(DUR[name]||0.5))return;
  lastPlay[name]=now;played[name]=(played[name]||0)+1;
  const {v,pan}=place(o.x),mine=o.mine?1:0.7;
  const D=out(sfxBus,v,pan),t=now;
  switch(name){
    case 'drop': tone(D,{type:'sine',f0:1100,f1:320,d:0.4,vol:0.10*mine});break;
    case 'boom':{
      const big=o.big?1.3:1;
      noise(D,{f0:1400,f1:110,d:0.6*big,vol:0.55});
      tone(D,{type:'sine',f0:95,f1:38,d:0.5*big,vol:0.55});
      noise(D,{type:'bandpass',f0:2600,f1:900,q:0.8,t:t+0.02,d:0.18,vol:0.12}); // stone rattle
      if(o.greek)noise(D,{type:'bandpass',f0:700,f1:2200,q:0.7,a:0.05,d:0.9,vol:0.18});
      break;}
    case 'pot': noise(D,{f0:1800,f1:200,d:0.45,vol:0.35});tone(D,{f0:140,f1:60,d:0.35,vol:0.3});noise(D,{type:'bandpass',f0:900,f1:1800,a:0.03,d:0.5,vol:0.1});break;
    case 'hit': noise(D,{type:'bandpass',f0:1700,f1:600,q:2,d:0.12,vol:0.4*mine});tone(D,{type:'square',f0:190,f1:80,d:0.12,vol:0.12*mine});break;
    case 'planeDown': noise(D,{f0:1600,f1:90,d:0.9,vol:0.6});tone(D,{type:'sawtooth',f0:420,f1:70,a:0.02,d:1.1,vol:0.07});tone(D,{f0:85,f1:35,d:0.7,vol:0.5});break;
    case 'ballista': tone(D,{type:'triangle',f0:240,f1:120,d:0.28,vol:0.3});noise(D,{type:'highpass',f0:3000,d:0.03,vol:0.15});break;
    case 'archers': for(let k=0;k<3;k++)tone(D,{type:'triangle',f0:430+k*40,f1:260,t:t+k*0.05,d:0.12,vol:0.14});break;
    case 'mangonel': tone(D,{type:'sawtooth',f0:130,f1:70,a:0.04,d:0.3,vol:0.08});noise(D,{f0:400,f1:120,t:t+0.12,d:0.25,vol:0.3});break;
    case 'crossbow': tone(D,{type:'triangle',f0:640,f1:300,d:0.11,vol:0.2});noise(D,{type:'highpass',f0:4000,d:0.02,vol:0.1});break;
    case 'rearm': tone(D,{f0:1320,d:0.25,vol:0.12*mine});tone(D,{type:'triangle',f0:1760,t:t+0.09,d:0.3,vol:0.1*mine});break;
    case 'empty': tone(D,{type:'square',f0:140,d:0.05,vol:0.06});break;
    case 'defDown': noise(D,{f0:2200,f1:260,d:0.45,vol:0.4});for(let k=0;k<3;k++)tone(D,{type:'square',f0:220-k*40,t:t+0.05+k*0.07,d:0.04,vol:0.06});break;
    case 'thunk': noise(D,{f0:900,d:0.05,vol:0.12});break;
    case 'stall': tone(D,{type:'square',f0:560,d:0.07,vol:0.05});tone(D,{type:'square',f0:560,t:t+0.12,d:0.07,vol:0.05});break;
    case 'click': tone(D,{type:'triangle',f0:1300,f1:900,d:0.03,vol:0.06});break;
    case 'launch': noise(D,{type:'bandpass',f0:350,f1:1600,q:1.2,a:0.05,d:0.4,vol:0.16});break;
    case 'castleFall': noise(D,{f0:500,f1:60,a:0.1,d:2.1,vol:0.6});tone(D,{f0:60,f1:30,a:0.1,d:1.8,vol:0.4});break;
    case 'win': [293.7,370,440,587.3].forEach((f,k)=>pluck(D,f,t+k*0.13,0.9,0.22));pluck(D,739.99,t+0.52,1.2,0.16);break;
    case 'lose': [440,349.2,293.7,220].forEach((f,k)=>pluck(D,f,t+k*0.22,1,0.2));break;
  }
}

// ---------- music: lute-like plucks in D dorian over a soft drone ----------
const NOTE=n=>440*Math.pow(2,(n-69)/12);           // MIDI -> Hz
const CHORDS=[[50,53,57],[48,52,55],[55,59,62],[50,53,57],[53,57,60],[48,52,55],[55,59,62],[57,60,64]]; // Dm C G Dm F C G Am
const SCALE=[62,64,65,67,69,71,72,74,76];           // D dorian, upper octave
const ARP=[0,1,2,1,0,2,1,2];
let musicMode='off',musicTimer=null,nextT=0,step=0,duck=1;

function pluck(dest,f,t,d,vol){
  const o=ac.createOscillator(),o2=ac.createOscillator(),flt=ac.createBiquadFilter(),g=ac.createGain();
  o.type='triangle';o2.type='sawtooth';o.frequency.value=f;o2.frequency.value=f*1.003;
  flt.type='lowpass';flt.frequency.setValueAtTime(Math.min(4000,f*6),t);flt.frequency.exponentialRampToValueAtTime(Math.max(200,f*1.2),t+d*0.6);
  const g2=ac.createGain();g2.gain.value=0.25;o2.connect(g2);g2.connect(flt);o.connect(flt);flt.connect(g);g.connect(dest);
  env(g,t,0.004,d,vol);o.start(t);o2.start(t);o.stop(t+d+0.05);o2.stop(t+d+0.05);
}
function drone(f,t,d){
  const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.16,t+d*0.3);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g);g.connect(musicBus);o.start(t);o.stop(t+d+0.05);
}
function tabor(t,vol){
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();
  s.buffer=noiseBuf;f.type='bandpass';f.frequency.value=180;f.Q.value=1.5;
  env(g,t,0.003,0.12,vol);s.connect(f);f.connect(g);g.connect(musicBus);s.start(t,prng()*0.5);s.stop(t+0.2);
}
function schedule(){
  if(!live()||musicMode==='off')return;
  const battle=musicMode==='battle',eighth=60/(battle?100:72)/2;
  if(nextT<ac.currentTime)nextT=ac.currentTime+0.05;
  while(nextT<ac.currentTime+0.35){
    const bar=Math.floor(step/8)%CHORDS.length,i=step%8,ch=CHORDS[bar];
    if(i===0)drone(NOTE(ch[0]-12),nextT,eighth*8.5);
    pluck(musicBus,NOTE(ch[ARP[i]]),nextT,eighth*3,0.10);
    if((i===0||i===4||(battle&&i===6))&&prng()<0.8)pluck(musicBus,NOTE(SCALE[Math.floor(prng()*SCALE.length)]),nextT+(i===6?eighth*0.5:0),eighth*4,0.07);
    if(battle&&(i===0||i===3||i===4||i===6))tabor(nextT,i===0?0.22:0.12);
    nextT+=eighth;step++;
  }
}
export function setMusicMode(m){
  musicMode=m;
  if(m!=='off'&&!musicTimer)musicTimer=setInterval(schedule,100);
  if(m==='off'&&musicTimer){clearInterval(musicTimer);musicTimer=null;}
  if(ac)applyLevels();
}
export function duckMusic(on){duck=on?0.35:1;applyLevels();}

// ---------- lifecycle ----------
export function initSound(){
  const unlock=()=>{if(!ensure())return;if(ac.state!=='running')ac.resume().then(()=>{applyLevels();schedule();}).catch(()=>{});};
  addEventListener('pointerdown',unlock,true);addEventListener('keydown',unlock,true);addEventListener('touchend',unlock,true);
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('button'))sfx('click');},true);
  document.addEventListener('visibilitychange',()=>{if(!ac)return;if(document.hidden)ac.suspend().catch(()=>{});else ac.resume().catch(()=>{});});
  setMusicMode('menu');
}

let stallT=0;
// Called once per rendered frame while a battle is running.
export function soundFrame(dt,playing){
  if(!playing||!G||!G.me){stallT=0;return;}
  const me=G.me;
  if(me.stalling&&!me.dead&&G.state==='play'){stallT-=dt;if(stallT<=0){sfx('stall');stallT=0.7;}}else stallT=0;
}

export function soundInfo(){return {state:ac?ac.state:'none',settings:soundSettings(),music:musicMode,voices,played:Object.assign({},played)};}
