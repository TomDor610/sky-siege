// Keyboard and touch input.
import {mode,pause} from './flow.js';
import {G} from './state.js';
export const input={up:false,down:false,shoot:false};
export const pressed={bomb:false,flip:false};
export const isTouch=window.matchMedia('(pointer: coarse)').matches||('ontouchstart' in window);
export function initInput(){
addEventListener('keydown',e=>{
  if(!G||mode!=='play')return;const k=e.key,pl=G.me;
  if(k==='ArrowUp'||k==='w'||k==='W')input.up=true;
  else if(k==='ArrowDown'||k==='s'||k==='S')input.down=true;
  else if(k===' '||k==='Enter'){if(!e.repeat)pressed.bomb=true;}
  else if(k==='x'||k==='X'||k==='k'||k==='K')input.shoot=true;
  else if(k==='ArrowLeft'||k==='a'||k==='A'){if(!e.repeat&&pl.facing===1)pressed.flip=true;}
  else if(k==='ArrowRight'||k==='d'||k==='D'){if(!e.repeat&&pl.facing===-1)pressed.flip=true;}
  else if(k==='f'||k==='F'){if(!e.repeat)pressed.flip=true;}
  else if(k==='Escape'||k==='p'||k==='P')pause();
  else return;e.preventDefault();
});
addEventListener('keyup',e=>{const k=e.key;
  if(k==='ArrowUp'||k==='w'||k==='W')input.up=false;
  if(k==='ArrowDown'||k==='s'||k==='S')input.down=false;
  if(k==='x'||k==='X'||k==='k'||k==='K')input.shoot=false;});
document.querySelectorAll('.tbtn').forEach(el=>{
  const k=el.dataset.k;
  const on=e=>{e.preventDefault();el.classList.add('on');if(k==='bomb')pressed.bomb=true;else if(k==='flip')pressed.flip=true;else input[k]=true;try{el.setPointerCapture(e.pointerId)}catch(_){}};
  const off=()=>{el.classList.remove('on');if(k in input)input[k]=false;};
  el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('lostpointercapture',off);
});
}
