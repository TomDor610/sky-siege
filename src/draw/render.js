// Frame renderer for a running battle.
import {castleMid} from '../castle.js';
import {INK,WORLD} from '../data.js';
import {drawCastle} from './castle.js';
import {drawMachine} from './machine.js';
import {paperOverlay} from './paper.js';
import {drawGround,drawHome,drawRearm,drawSky} from './world.js';
import {spark} from '../effects.js';
import {planeDir} from '../physics.js';
import {G} from '../state.js';
import {clamp} from '../util.js';
import {ctx,cv,scale,viewH,viewW} from '../view.js';
export function render(t){
  const W=cv.width,H=cv.height;
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#fcf4de');g.addColorStop(1,'#fef9ec');
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const camx=G.cam.x+(Math.random()-0.5)*G.shake,camy=G.cam.y+(Math.random()-0.5)*G.shake;
  ctx.setTransform(scale,0,0,scale,0,0);
  drawSky(camx,camy,t);
  ctx.save();ctx.translate(-camx,-camy);
  drawGround(camx);
  if(!G.duel)drawHome(t);
  for(const c of G.castles)drawCastle(c,t);
  drawRearm(t);
  for(const b of G.bolts){
    if(b.kind==='pot'){ctx.fillStyle='#b5562a';ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(b.x,b.y,7,0,7);ctx.fill();ctx.stroke();continue;}
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.strokeStyle=INK;ctx.fillStyle=INK;
    if(b.kind==='arrow'){ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(7,0);ctx.stroke();ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(5,-2.5);ctx.lineTo(5,2.5);ctx.fill();}
    else{ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(10,0);ctx.stroke();ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(7,-4);ctx.lineTo(7,4);ctx.fill();
      ctx.strokeStyle=b.owner==='L'?'#4f6b2c':'#a3341f';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(-22,-4);ctx.moveTo(-18,0);ctx.lineTo(-22,4);ctx.stroke();}
    ctx.restore();
  }
  ctx.lineWidth=1.6;
  for(const a of G.arrows){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(a.vy,a.vx));ctx.strokeStyle=a.owner==='L'?'#4f6b2c':'#a3341f';ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(8,0);ctx.stroke();ctx.fillStyle=INK;ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(6,-3);ctx.lineTo(6,3);ctx.fill();ctx.restore();}
  for(const b of G.bombs){ctx.fillStyle=b.bt.burn?'#b5562a':'#4f4a43';ctx.strokeStyle=INK;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(b.x,b.y,5,0,7);ctx.fill();ctx.stroke();}
  for(const pl of G.planes){const alt=WORLD.ground-pl.y;if(pl.crashed||alt>650)continue;const k=1-alt/650;ctx.fillStyle=`rgba(70,50,30,${.2*k})`;ctx.beginPath();ctx.ellipse(pl.x,WORLD.ground+4,34*(.5+.5*k),5*(.5+.5*k),0,0,7);ctx.fill();}
  for(const pl of G.planes){
    if(pl.crashed)continue;
    const dir=planeDir(pl);ctx.save();ctx.translate(pl.x,pl.y);ctx.rotate(Math.atan2(dir.y,dir.x));
    const sy=pl.facing*(1-2*pl.roll);ctx.scale(1.2,1.2*(Math.abs(sy)<0.08?0.08*Math.sign(sy||1):sy));
    if(pl.hitFlash>0)ctx.globalAlpha=0.6+0.4*Math.sin(t*60);
    drawMachine(ctx,pl.build,t,pl.bombs,pl.hp<pl.st.hp*0.5);
    if(G.duel){ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-30,-6);ctx.lineTo(-30,-26);ctx.stroke();ctx.fillStyle=pl.side==='L'?'#4f6b2c':'#a3341f';ctx.beginPath();ctx.moveTo(-30,-26);ctx.lineTo(-44,-22+Math.sin(t*8)*2);ctx.lineTo(-30,-18);ctx.fill();}
    ctx.restore();
  }
  for(const p of G.parts){
    const k=clamp(p.life/p.max,0,1);
    if(p.type==='fire'){ctx.fillStyle=`rgba(${200+55*k|0},${90+100*k|0},30,${k})`;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*k+1,0,7);ctx.fill();}
    else if(p.type==='smoke'){ctx.fillStyle=`rgba(70,55,42,${0.26*k})`;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,7);ctx.fill();}
    else if(p.type==='debris'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.wood?'#8a5e33':'#b59d74';ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.globalAlpha=Math.min(1,k*2);ctx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz*0.7);ctx.strokeRect(-p.sz/2,-p.sz/2,p.sz,p.sz*0.7);ctx.restore();}
    else if(p.type==='spark'){ctx.fillStyle=`rgba(255,200,80,${k})`;ctx.fillRect(p.x-1.5,p.y-1.5,3,3);}
  }
  ctx.font='bold 20px "Frank Ruhl Libre",serif';ctx.textAlign='center';ctx.direction='rtl';
  for(const f of G.floaters){ctx.globalAlpha=clamp(f.life,0,1);ctx.lineWidth=4;ctx.strokeStyle='rgba(242,228,196,.9)';ctx.strokeText(f.text,f.x,f.y);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}
  ctx.globalAlpha=1;ctx.restore();
  paperOverlay();ctx.setTransform(scale,0,0,scale,0,0);
  // off-screen indicators
  if(G.state==='play'){
    const me=G.me,ys=[0.5,0.62,0.38];let k=0;
    const ind=(wx,color,label)=>{if(wx<=camx+viewW&&wx>=camx)return;const right=wx>camx+viewW,ax=right?viewW-24:24,ay=viewH*ys[k++%3];
      ctx.save();ctx.translate(ax,ay);ctx.fillStyle=color;ctx.beginPath();
      if(right){ctx.moveTo(14,0);ctx.lineTo(-6,-11);ctx.lineTo(-6,11);}else{ctx.moveTo(-14,0);ctx.lineTo(6,-11);ctx.lineTo(6,11);}
      ctx.fill();ctx.font='bold 13px "Frank Ruhl Libre",serif';ctx.textAlign=right?'right':'left';ctx.direction='rtl';ctx.fillStyle=color;
      ctx.fillText(label,right?-10:10,26);ctx.restore();};
    ind(castleMid(G.foe),'rgba(163,52,31,.85)',Math.round(Math.abs(castleMid(G.foe)-me.x)/10)+' מ\'');
    if(G.mine)ind(castleMid(G.mine),'rgba(79,107,44,.85)','הטירה שלך');
    if(G.bot&&!G.bot.dead)ind(G.bot.x,'rgba(59,42,26,.85)','יריב');
  }
}
