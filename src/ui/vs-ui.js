// 1v1 blind build (stage 2): the workshop in 1v1 mode with a shared 60-second timer and a
// Ready button, then the reveal of both loadouts. Follows the room state from the server:
//   lobby -> build (host starts) -> reveal (both ready, or time is up) -> lobby (host).
// A player leaving during the build or the reveal cancels the match.
import {t} from '../i18n/index.js';
import {decodeLoadout,encodeLoadout} from '../net/loadout.js';
import {backToLobby,bothHere,onRoomChange,readLoadouts,reveal,roomInfo,saveLoadout,serverNow,setReady} from '../net/room.js';
import {onVsSaved,sanitize,setVsMode,vsMode} from '../progress.js';
import {build,fort,setBuild,setFort} from '../state.js';
import {$,store} from '../util.js';
import {toVsBuild} from '../flow.js';

let saved=null;        // the player's own build/fort, put back after the 1v1 build
let round=0,ready=false,timer=null,pushTimer=null,flushed=false,revealed=null,cancelled=false,lastTry=0;
const listeners=[];
export const onVsChange=f=>listeners.push(f);
const notify=()=>listeners.forEach(f=>f());
export const vsInfo=()=>({active:vsMode,round,ready,revealed,cancelled});
export const clearCancelled=()=>{cancelled=false;};

const clone=v=>JSON.parse(JSON.stringify(v));

function enterBuild(r){
  round=r.meta.round;ready=false;flushed=false;revealed=null;cancelled=false;
  if(!vsMode){
    saved={build:clone(build),fort:clone(fort)};
    let last=null;try{last=JSON.parse(store.get('skysiege_1v1')||'null');}catch(e){}
    setVsMode(true);
    setBuild(clone(last&&last.build&&last.build.wings?last.build:saved.build));
    setFort(clone(last&&last.fort&&last.fort.slots?last.fort:saved.fort));
    sanitize();
  }
  showBuild();
  push(true);
  clearInterval(timer);timer=setInterval(tick,200);tick();
  notify();
}

function exitBuild(){
  clearInterval(timer);timer=null;clearTimeout(pushTimer);
  if(!vsMode)return;
  setVsMode(false);
  if(saved){setBuild(saved.build);setFort(saved.fort);saved=null;}
  sanitize();
  document.body.classList.remove('vs1','vsReady');
}

// keep the server copy of the loadout current, so "time's up" uses the latest version
function push(now){
  clearTimeout(pushTimer);
  const send=()=>saveLoadout(encodeLoadout(build,fort)).catch(()=>{});
  if(now)return send();
  pushTimer=setTimeout(send,250);
}

function tick(){
  const {room:r}=roomInfo();
  if(!r||!r.meta||r.meta.state!=='build')return;
  const left=Math.max(0,r.meta.buildEndsAt-serverNow());
  $('vsTimer').textContent='⏳ '+Math.ceil(left/1000);
  $('vsTimer').classList.toggle('low',left<10000);
  if(left<1200&&!flushed){flushed=true;push(true);}
  const both=r.ready[r.meta.host]===round&&r.ready[r.meta.guest]===round;
  if((both||left<=0)&&Date.now()-lastTry>1000){lastTry=Date.now();reveal();}
}

function renderBar(){
  const {room:r}=roomInfo();if(!r||!r.meta)return;
  const opp=r.role==='host'?r.meta.guest:r.meta.host,oppReady=r.ready[opp]===round;
  $('vsOpp').textContent=t(oppReady?'vs.oppReady':'vs.oppBuilding');
  $('vsReady').textContent=ready?t('vs.unready'):t('vs.ready');
  $('vsReady').classList.toggle('buy',!ready);
  $('vsHint').textContent=ready?t('vs.youReady'):t('vs.hint');
  document.body.classList.toggle('vsReady',ready);
}

function showBuild(){
  $('roomScreen').classList.add('hidden');
  toVsBuild();
  renderBar();
}
function showRoom(){
  $('buildScreen').classList.add('hidden');
  $('roomScreen').classList.remove('hidden');
}

async function onRoom(){
  const {room:r}=roomInfo();
  if(!r){
    if(vsMode){exitBuild();showRoom();}
    revealed=null;round=0;notify();return;
  }
  if(!r.meta)return;
  const st=r.meta.state;
  // the opponent left in the middle of a match: cancel it (the host puts the room back)
  if((st==='build'||st==='reveal')&&!bothHere(r)){
    if(vsMode){exitBuild();showRoom();}
    revealed=null;cancelled=true;
    if(r.role==='host')backToLobby();
    notify();return;
  }
  if(st==='build'){
    if(!vsMode||r.meta.round!==round)enterBuild(r);
    else renderBar();
    return;
  }
  if(vsMode)exitBuild();
  if(st==='reveal'&&(!revealed||revealed.round!==r.meta.round)){
    revealed={round:r.meta.round,loading:true};showRoom();notify();
    try{
      const l=await readLoadouts();
      if(l&&l.mine&&l.theirs)revealed={round:r.meta.round,mine:decodeLoadout(l.mine),theirs:decodeLoadout(l.theirs)};
    }catch(e){revealed={round:r.meta.round,failed:true};}
    notify();return;
  }
  if(st==='lobby'&&revealed){revealed=null;showRoom();notify();}
}

export function initVsUI(){
  onRoomChange(onRoom);
  onVsSaved(()=>{if(!ready)push(false);});
  $('vsReady').onclick=async()=>{
    const want=!ready;
    if(want)await push(true);
    try{await setReady(want);ready=want;}catch(e){}
    renderBar();tick();
  };
}
export const inVsBuild=()=>vsMode;
export {renderBar as renderVsBar};
