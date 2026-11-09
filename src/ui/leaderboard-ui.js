// "🏆 Leaderboard" screen: Friends / Everyone tabs, a view picker (campaign easy/medium/hard,
// duel), nickname, friend code, invite link and add-by-code. Opened from the workshop.
import {onLangChange,t} from '../i18n/index.js';
import {addFriend,available,findByCode,inviteLink,leaveBoard,loadList,myCode,myUid,onBoard,onInvite,onLbChange,setNick} from '../leaderboard/index.js';
import {rankName} from '../progress.js';
import {prog} from '../state.js';
import {info as cloudInfo,onSyncChange} from '../sync/index.js';
import {$} from '../util.js';
import {refreshBuild} from './build.js';

let tab='friends',view='easy',editing=false,pendingRow=null,loadSeq=0;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isOpen=()=>!$('lbScreen').classList.contains('hidden');

function updateEntry(){
  const ok=available()&&cloudInfo().status!=='off';
  $('lbBtn').classList.toggle('hidden',!ok);
}

let lbFrom='buildScreen';
export function openLeaderboard(){
  if(!isOpen())lbFrom=$('titleScreen').classList.contains('hidden')?'buildScreen':'titleScreen';
  $(lbFrom).classList.add('hidden');$('lbScreen').classList.remove('hidden');
  render();
}
function close(){$('lbScreen').classList.add('hidden');$(lbFrom).classList.remove('hidden');if(lbFrom==='buildScreen')refreshBuild();}

function renderMe(){
  const box=$('lbMe');
  if(onBoard()&&!editing){
    box.innerHTML=`<div>${esc(t('lb.yourNick',{name:prog.nick}))}</div><div class="lbRow"><button id="lbEdit">${esc(t('lb.change'))}</button><button id="lbLeave">${esc(t('lb.leave'))}</button></div>`;
    $('lbEdit').onclick=()=>{editing=true;renderMe();};
    $('lbLeave').onclick=()=>{leaveBoard();render();};
  }else{
    const guest=cloudInfo().isAnonymous!==false;
    box.innerHTML=`<div class="small">${esc(onBoard()?t('lb.meTitle'):t('lb.notOnBoard'))}</div>
      <div class="lbRow"><input id="lbNick" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${esc(t('lb.nickPh'))}" value="${esc(prog.nick||'')}"><button id="lbNickSave" class="buy">${esc(onBoard()?t('lb.save'):t('lb.join'))}</button>${editing?`<button id="lbNickCancel">${esc(t('lb.cancel'))}</button>`:''}</div>
      <div id="lbNickMsg" class="small lbMsg" style="color:var(--red)"></div>${guest?`<div class="small">${esc(t('lb.guestHint'))}</div>`:''}`;
    const save=()=>{const p=setNick($('lbNick').value);if(p){$('lbNickMsg').textContent=t('lb.nick.'+p);return;}editing=false;render();};
    $('lbNickSave').onclick=save;
    $('lbNick').onkeydown=e=>{if(e.key==='Enter')save();};
    if(editing)$('lbNickCancel').onclick=()=>{editing=false;renderMe();};
  }
  $('lbCode').innerHTML=onBoard()?`${esc(t('lb.myCode'))} <span class="lbCode">${esc(myCode())}</span>`:esc(t('lb.codeNeedsJoin'));
  $('lbInviteBtn').disabled=!onBoard();
}

function cells(r,place){
  const rank=`<span class="num" title="${esc(rankName(r.rank))}">${r.rank}</span>`;
  if(view==='duel')return `<td class="num">${place}</td><td class="nm">${esc(r.name)}</td><td>${rank}</td><td class="num">${r.duelWins}</td><td></td>`;
  const lvl=r.lvl&&r.lvl[view]||0,best=r.best&&r.best[view]||0;
  return `<td class="num">${place}</td><td class="nm">${esc(r.name)}</td><td>${rank}</td><td class="num">${lvl}</td><td class="num">${best?esc(t('hud.seconds',{s:best.toFixed(1)})):'—'}</td>`;
}

