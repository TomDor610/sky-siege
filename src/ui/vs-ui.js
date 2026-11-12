// 1v1 blind build (stage 2) and battle (stage 3). The workshop in 1v1 mode with a shared
// 60-second timer and a Ready button, the reveal of both loadouts, then the battle
// (net/battle.js). Follows the room state from the server:
//   lobby -> build (host starts) -> reveal (both ready, or time is up) -> battle (host, 4 s later)
//   -> build again ("another battle": both press it, the host starts it).
// A player leaving during the build or the reveal cancels the match; during the battle it ends it.
import {t} from '../i18n/index.js';
import {decodeLoadout,encodeLoadout} from '../net/loadout.js';
import {abortNet,beginNet,netInfo,onNetChange,sendRematch,setNetStart,stopNet} from '../net/battle.js';
import {backToLobby,goneFor,battleStart,bothActive,bothHere,dropAwayGuest,leaveRoom,onRoomChange,opponentOf,readLoadouts,reveal,roomInfo,saveLoadout,serverNow,setReady,startBattle,startBuild} from '../net/room.js';
import {onVsSaved,sanitize,setVsMode,vsMode} from '../progress.js';
import {build,fort,setBuild,setFort} from '../state.js';
import {$,store} from '../util.js';
import {finish,mode,startNet,toVsBuild,toVsRoom} from '../flow.js';
import {G} from '../state.js';
import {nameOf} from './room-ui.js';

export const REVEAL_MS=4000;   // how long both loadouts are shown before the countdown

let saved=null;        // the player's own build/fort, put back after the 1v1 build
let round=0,ready=false,timer=null,pushTimer=null,flushed=false,revealed=null,cancelled=false,lastTry=0;
let goTimer=null,battleRound=0,rematchAsked=false,rematchSent=0;
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

// ---- battle
const inBattle=()=>G&&G.net&&(mode==='vscount'||mode==='play');
const onResult=()=>mode==='result'&&document.body.classList.contains('vsResult');
function endBattleEarly(){if(inBattle()&&abortNet())finish();}

// both loadouts of a round, read once and shared by the reveal and the battle
let loading=null;
function loadoutsFor(rd){
  if(!loading||loading.round!==rd){
    const p=readLoadouts().then(l=>{if(!l||!l.mine||!l.theirs)throw new Error('missing');return {round:rd,mine:decodeLoadout(l.mine),theirs:decodeLoadout(l.theirs)};});
    loading={round:rd,p};p.catch(()=>{if(loading&&loading.p===p)loading=null;});   // a failed read is tried again
  }
  return loading.p;
}

async function enterBattle(r){
  battleRound=r.meta.round;rematchAsked=false;rematchSent=0;clearTimeout(goTimer);
  let rev=revealed;
  if(!rev||rev.round!==r.meta.round||!rev.mine){
    try{rev=await loadoutsFor(r.meta.round);revealed=rev;}
    catch(e){battleRound=0;setTimeout(onRoom,1000);return;}            // slow line: try again
  }
  const now=roomInfo().room;if(!now||now.meta.state!=='battle'||now.meta.round!==battleRound)return;
  if(!beginNet({mine:rev.mine,theirs:rev.theirs,battleAt:battleStart(r.meta),seed:r.meta.seed,round:r.meta.round,oppName:nameOf(r,opponentOf(r))}))return;
  $('roomScreen').classList.add('hidden');
  startNet();renderResult();
}

function renderResult(){
  // after a technical result there is no "another battle": back to the room and start again
  const {room:r}=roomInfo(),n=netInfo(),tech=n.result==='techWon'||n.result==='techLost',here=!!r&&bothActive(r)&&!tech;
  const b=$('vsRematch');
  b.disabled=!here||!n.active||n.result==='left'||rematchAsked;
  b.textContent=rematchAsked&&here?t('vs.rematchWait'):t('vs.rematch');
  $('vsResMsg').textContent=!here||n.result==='left'?t('vs.oppLeft'):n.rematchTheirs?t('vs.oppRematch'):'';
  // both asked for another battle: the host starts the next blind build
  if(n.active&&n.rematchMine&&n.rematchTheirs&&r&&r.role==='host'&&rematchSent!==n.round){rematchSent=n.round;startBuild().catch(()=>{});}
}

async function onRoom(){
  const {room:r}=roomInfo();
  if(!r){
    if(vsMode){exitBuild();showRoom();}
    clearTimeout(goTimer);endBattleEarly();if(onResult())renderResult();else stopNet();
    revealed=null;round=0;notify();return;
  }
  if(!r.meta)return;
  const st=r.meta.state;
  // the opponent left in the middle of a match: cancel it (the host puts the room back)
  if(st==='battle'&&!bothHere(r)){
    endBattleEarly();
    if(r.role==='host')backToLobby();
    renderResult();return;
  }
  if((st==='build'||st==='reveal')&&!bothHere(r)){
    clearTimeout(goTimer);
    if(vsMode){exitBuild();showRoom();}
    revealed=null;cancelled=true;
    if(r.role==='host')backToLobby();
    notify();return;
  }
  if(st==='build'){
    clearTimeout(goTimer);stopNet();
    if(!vsMode||r.meta.round!==round)enterBuild(r);
    else renderBar();
    return;
  }
  if(vsMode)exitBuild();
  if(st==='reveal'&&(!revealed||revealed.round!==r.meta.round)){
    revealed={round:r.meta.round,loading:true};showRoom();notify();
    try{revealed=await loadoutsFor(r.meta.round);}
    catch(e){revealed={round:r.meta.round,failed:true};}
    // the host starts the battle after both have had a look
    // (even if this read failed: the battle reads the loadouts again, with retries)
    if(r.role==='host'){clearTimeout(goTimer);goTimer=setTimeout(startBattle,REVEAL_MS);}
    notify();return;
  }
  if(st==='battle'){
    if(battleRound!==r.meta.round)await enterBattle(r);
    else{setNetStart(battleStart(r.meta));if(onResult())renderResult();}
    return;
  }
  if(st==='lobby'){
    clearTimeout(goTimer);
    if(onResult()){renderResult();return;}
    if(revealed){revealed=null;showRoom();notify();}
  }
}

export function initVsUI(){
  onRoomChange(onRoom);
  onNetChange(()=>{if(onResult())renderResult();});
  $('vsRematch').onclick=async()=>{
    if(rematchAsked)return;rematchAsked=true;renderResult();
    try{await sendRematch();}catch(e){rematchAsked=false;}
    renderResult();
  };
  // back to the room (the room stays; the host can start a new build from the lobby)
  $('vsExit').onclick=async()=>{
    const {room:r}=roomInfo();
    stopNet();toVsRoom();revealed=null;showRoom();notify();
    // the friend never came back: the guest closes the room, the host frees the seat
    if(r&&r.role==='guest'&&goneFor(r,r.meta.host))await leaveRoom('hostLeft');
    else if(r&&r.role==='host')await dropAwayGuest();
  };
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
