// Hand-drawn ink line helpers.
import {ctx} from '../view.js';
export const hsh=n=>{n=Math.sin(n*127.1+311.7)*43758.5453;return n-Math.floor(n);};
export function sk(x1,y1,x2,y2,s){const j=1.4;ctx.moveTo(x1+(hsh(s+2)-.5)*j,y1+(hsh(s+3)-.5)*j);ctx.quadraticCurveTo((x1+x2)/2+(hsh(s)-.5)*2.6,(y1+y2)/2+(hsh(s+1)-.5)*2.6,x2+(hsh(s+4)-.5)*j,y2+(hsh(s+5)-.5)*j);}
export function skRect(x,y,w,h,s){const o=3;sk(x-o*hsh(s+7),y,x+w+o*hsh(s+8),y,s);sk(x+w,y-o*hsh(s+9),x+w,y+h+o*hsh(s+10),s+11);sk(x+w+o*hsh(s+12),y+h,x-o*hsh(s+13),y+h,s+17);sk(x,y+h+o*hsh(s+14),x,y-o*hsh(s+15),s+23);}
