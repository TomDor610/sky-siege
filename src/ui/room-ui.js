// "vs. a Friend" screen: create a room or join with a code, the lobby, and (stage 2) the
// reveal of both loadouts after the blind build. The build itself is in vs-ui.js.
import {DEF} from '../data.js';
import {drawMachine} from '../draw/machine.js';
import {toMenu,toTitle} from '../flow.js';
import {onLangChange,t} from '../i18n/index.js';
import {cleanCode} from '../net/code.js';
import {backToLobby,bothHere,clearEnded,createRoom,joinRoom,leaveRoom,onRoomChange,roomInfo,roomLink,startBuild} from '../net/room.js';
import {$} from '../util.js';
import {drawFortPic} from './build.js';
import {clearCancelled,onVsChange,vsInfo} from './vs-ui.js';

let busy=false,msg='',from='titleScreen',drawnReveal=null;
const isOpen=()=>!$('roomScreen').classList.contains('hidden');

export function openRoomScreen(){
  if(!isOpen())from=$('titleScreen').classList.contains('hidden')?'buildScreen':'titleScreen';
  $(from).classList.add('hidden');$('roomScreen').classList.remove('hidden');
  msg='';render();
}
function close(){
  $('roomScreen').classList.add('hidden');clearEnded();clearCancelled();
  if(from==='titleScreen')toTitle();else toMenu();
}

const nameOf=(r,uid)=>(r.players[uid]&&r.players[uid].name)||t('room.guestName');

function playerRow(uid,r){
  const you=uid===r.uid,row=document.createElement('div');row.className='roomPlayer';
  const name=document.createElement('span');name.className='roomName';
  name.textContent=nameOf(r,uid)+(you?' '+t('room.you'):'');
  row.appendChild(name);
  if(uid===r.meta.host){const h=document.createElement('i');h.textContent=t('room.host');row.appendChild(h);}
  return row;
}

// ---- reveal: both loadouts side by side
function summary(l){
  const b=l.build,f=l.fort,parts=[t(`style.${b.style}.name`)];
  for(const k of ['wings','props','armor','crossbows'])if(b[k])parts.push(`${t(`part.${k}.name`)} ${b[k]}`);
  parts.push(`${t(`bomb.${b.bombType}.plural`)} ${b.bombs}`);
  const n={};for(const s of f.slots)if(s)n[s]=(n[s]||0)+1;
  const defs=Object.keys(DEF).filter(k=>n[k]).map(k=>t(`def.${k}.count`,{n:n[k]}));
  if(f.walls)defs.push(`${t('walls.name')} ${f.walls}`);
  return [parts.join(' · '),defs.length?defs.join(' · '):t('vs.noDefs')];
}
function fillColumn(box,title,l){
  box.textContent='';
  const h=document.createElement('h3');h.textContent=title;box.appendChild(h);
  const m=document.createElement('canvas');m.className='vsMach';box.appendChild(m);
  const f=document.createElement('canvas');f.className='vsFort';box.appendChild(f);
  for(const line of summary(l)){const p=document.createElement('div');p.className='small';p.textContent=line;box.appendChild(p);}
  requestAnimationFrame(()=>{
    const dp=window.devicePixelRatio||1,w=m.clientWidth,h=m.clientHeight;if(!w)return;
    m.width=Math.round(w*dp);m.height=Math.round(h*dp);
    const c=m.getContext('2d');c.setTransform(dp,0,0,dp,0,0);
    const air=l.build.style==='airship',sc=Math.min(w/125,h/(air?95:60));
    c.translate(w/2,h/2+(air?19*sc:2*sc));c.scale(sc,sc);drawMachine(c,l.build,0,l.build.bombs,false);
    drawFortPic(f,l.fort,true,false);
  });
}
function renderReveal(r,rev){
  if(rev.loading||rev.failed){$('vsMine').textContent='';$('vsTheirs').textContent=rev.failed?t('room.err.offline'):t('lb.loading');drawnReveal=null;}
  else if(drawnReveal!==rev){
    drawnReveal=rev;
    fillColumn($('vsMine'),nameOf(r,r.uid)+' '+t('room.you'),rev.mine);
    fillColumn($('vsTheirs'),nameOf(r,r.role==='host'?r.meta.guest:r.meta.host),rev.theirs);
  }
  $('roomBackLobby').classList.toggle('hidden',r.role!=='host');
  $('roomRevealWait').textContent=r.role==='host'?'':t('vs.waitBack');
}

