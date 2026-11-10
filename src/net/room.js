// Private rooms: create, join, presence, leave. No game state yet (design: docs/design/1v1.md).
// The host owns the room: when the host leaves or disconnects the room is deleted.
import {prog} from '../state.js';
import {activeConfig,emulators,ensureSignedIn,netAvailable} from '../sync/index.js';
import {cleanCode,randomCode,ROOM_TTL,validCode} from './code.js';

const TIMEOUT=10000;
const fail=code=>Object.assign(new Error(code),{roomError:code});
const timed=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(fail('offline')),TIMEOUT))]);

let net=null,room=null,ended=null,stops=[],expiry=null;
const listeners=[];
export const onRoomChange=f=>listeners.push(f);
const notify=()=>listeners.forEach(f=>f());

// {code, role, uid, meta, players, ready} while in a room; ended = why the last room ended
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
  room=null;
  if(net)net.offline();
}
function end(reason){cleanup();ended=reason;notify();}

function enter(code,role,uid){
  room={code,role,uid,meta:null,players:{},ready:{}};ended=null;
  let wasConnected=false;
  stops.push(net.onConnected(c=>{
    if(c)wasConnected=true;
    else if(wasConnected&&room)end('lost');  // the server has already dropped our seat
  }));
  stops.push(net.watchMeta(code,m=>{
    if(!room)return;
    if(!m){end(role==='host'?'lost':'hostLeft');return;}
    room.meta=m;notify();
  }));
  stops.push(net.watchPlayers(code,p=>{if(room){room.players=p;notify();}}));
  stops.push(net.watchReady(code,r=>{if(room){room.ready=r;notify();}}));
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

export async function leaveRoom(){
  if(!room)return;
  const {code,role,uid}=room;
  stops.forEach(s=>s());stops=[];
  try{await timed(role==='host'?net.closeRoom(code):net.leaveSeat(code,uid));}catch(e){}
  cleanup();ended=null;notify();
}

// ---- blind build (stage 2): the server clock decides when the 60 seconds are up
export const BUILD_MS=60000;
export const serverNow=()=>(net?net.now():Date.now());
export const opponentOf=r=>(r.role==='host'?r.meta.guest:r.meta.host);
export const bothHere=r=>!!(r&&r.meta&&r.meta.guest&&r.players[r.meta.guest]&&r.players[r.meta.host]);
export async function startBuild(){
  const r=room;if(!r||r.role!=='host'||!bothHere(r))return;
  await timed(net.startBuild(r.code,(r.meta.round||0)+1,Math.round(serverNow()+BUILD_MS)));
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

export function roomLink(code){
  const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',code);
  return u.toString();
}
