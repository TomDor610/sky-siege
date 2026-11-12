// Private rooms: create, join, presence, leave (design: docs/design/1v1.md).
// The host owns the room: when the host leaves or disconnects the room is deleted. During a
// battle a drop only marks the player away (battle/away), and the friend waits up to 20 s.
import {prog} from '../state.js';
import {activeConfig,emulators,ensureSignedIn,netAvailable} from '../sync/index.js';
import {cleanCode,randomCode,ROOM_TTL,validCode} from './code.js';

const TIMEOUT=10000;
const fail=code=>Object.assign(new Error(code),{roomError:code});
const timed=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(fail('offline')),TIMEOUT))]);

let net=null,room=null,ended=null,stops=[],expiry=null,inBattle=false;
export const AWAY_MS=20000;
const listeners=[];
export const onRoomChange=f=>listeners.push(f);
const notify=()=>listeners.forEach(f=>f());

// {code, role, uid, meta, players, ready, away, offline} while in a room; ended = why the last
// room ended. away = {uid: server time they dropped} (battle only); offline = when I lost the line
export const roomInfo=()=>({room,ended});
export const clearEnded=()=>{ended=null;notify();};

async function connect(){
  if(!netAvailable())throw fail('offline');
  let user;
  try{user=await timed(ensureSignedIn());}catch(e){throw fail('offline');}
  if(!user)throw fail('offline');
  try{
    if(!net){const {createRtdb}=await import('./rtdb.js');net=createRtdb(activeConfig(),emulators());}
  }catch(e){throw fail('offline');}
  net.online();
  return user.uid;
}

function cleanup(){
  stops.forEach(s=>s());stops=[];
  clearTimeout(expiry);expiry=null;
  room=null;inBattle=false;
  if(net)net.offline();
}
function end(reason){cleanup();ended=reason;notify();}

function enter(code,role,uid){
  room={code,role,uid,meta:null,players:{},ready:{},away:{},offline:0};ended=null;
  let wasConnected=false;
  stops.push(net.onConnected(c=>{
    if(c){
      wasConnected=true;
      if(room&&room.offline){room.offline=0;if(inBattle)net.markBack(room.code,room.uid).catch(()=>{});notify();}
    }else if(wasConnected&&room){
      if(inBattle){if(!room.offline){room.offline=Date.now();notify();}}   // the battle waits for us
      else end('lost');  // the server has already dropped our seat
    }
  }));
  stops.push(net.watchMeta(code,m=>{
    if(!room)return;
    if(!m){end(role==='host'?'lost':'hostLeft');return;}
    if(role==='guest'&&m.guest!==uid){end('removed');return;}   // the host freed my seat after I was gone
    room.meta=m;notify();
  }));
  stops.push(net.watchPlayers(code,p=>{if(room){room.players=p;notify();}}));
  stops.push(net.watchReady(code,r=>{if(room){room.ready=r;notify();}}));
  stops.push(net.watchNode(code,'away',a=>{if(room){room.away=a;notify();}}));
  if(role==='host')expiry=setTimeout(checkExpiry,ROOM_TTL+1000);
  notify();
}
// nobody came within the lobby's lifetime
async function checkExpiry(){
  if(!room||room.role!=='host'||room.meta&&room.meta.guest)return;
  const code=room.code;
  try{await timed(net.closeRoom(code));}catch(e){}
  if(room&&room.code===code)end('expired');
}

const myName=()=>prog.nick||'';

export async function createRoom(){
  ended=null;
  try{
    const uid=await connect();
    for(let i=0;i<12;i++){
      const code=randomCode();
      if(await timed(net.createRoom(code,uid,myName(),ROOM_TTL))){enter(code,'host',uid);return code;}
    }
    throw fail('offline');
  }catch(e){if(net)net.offline();throw e.roomError?e:fail('offline');}
}

export async function joinRoom(raw){
  ended=null;
  const code=cleanCode(raw);
  if(!validCode(code))throw fail('bad');
  try{
    const uid=await connect();
    const m=await timed(net.readMeta(code));
    if(!m)throw fail('notFound');
    if(m.createdAt<net.now()-ROOM_TTL)throw fail('expired');
    if(m.host===uid)throw fail('self');
    if(m.guest&&m.guest!==uid)throw fail('full');
    if(!await timed(net.takeGuestSeat(code,uid,myName())))throw fail('full');
    enter(code,'guest',uid);
    return code;
  }catch(e){if(net)net.offline();throw e.roomError?e:fail('offline');}
}