function render(){
  const {room:r,ended}=roomInfo(),vs=vsInfo();
  const rev=r&&r.meta&&r.meta.state==='reveal'&&vs.revealed;
  $('roomMenu').classList.toggle('hidden',!!r);
  $('roomLobby').classList.toggle('hidden',!r||!!rev);
  $('roomReveal').classList.toggle('hidden',!rev);
  $('roomCreate').disabled=$('roomJoin').disabled=busy;
  if(!r){
    $('roomMsg').textContent=busy?t('room.connecting'):ended?t('room.err.'+ended):msg;
    return;
  }
  if(rev){renderReveal(r,rev);return;}
  $('roomCode').textContent=r.code;
  const box=$('roomPlayers');box.textContent='';
  if(r.meta){
    const order=[r.meta.host,r.meta.guest].filter(u=>u&&r.players[u]);
    for(const u of order)box.appendChild(playerRow(u,r));
  }
  const both=bothHere(r),host=r.role==='host';
  $('roomStatus').textContent=t(both?'room.ready':'room.waiting');
  $('roomInvite').classList.toggle('hidden',!host||both);
  $('roomInviteMsg').classList.toggle('hidden',!host||both);
  $('roomStart').classList.toggle('hidden',!host||!both);
  $('roomStart').disabled=busy;
  $('roomWaitHost').textContent=!host&&both?t('room.waitHost'):'';
  $('roomLobbyMsg').textContent=vs.cancelled?t('vs.cancelled'):'';
}

async function run(action){
  if(busy)return;
  busy=true;msg='';render();
  try{await action();}
  catch(e){msg=t('room.err.'+(e.roomError||'offline'));}
  busy=false;render();
}

// Web Share where the device offers it, otherwise copy the link.
async function invite(){
  const {room:r}=roomInfo();if(!r)return;
  const url=roomLink(r.code),text=t('room.inviteText',{code:r.code}),say=$('roomInviteMsg');
  if(navigator.share){
    try{await navigator.share({text,url});return;}
    catch(e){if(e&&e.name==='AbortError')return;}
  }
  try{await navigator.clipboard.writeText(`${text} ${url}`);say.textContent=t('room.copied');}
  catch(e){say.textContent=url;}
}

// ?room=ABCD: open the screen and join (the code is removed from the address).
export function handleRoomLink(){
  const raw=new URLSearchParams(location.search).get('room');
  if(!raw)return;
  const u=new URL(location.href);u.searchParams.delete('room');history.replaceState(null,'',u.toString());
  const code=cleanCode(raw);
  openRoomScreen();
  $('roomCodeIn').value=code;
  run(()=>joinRoom(code));
}

export function initRoomUI(){
  $('roomCreate').onclick=()=>run(createRoom);
  const join=()=>run(()=>joinRoom($('roomCodeIn').value));
  $('roomJoin').onclick=join;
  $('roomCodeIn').oninput=e=>{e.target.value=cleanCode(e.target.value);};
  $('roomCodeIn').onkeydown=e=>{if(e.key==='Enter')join();};
  $('roomInvite').onclick=invite;
  $('roomStart').onclick=()=>{clearCancelled();run(startBuild);};
  $('roomBackLobby').onclick=()=>run(backToLobby);
  $('roomLeave').onclick=()=>run(leaveRoom);
  $('vsLeave').onclick=()=>run(leaveRoom);
  $('roomBack').onclick=close;
  onRoomChange(render);
  onVsChange(render);
  onLangChange(()=>{drawnReveal=null;if(isOpen())render();});
}
