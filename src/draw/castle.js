// Castle and defense drawing.
import {colTop,colX} from '../castle.js';
import {COL,INK,WORLD} from '../data.js';
import {hsh,sk,skRect} from './sketch.js';
import {ctx} from '../view.js';
export function drawCastle(c,t){
  const n=c.heights.length,gnd=WORLD.ground,kk=c.tint;
  const mix=(a,b)=>'rgb('+a.map((v,j)=>Math.round(v+(b[j]-v)*kk)).join(',')+')';
  const stoneW=mix([214,189,143],[168,160,146]),stoneK=mix([201,173,126],[146,138,126]);
  for(let i=0;i<n;i++){
    const h=c.heights[i];if(h<=0)continue;
    const x=colX(c,i),y=gnd-h*COL,keep=i>=4&&i<=6,sd=c.x0*.013+i*7.7,H=h*COL;
    ctx.fillStyle=keep?stoneK:stoneW;ctx.fillRect(x+2,y+1.5,COL-.5,H-1.5);
    const sg=ctx.createLinearGradient(x,y,x+COL*.6,gnd);sg.addColorStop(0,'rgba(255,250,235,.16)');sg.addColorStop(1,'rgba(90,65,40,.24)');ctx.fillStyle=sg;ctx.fillRect(x+2,y+1.5,COL-.5,H-1.5);
    for(let k=0;k<2;k++){const hh=hsh(sd+k*3.3);ctx.fillStyle=`rgba(105,80,52,${.05+hh*.07})`;ctx.beginPath();ctx.ellipse(x+8+hh*24,y+10+hsh(sd+k*5.1)*H*.8,6+hh*8,4+hh*5,0,0,7);ctx.fill();}
    if(c.bands&&h>=3){ctx.fillStyle='rgba(110,112,108,.85)';ctx.fillRect(x+1,y+COL*1.5,COL,5);ctx.fillRect(x+1,gnd-COL*1.2,COL,5);}
    ctx.strokeStyle='rgba(59,42,26,.36)';ctx.lineWidth=.9;ctx.beginPath();
    for(let r=1;r<h;r++)sk(x+1,y+r*COL,x+COL-1,y+r*COL,sd+r*1.3);
    for(let r=0;r<h;r++){const ox=(r%2)?COL/2:COL/4;sk(x+ox,y+r*COL+1,x+ox,y+r*COL+COL-1,sd+r*2.1+.5);}
    ctx.stroke();
    if(h>=3&&i%2===0){ctx.fillStyle='rgba(45,32,20,.85)';ctx.beginPath();const wy=y+COL*1.2;ctx.moveTo(x+15,wy+16);ctx.lineTo(x+15,wy+6);ctx.arc(x+20,wy+6,5,Math.PI,0);ctx.lineTo(x+25,wy+16);ctx.fill();}
    ctx.fillStyle=keep?stoneK:stoneW;ctx.fillRect(x+3,y-9,13,9);ctx.fillRect(x+26,y-9,13,9);
    ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.beginPath();skRect(x+2,y-10,13,10,sd+31);skRect(x+25,y-10,13,10,sd+41);ctx.stroke();
    ctx.lineWidth=1.7;ctx.beginPath();skRect(x,y,COL,H,sd+9);ctx.stroke();
    if(c.base[i]-h>0){ctx.strokeStyle='rgba(59,42,26,.7)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x+8,y+2);ctx.lineTo(x+16,y+18);ctx.lineTo(x+12,y+30);ctx.moveTo(x+30,y+4);ctx.lineTo(x+26,y+20);ctx.stroke();}
  }
  if(c.hp>0){
    const fx=colX(c,5)+20,fy=colTop(c,5)-10;ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx,fy-60);ctx.stroke();
    const fd=c.side==='L'?1:-1;
    ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(fx,fy-60);ctx.quadraticCurveTo(fx+20*fd,fy-54+Math.sin(t*5)*4,fx+34*fd,fy-50);ctx.lineTo(fx,fy-40);ctx.fill();ctx.stroke();
    for(const i of [0,10,1,9].slice(0,c.banners)){if(c.heights[i]<=1)continue;const x=colX(c,i)+(i<5?8:32),y=colTop(c,i)-10;ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-34);ctx.stroke();
      ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(x,y-34);ctx.lineTo(x+16*fd,y-29+Math.sin(t*6+i)*2);ctx.lineTo(x,y-24);ctx.fill();}
    const kx=colX(c,5)+20,ky=colTop(c,5)+COL*0.75;
    ctx.fillStyle=c.color;ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(kx-28,ky-12);ctx.lineTo(kx+28,ky-12);ctx.lineTo(kx+28,ky+12);ctx.lineTo(kx,ky+20);ctx.lineTo(kx-28,ky+12);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#f2e4c4';ctx.font='bold 15px "Frank Ruhl Libre",serif';ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(c.label,kx,ky+5);
  }
  for(const b of c.defs){
    if(!b.alive)continue;
    ctx.save();ctx.translate(b.x+(b.col===5?(c.side==='L'?14:-14):0),b.y);ctx.strokeStyle=INK;ctx.lineWidth=1.6;
    if(b.type==='archers'){
      ctx.fillStyle='#8a5e33';ctx.fillRect(-16,-6,32,18);ctx.strokeRect(-16,-6,32,18);
      ctx.fillStyle=c.side==='L'?'#4f6b2c':'#7a2a1c';ctx.beginPath();ctx.moveTo(-20,-6);ctx.lineTo(0,-24);ctx.lineTo(20,-6);ctx.closePath();ctx.fill();ctx.stroke();
      for(const ox of [-8,8]){ctx.fillStyle='#e5c49b';ctx.beginPath();ctx.arc(ox,-1,3.5,0,7);ctx.fill();ctx.stroke();
        ctx.save();ctx.translate(ox,2);ctx.rotate(b.angle);ctx.beginPath();ctx.arc(8,0,7,-1.2,1.2);ctx.stroke();ctx.restore();}
    }else if(b.type==='mangonel'){
      ctx.fillStyle='#8a5e33';ctx.fillRect(-18,2,36,8);ctx.strokeRect(-18,2,36,8);
      ctx.beginPath();ctx.moveTo(-8,2);ctx.lineTo(0,-10);ctx.lineTo(8,2);ctx.stroke();
      ctx.scale(Math.cos(b.angle)<0?-1:1,1);
      ctx.save();ctx.translate(0,-10);ctx.rotate(b.swing>0?-0.5:-2.5);ctx.fillRect(-4,-2.5,34,5);ctx.strokeRect(-4,-2.5,34,5);
      if(!(b.swing>0)&&b.cd<1){ctx.fillStyle='#b5562a';ctx.beginPath();ctx.arc(32,0,5,0,7);ctx.fill();ctx.stroke();}ctx.restore();
    }else{
      ctx.fillStyle=b.hp<2?'#6e4a2a':'#8a5e33';
      ctx.beginPath();ctx.moveTo(-10,12);ctx.lineTo(0,0);ctx.lineTo(10,12);ctx.stroke();
      ctx.rotate(b.angle);ctx.fillRect(-6,-3,30,6);ctx.strokeRect(-6,-3,30,6);
      ctx.beginPath();ctx.moveTo(14,-14);ctx.quadraticCurveTo(22,0,14,14);ctx.stroke();
      ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(14,-14);ctx.lineTo(b.cd<0.4?-2:4,0);ctx.lineTo(14,14);ctx.stroke();
    }
    ctx.restore();
  }
}