export async function leaveRoom(reason){
  if(!room)return;
  const {code,role,uid}=room,closeIt=role==='host'||awayLong(room,room.meta&&room.meta.host);
  stops.forEach(s=>s());stops=[];
  // a guest whose host never came back closes the room (otherwise it would stay forever)
  try{await timed(closeIt?net.closeRoom(code):net.leaveSeat(code,uid));}catch(e){}
  cleanup();ended=reason||null;notify();
}

// ---- blind build (stage 2): the server clock decides when the 60 seconds are up
export const BUILD_MS=60000;
export const serverNow=()=>(net?net.now():Date.now());
export const opponentOf=r=>(r.role==='host'?r.meta.guest:r.meta.host);
export const bothHere=r=>!!(r&&r.meta&&r.meta.guest&&r.players[r.meta.guest]&&r.players[r.meta.host]);
// away for 20 s or more (by the server's clock)
export const awayLong=(r,uid)=>!!(r&&uid&&r.away&&r.away[uid]&&serverNow()>=r.away[uid]+AWAY_MS);
// both in the room and neither of them gone (a battle drop leaves the seat taken)
export const bothActive=r=>bothHere(r)&&!(r.away&&(r.away[r.meta.host]||r.away[r.meta.guest]));
export const offlineSince=()=>(room&&room.offline)||0;
// battle presence: a drop marks me away instead of closing the room / freeing my seat
export async function setBattlePresence(on){
  const r=room;if(!r||inBattle===on)return;inBattle=on;
  try{await timed(on?net.presenceBattle(r.code,r.uid,r.role):net.presenceRoom(r.code,r.uid,r.role));}catch(e){}
}
export async function markAway(on){const r=room;if(r&&inBattle){try{await timed(on?net.markAway(r.code,r.uid):net.markBack(r.code,r.uid));}catch(e){}}}
// the host frees the seat of a guest who has been gone for 20 s
export async function dropAwayGuest(){
  const r=room;if(!r||r.role!=='host'||!awayLong(r,r.meta.guest))return false;
  try{await timed(net.evict(r.code,r.meta.guest));return true;}catch(e){return false;}
}
export async function startBuild(){
  const r=room;if(!r||r.role!=='host'||!bothHere(r))return;
  await timed(net.startBuild(r.code,(r.meta.round||0)+1,Math.round(serverNow()+BUILD_MS),Math.floor(Math.random()*2147483647)));
}
export async function saveLoadout(l){const r=room;if(r)await timed(net.saveLoadout(r.code,r.uid,{round:r.meta.round,...l}));}
export async function setReady(on){const r=room;if(r)await timed(net.setReady(r.code,r.uid,on?r.meta.round:0));}
// Both players try; the rules accept it once (both ready, or the time is up).
export async function reveal(){const r=room;if(r&&r.meta&&r.meta.state==='build'){try{await timed(net.setState(r.code,'reveal'));}catch(e){}}}
export async function backToLobby(){const r=room;if(r&&r.role==='host'){try{await timed(net.setState(r.code,'lobby'));}catch(e){}}}
export async function readLoadouts(){
  const r=room;if(!r)return null;
  const [mine,theirs]=await Promise.all([timed(net.readLoadout(r.code,r.uid)),timed(net.readLoadout(r.code,opponentOf(r)))]);
  return {mine,theirs};
}

// ---- battle (stage 3): the host moves from the reveal to the battle; meta.battleAt is the
// server's time of that moment, and the battle starts COUNTDOWN_MS later on both sides.
// A refused or lost write is tried again.
export const COUNTDOWN_MS=3000;
export const battleStart=meta=>meta.battleAt+COUNTDOWN_MS;
export async function startBattle(){
  for(let i=0;i<4;i++){
    const r=room;if(!r||r.role!=='host'||r.meta.state!=='reveal')return;
    try{await timed(net.clearBattle(r.code));await timed(net.startBattle(r.code));return;}
    catch(e){await new Promise(f=>setTimeout(f,500));}
  }
}
// low-level access for net/battle.js (the room and both seats are known)
export const battleNet=()=>{const r=room;return r&&{net,code:r.code,uid:r.uid,opp:opponentOf(r),round:r.meta.round};};

export function roomLink(code){
  const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',code);
  return u.toString();
}
