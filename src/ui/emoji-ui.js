// 1v1 emoji (stage 4): a 😀 button in the battle opens a row of 8; keys 1-8 on a keyboard; the same
// row on the result screen. One every 3 s (the rules enforce it too). Muting the friend's emoji
// is a setting (skysiege_emoji = '0').
import {mode} from '../flow.js';
import {onLangChange,t} from '../i18n/index.js';
import {EMOJI,emojiMuted,emojiWait,sendEmoji} from '../net/battle.js';
import {G} from '../state.js';
import {$,store} from '../util.js';

let coolTimer=null;
function cooldown(){
  clearInterval(coolTimer);
  const tick=()=>{
    const wait=emojiWait();
    for(const b of document.querySelectorAll('.emo'))b.disabled=wait>0;
    $('emojiBtn').classList.toggle('cool',wait>0);
    if(!wait)clearInterval(coolTimer);
  };
  tick();coolTimer=setInterval(tick,200);
}
function pick(i){if(sendEmoji(i)){$('emojiBar').classList.add('hidden');cooldown();}}

function fill(box){
  box.textContent='';
  EMOJI.forEach((e,i)=>{
    const b=document.createElement('button');b.className='emo';b.textContent=e;b.title=String(i+1);
    b.onclick=ev=>{ev.stopPropagation();pick(i);};
    box.appendChild(b);
  });
}
function renderSetting(){
  const on=!emojiMuted(),b=$('setEmoji');
  b.textContent=t(on?'set.emoji.on':'set.emoji.off');b.classList.toggle('on',on);
}

export function initEmojiUI(){
  fill($('emojiBar'));fill($('vsEmojiRow'));
  $('emojiBtn').onclick=e=>{e.stopPropagation();$('emojiBar').classList.toggle('hidden');};
  document.addEventListener('keydown',e=>{
    if(!(G&&G.net)||(mode!=='play'&&mode!=='result')||e.repeat)return;
    const n=Number(e.key);if(n>=1&&n<=EMOJI.length)pick(n-1);
  });
  $('setEmoji').onclick=()=>{store.set('skysiege_emoji',emojiMuted()?'1':'0');renderSetting();};
  renderSetting();onLangChange(renderSetting);
}
