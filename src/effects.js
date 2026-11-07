// Particles and floating text.
import {INK} from './data.js';
import {G} from './state.js';
import {rnd} from './util.js';
export function spark(x,y,type,n){
  const P=G.parts;
  if(type==='fire'){for(let i=0;i<(n||16);i++){const a=rnd(0,7),v=rnd(40,260);P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:rnd(.35,.8),max:.8,type:'fire',sz:rnd(3,8)});}}
  else if(type==='flame'){P.push({x:x+rnd(-14,14),y,vx:rnd(-10,10),vy:rnd(-90,-40),life:rnd(.3,.6),max:.6,type:'fire',sz:rnd(3,7)});}
  else if(type==='smoke'){P.push({x:x+rnd(-6,6),y:y+rnd(-6,6),vx:rnd(-20,20),vy:rnd(-50,-15),life:rnd(.8,1.6),max:1.6,type:'smoke',sz:rnd(6,14)});}
  else if(type==='debris'){for(let i=0;i<(n||8);i++){const a=rnd(Math.PI*1.1,Math.PI*1.9),v=rnd(120,360);P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.9,1.8),max:1.8,type:'debris',sz:rnd(4,10),rot:rnd(0,6),vr:rnd(-8,8)});}}
  else if(type==='spark'){for(let i=0;i<(n||10);i++){const a=rnd(0,7),v=rnd(80,240);P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.2,.5),max:.5,type:'spark',sz:2});}}
  else if(type==='splinter'){for(let i=0;i<(n||12);i++){const a=rnd(0,7),v=rnd(60,300);P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-100,life:rnd(1,2),max:2,type:'debris',sz:rnd(3,7),rot:rnd(0,6),vr:rnd(-10,10),wood:true});}}
}
export function floater(x,y,text,color){G.floaters.push({x,y,text,color:color||INK,life:1.6});}