async function renderList(){
  const seq=++loadSeq;
  $('lbColA').textContent=view==='duel'?t('lb.col.wins'):t('lb.col.level');
  $('lbColB').textContent=view==='duel'?'':t('lb.col.time');
  $('lbMsg').textContent=t('lb.loading');
  let res;
  try{res=await loadList(tab,view);}
  catch(e){if(seq!==loadSeq)return;$('lbBody').innerHTML='';$('lbPlace').textContent='';const st=cloudInfo().status;$('lbMsg').textContent=st==='offline'||st==='error'?t('lb.offlineNone'):t('lb.loading');return;}
  if(seq!==loadSeq)return;
  const uid=myUid();
  $('lbBody').innerHTML=res.rows.map((r,i)=>`<tr class="${r.uid===uid?'me':''}" data-uid="${esc(r.uid)}">${cells(r,i+1)}</tr>`).join('');
  $('lbMsg').textContent=res.stale?t('lb.offline'):res.rows.length?'':(tab==='friends'?t('lb.emptyFriends'):t('lb.empty'));
  const p=res.me&&res.me.place;
  $('lbPlace').textContent=p&&!res.rows.slice(0,50).some(r=>r.uid===uid)?t('lb.yourPlace',{n:p}):'';
}

function renderInvite(){
  const box=$('lbInvite');
  box.classList.toggle('hidden',!pendingRow);
  if(pendingRow)$('lbInviteTxt').textContent=t('lb.inviteAsk',{name:pendingRow.name});
}

function render(){
  if(!isOpen())return;
  document.querySelectorAll('#lbTabs button').forEach(b=>b.classList.toggle('on',b.dataset.lbtab===tab));
  document.querySelectorAll('#lbViews button').forEach(b=>b.classList.toggle('on',b.dataset.view===view));
  $('lbCodeIn').placeholder=t('lb.codePh');
  renderMe();renderInvite();renderList();
}

function friendMsg(key,name){$('lbFriendMsg').textContent=t('lb.'+key,{name:name||''});}

export function initLeaderboardUI(){
  $('lbBtn').onclick=openLeaderboard;
  $('lbClose').onclick=close;
  document.querySelectorAll('#lbTabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.lbtab;render();});
  document.querySelectorAll('#lbViews button').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
  $('lbInviteBtn').onclick=async()=>{
    const url=inviteLink();
    try{
      if(navigator.share&&/Mobi|Android/i.test(navigator.userAgent)){await navigator.share({text:t('lb.inviteText',{url})});return;}
      await navigator.clipboard.writeText(t('lb.inviteText',{url}));$('lbFriendMsg').textContent=t('lb.inviteCopied');
    }catch(e){$('lbFriendMsg').textContent=url;}
  };
  const add=async()=>{
    const r=await findByCode($('lbCodeIn').value).catch(()=>({error:'notFound'}));
    if(r.error){friendMsg(r.error);return;}
    friendMsg(addFriend(r.row),r.row.name);$('lbCodeIn').value='';render();
  };
  $('lbAddBtn').onclick=add;
  $('lbCodeIn').onkeydown=e=>{if(e.key==='Enter')add();};
  $('lbInviteYes').onclick=()=>{if(pendingRow){const row=pendingRow;pendingRow=null;tab='friends';openLeaderboard();friendMsg(addFriend(row),row.name);}};
  $('lbInviteNo').onclick=()=>{pendingRow=null;renderInvite();};
  // an invite link (?friend=CODE) opens the screen with a question once the cloud is ready
  onInvite(row=>{if(row.uid===myUid())return;pendingRow=row;tab='friends';if(!$('buildScreen').classList.contains('hidden')||!$('titleScreen').classList.contains('hidden')||isOpen())openLeaderboard();});
  onLbChange(()=>{if(isOpen())renderList();});
  onSyncChange(()=>{updateEntry();if(isOpen())renderList();}); // opened before the cloud was ready
  onLangChange(()=>{updateEntry();render();});
  updateEntry();
}
