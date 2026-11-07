// Sound controls: 🔊/🔇 button during battle (also the M key) and
// effects / music toggles in the workshop.
import {onLangChange,t} from '../i18n/index.js';
import {onSoundChange,setSound,soundSettings} from '../sound.js';
import {$} from '../util.js';

function render(s){
  const btn=$('soundBtn');
  btn.textContent=s.muted?'🔇':'🔊';
  btn.title=s.muted?t('snd.unmute'):t('snd.mute');
  btn.setAttribute('aria-label',btn.title);
  const fx=$('sfxToggle'),mu=$('musicToggle'),on=k=>s[k]&&!s.muted;
  fx.textContent=t(on('sfx')?'snd.fx.on':'snd.fx.off');fx.classList.toggle('on',on('sfx'));
  mu.textContent=t(on('music')?'snd.music.on':'snd.music.off');mu.classList.toggle('on',on('music'));
}

export function initSoundUI(){
  $('soundBtn').onclick=e=>{e.currentTarget.blur();setSound({muted:!soundSettings().muted});};
  // turning a channel on from the workshop also lifts a global mute
  $('sfxToggle').onclick=()=>{const s=soundSettings(),now=s.sfx&&!s.muted;setSound({sfx:!now,muted:false});};
  $('musicToggle').onclick=()=>{const s=soundSettings(),now=s.music&&!s.muted;setSound({music:!now,muted:false});};
  addEventListener('keydown',e=>{if(e.target&&/^(INPUT|TEXTAREA)$/.test(e.target.tagName))return;if((e.key==='m'||e.key==='M')&&!e.repeat)setSound({muted:!soundSettings().muted});});
  onSoundChange(render);
  onLangChange(()=>render(soundSettings()));
  render(soundSettings());
}
