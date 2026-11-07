// Main canvas, viewport scale and resize.
import {buildVignette} from './draw/paper.js';
import {mode} from './flow.js';
import {G} from './state.js';
import {drawFortPic} from './ui/build.js';
import {$} from './util.js';
export const cv=$('game'),ctx=cv.getContext('2d');
export let scale=1,viewW=1000,viewH=650,dpr=1;
export function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(innerWidth*dpr);cv.height=Math.round(innerHeight*dpr);
  scale=Math.min(innerHeight/650,innerWidth/1000)*dpr;viewW=cv.width/scale;viewH=cv.height/scale;
  buildVignette();
  $('rotate').classList.toggle('hidden',!(G&&mode==='play'&&innerHeight>innerWidth*1.1));
  if(mode==='menu')drawFortPic();
}
export function initView(){
addEventListener('resize',resize);
}
