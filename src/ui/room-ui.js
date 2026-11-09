// "vs. a Friend" screen: create a room or join with a code, then the lobby.
import {onLangChange,t} from '../i18n/index.js';
import {cleanCode} from '../net/code.js';
import {clearEnded,createRoom,joinRoom,leaveRoom,onRoomChange,roomInfo,roomLink} from '../net/room.js';
import {$} from '../util.js';

let busy=false,msg='',from='titleScreen';
const isOpen=()=>!$('roomScreen').classList.contains('hidden');

export function openRoomScreen(){
  if(!isOpen())from=$('titleScreen').classList.contains('hidden')?'buildScreen':'titleScreen';
  $(from).classList.add('hidden');$('roomScreen').classList.remove('hidden');
  msg='';render();
}
function close(){$('roomScreen').classList.add('hidden');$(from).classList.remove('hidden');clearEnded();}

function playerRow(uid,r){
  const you=uid===r.uid,row=document.createElement('div');row.className='roomPlayer';
  const name=document.createElement('span');name.className='roomName';
  name.textContent=(r.players[uid].name||t('room.guestName'))+(you?' '+t('room.you'):'');
  row.appendChild(name);
  if(uid===r.meta.host){const h=document.createElement('i');h.textContent=t('room.host');row.appendChild(h);}
  return row;
}

function render(){
  const {room:r,ended}=roomInfo();
  $('roomMenu').classList.toggle('hidden',!!r);
  $('roomLobby').classList.toggle('hidden',!r);
  $('roomCreate').disabled=$('roomJoin').disabled=busy;
  if(!r){
    $('roomMsg').textContent=busy?t('room.connecting'):ended?t('room.err.'+ended):msg;
    return;
  }
  $('roomCode').textContent=r.code;
  const box=$('roomPlayers');box.textContent='';
  if(r.meta){
    const order=[r.meta.host,r.meta.guest].filter(u=>u&&r.players[u]);
    for(const u of order)box.appendChild(playerRow(u,r));
  }
  const both=!!(r.meta&&r.meta.guest&&r.players[r.meta.guest]&&r.players[r.meta.host]);
  $('roomStatus').textContent=t(both?'room.ready':'room.waiting');
  $('roomInvite').classList.toggle('hidden',r.role!=='host'||both);
  $('roomInviteMsg').classList.toggle('hidden',r.role!=='host'||both);
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
  $('roomLeave').onclick=()=>run(leaveRoom);
  $('roomBack').onclick=close;
  onRoomChange(render);
  onLangChange(()=>{if(isOpen())render();});
}
