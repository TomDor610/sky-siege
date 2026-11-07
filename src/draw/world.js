// Sky, mountains, notes, clouds, ground, home tower and rearm zone.
import {HOME,INK,WORLD} from '../data.js';
import {hsh,sk,skRect} from './sketch.js';
import {rearmZone} from '../physics.js';
import {t as tr,textDir} from '../i18n/index.js'; // 't' is the time parameter here
import {G} from '../state.js';
import {pick,rnd} from '../util.js';
import {ctx,viewH,viewW} from '../view.js';
export const ridgeFar=[],ridgeMid=[];
for(let i=0;i<=320;i++){ridgeFar.push(-(Math.pow(Math.abs(Math.sin(i*0.085)),1.5)*150+Math.abs(Math.sin(i*0.21+1))*55+Math.sin(i*0.73)*9));
  ridgeMid.push(-(Math.pow(Math.abs(Math.sin(i*0.12+2)),1.3)*95+Math.abs(Math.sin(i*0.33))*35+Math.sin(i*1.1)*7));}
export const NOTE_TXT=["studio del volo degli uccelli","la forza dell'aria","macchina volante","vite aerea","peso e resistenza","il centro della gravità","l'ala e il vento"];
export const notes=[],clouds=[],trees=[];
export function drawRidge(arr,par,base,camx,fill,ink){
  ctx.save();ctx.translate(-camx*par,0);
  const i0=Math.max(0,Math.floor(camx*par/40)-2),i1=Math.min(arr.length-1,i0+Math.ceil(viewW/40)+4);
  const g=ctx.createLinearGradient(0,base-170,0,base+30);g.addColorStop(0,fill);g.addColorStop(1,'rgba(253,247,232,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(i0*40,base+60);for(let i=i0;i<=i1;i++)ctx.lineTo(i*40,base+arr[i]);ctx.lineTo(i1*40,base+60);ctx.closePath();ctx.fill();
  ctx.strokeStyle=ink;ctx.lineWidth=1.3;ctx.beginPath();
  for(let i=i0;i<i1;i++){if(hsh(i*3.7+par*100)<.3)continue;ctx.moveTo(i*40,base+arr[i]);ctx.lineTo(i*40+40,base+arr[i+1]);
    if(hsh(i*1.9)>.6){ctx.moveTo(i*40+10,base+arr[i]+6);ctx.lineTo(i*40+2,base+arr[i]+22);}}
  ctx.stroke();ctx.restore();
}
export function drawSky(camx,camy,t){
  const bottom=WORLD.ground+70-viewH,dy=bottom-camy;
  // red-chalk sun
  {const sx=viewW*.78,sy=110-dy*.04,r=44;ctx.save();ctx.fillStyle='rgba(176,72,40,.13)';ctx.beginPath();ctx.arc(sx,sy,r,0,7);ctx.fill();
    ctx.clip();ctx.strokeStyle='rgba(160,60,35,.22)';ctx.lineWidth=1.2;ctx.beginPath();for(let k=-r;k<r;k+=6){ctx.moveTo(sx+k-20,sy+r);ctx.lineTo(sx+k+20,sy-r);}ctx.stroke();ctx.restore();
    ctx.strokeStyle='rgba(160,60,35,.4)';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(sx,sy,r,0.2,6.1);ctx.stroke();}
  // Da Vinci notes (mirror writing + studies)
  ctx.save();ctx.translate(-camx*.2,dy*.1);
  for(const n of notes){const X=n.x;if(X<camx*.2-120||X>camx*.2+viewW+120)continue;
    ctx.save();ctx.translate(X,n.y);ctx.rotate(n.rot);ctx.strokeStyle='rgba(110,70,40,.2)';ctx.fillStyle='rgba(110,70,40,.22)';ctx.lineWidth=1;
    if(n.type==='text'){ctx.scale(-1,1);ctx.font='italic 15px "Frank Ruhl Libre",Georgia,serif';ctx.textAlign='left';ctx.direction='ltr';
      ctx.fillText(n.txt,0,0);ctx.fillText(n.txt.split(' ').reverse().join(' '),6,18);ctx.fillText(n.txt.slice(0,12)+' e '+n.txt.slice(-6),2,36);}
    else if(n.type==='circle'){ctx.beginPath();ctx.arc(0,0,n.r,0,7);ctx.moveTo(0,0);ctx.lineTo(n.r,0);ctx.moveTo(0,0);ctx.lineTo(n.r*.6,-n.r*.8);ctx.moveTo(n.r*.45,0);ctx.arc(0,0,n.r*.45,0,-0.92,true);ctx.stroke();
      ctx.font='italic 11px serif';ctx.fillText('a',n.r+3,4);ctx.fillText('b',n.r*.6,-n.r*.8-4);ctx.fillText('c',-4,12);}
    else if(n.type==='wing'){ctx.beginPath();ctx.moveTo(-n.r,0);ctx.quadraticCurveTo(0,-n.r,n.r*1.4,-n.r*.3);for(let k=0;k<6;k++){const u=k/5,px=-n.r+u*n.r*2.2,py=-Math.sin(u*Math.PI)*n.r*.55;ctx.moveTo(px,py);ctx.lineTo(px+8,py+n.r*.5);}ctx.stroke();}
    else{ctx.beginPath();ctx.arc(0,0,n.r*.7,0,7);for(let k=0;k<12;k++){const a=k/12*Math.PI*2;ctx.moveTo(Math.cos(a)*n.r*.7,Math.sin(a)*n.r*.7);ctx.lineTo(Math.cos(a)*n.r,Math.sin(a)*n.r);}ctx.moveTo(4,0);ctx.arc(0,0,4,0,7);ctx.stroke();}
    ctx.restore();}
  ctx.restore();
  // far mountains, fog, mid mountains
  const farBase=(WORLD.ground-bottom)+0.15*dy-40,midBase=(WORLD.ground-bottom)+0.3*dy-6;
  drawRidge(ridgeFar,.15,farBase,camx,'rgba(115,108,95,.22)','rgba(80,65,50,.22)');
  const fog=(y,a)=>{const g=ctx.createLinearGradient(0,y-40,0,y+40);g.addColorStop(0,'rgba(253,247,232,0)');g.addColorStop(.5,`rgba(253,247,232,${a})`);g.addColorStop(1,'rgba(253,247,232,0)');ctx.fillStyle=g;ctx.fillRect(0,y-40,viewW,80);};
  fog(farBase+5,.8);
  drawRidge(ridgeMid,.3,midBase,camx,'rgba(105,92,72,.28)','rgba(70,55,40,.32)');
  fog(midBase+20,.55);
  // watercolor clouds
  ctx.save();ctx.translate(-camx*0.5,-camy*0.5);
  for(const c of clouds){
    const cx=c.x+t*6*c.s;const x=((cx%3400)+3400)%3400-200+Math.floor((camx*0.5)/3400)*3400;
    for(const ox of [0,3400]){const X=x+ox;if(X<camx*0.5-300||X>camx*0.5+viewW+300)continue;
      ctx.fillStyle='rgba(150,120,85,.07)';ctx.beginPath();ctx.ellipse(X+6,c.y+8*c.s,62*c.s,14*c.s,0,0,7);ctx.fill();
      ctx.fillStyle='rgba(254,250,238,.62)';ctx.beginPath();ctx.ellipse(X,c.y,60*c.s,18*c.s,0,0,7);ctx.ellipse(X+35*c.s,c.y-12*c.s,35*c.s,18*c.s,0,0,7);ctx.ellipse(X-30*c.s,c.y-6*c.s,30*c.s,14*c.s,0,0,7);ctx.fill();
      ctx.strokeStyle='rgba(107,79,51,.28)';ctx.lineWidth=1.1;ctx.beginPath();ctx.ellipse(X+35*c.s,c.y-12*c.s,35*c.s,18*c.s,0,3.5,6.0);ctx.moveTo(X-58*c.s,c.y-3*c.s);ctx.ellipse(X-30*c.s,c.y-6*c.s,30*c.s,14*c.s,0,3.3,5.2);ctx.stroke();}
  }
  ctx.restore();
}
export function drawGround(camx){
  const gy=WORLD.ground,x0=camx-60,x1=camx+viewW+60;
  const g=ctx.createLinearGradient(0,gy,0,gy+220);g.addColorStop(0,'#dcc392');g.addColorStop(1,'#c2a46c');ctx.fillStyle=g;ctx.fillRect(x0,gy-1,x1-x0,700);
  for(let x=Math.floor(x0/90)*90;x<x1;x+=90){const h=hsh(x*.013);ctx.fillStyle=`rgba(140,110,62,${.07+h*.09})`;ctx.beginPath();ctx.ellipse(x+h*40,gy+20+h*24,44+h*30,8+h*7,0,0,7);ctx.fill();}
  ctx.strokeStyle='rgba(59,42,26,.22)';ctx.lineWidth=1;ctx.beginPath();
  for(let x=Math.floor(x0/13)*13;x<x1;x+=13){const h=hsh(x*.37);if(h<.35)continue;ctx.moveTo(x,gy+6+h*5);ctx.lineTo(x-8-h*6,gy+15+h*12);}ctx.stroke();
  ctx.strokeStyle=INK;ctx.lineWidth=1.9;ctx.beginPath();for(let x=Math.floor(x0/120)*120;x<x1;x+=120)sk(x-5,gy+(hsh(x)-.5)*2,x+125,gy+(hsh(x+120)-.5)*2,x*.01);ctx.stroke();
  ctx.strokeStyle='rgba(59,42,26,.55)';ctx.lineWidth=1.1;ctx.beginPath();
  for(let x=Math.floor(x0/37)*37;x<x1;x+=37){const h=hsh(x*.71);if(h<.5)continue;const bx=x+h*20;ctx.moveTo(bx,gy);ctx.quadraticCurveTo(bx-2,gy-6,bx-5,gy-9);ctx.moveTo(bx+2,gy);ctx.quadraticCurveTo(bx+3,gy-7,bx+6,gy-10);ctx.moveTo(bx+1,gy);ctx.lineTo(bx+1,gy-8);}ctx.stroke();
  for(const tr of trees){if(tr.x<x0||tr.x>x1)continue;if(!G.duel&&tr.x>2900)continue;
    const s=tr.s,X=tr.x,h=hsh(X);
    ctx.fillStyle='rgba(112,126,72,.38)';ctx.beginPath();ctx.ellipse(X+2,gy-38*s,14*s,17*s,0,0,7);ctx.fill();
    ctx.fillStyle='rgba(84,98,52,.30)';ctx.beginPath();ctx.ellipse(X+5*s,gy-34*s,10*s,13*s,0,0,7);ctx.fill();
    ctx.strokeStyle='#4a3622';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(X,gy);ctx.quadraticCurveTo(X+2*(h-.5)*4,gy-16*s,X+1,gy-30*s);ctx.stroke();
    ctx.lineWidth=1;ctx.beginPath();ctx.arc(X,gy-38*s,13*s,3.6,5.9);ctx.moveTo(X-12*s,gy-32*s);ctx.arc(X,gy-38*s,13*s,2.6,3.2);ctx.moveTo(X+8*s,gy-43*s);ctx.lineTo(X+3*s,gy-36*s);ctx.stroke();}
}
export function drawRearm(t){
  const me=G.me;if(me.dead)return;const z=rearmZone(me),full=me.bombs>=me.st.bombsMax;
  ctx.setLineDash([6,6]);ctx.strokeStyle=full?'rgba(79,107,44,.22)':'rgba(79,107,44,.8)';ctx.lineWidth=2;
  ctx.strokeRect(z.x0,z.y0,z.x1-z.x0,z.y1-z.y0);ctx.setLineDash([]);
  if(!full){ctx.fillStyle='rgba(79,107,44,.9)';ctx.font='bold 16px "Frank Ruhl Libre",serif';ctx.textAlign='center';ctx.direction=textDir();ctx.fillText(tr('rearm.zone'),(z.x0+z.x1)/2,z.y0-8+Math.sin(t*4)*3);}
}
export function drawHome(t){
  const {x0,x1,top}=HOME,gnd=WORLD.ground,sd=7.3;
  ctx.fillStyle='#dcc69a';ctx.beginPath();ctx.moveTo(x0+9,gnd);ctx.lineTo(x0+3,top+2);ctx.lineTo(x1+2,top+2);ctx.lineTo(x1-3,gnd);ctx.closePath();ctx.fill();
  const sg=ctx.createLinearGradient(x0,top,x1,gnd);sg.addColorStop(0,'rgba(255,255,255,.12)');sg.addColorStop(1,'rgba(90,65,40,.25)');ctx.fillStyle=sg;ctx.fill();
  ctx.strokeStyle='rgba(59,42,26,.4)';ctx.lineWidth=.9;ctx.beginPath();for(let y=top+20,r=0;y<gnd;y+=20,r++){sk(x0+2,y,x1-2,y,sd+r);const ox=r%2?35:60;sk(x0+ox,y,x0+ox,y+20,sd+r*3.1);}ctx.stroke();
  ctx.strokeStyle=INK;ctx.lineWidth=1.9;ctx.beginPath();sk(x0+6,gnd+2,x0-1,top-3,sd+1);sk(x0-3,top,x1+3,top,sd+2);sk(x1+1,top-3,x1-6,gnd+2,sd+3);ctx.stroke();
  ctx.lineWidth=1.8;ctx.fillStyle='#9a6b3c';
  ctx.fillRect(x0-10,top-8,x1-x0+20,8);ctx.beginPath();skRect(x0-10,top-8,x1-x0+20,8,sd+4);ctx.stroke();
  const arm=G.t<0.4?-1.2+G.t*3:-0.05;
  ctx.save();ctx.translate(x0+30,top-12);ctx.rotate(arm);ctx.fillRect(0,-3,60,6);ctx.strokeRect(0,-3,60,6);ctx.restore();
  ctx.beginPath();ctx.moveTo(x1-8,top-8);ctx.lineTo(x1-8,top-70);ctx.stroke();
  ctx.fillStyle='#4f6b2c';ctx.beginPath();ctx.moveTo(x1-8,top-70);ctx.quadraticCurveTo(x1+12,top-64+Math.sin(t*5)*4,x1+28,top-60);ctx.lineTo(x1-8,top-50);ctx.fill();ctx.stroke();
}
export function initWorld(){
for(let i=0;i<16;i++)notes.push({x:i*170+rnd(-30,30),y:rnd(70,380),type:pick(['text','text','circle','wing','gear','text']),txt:pick(NOTE_TXT),r:rnd(18,36),rot:rnd(-.15,.15)});
for(let i=0;i<22;i++)clouds.push({x:rnd(-500,6000),y:rnd(120,650),s:rnd(0.6,1.4)});
for(let i=0;i<70;i++)trees.push({x:rnd(700,3300),s:rnd(.7,1.3)});
}
