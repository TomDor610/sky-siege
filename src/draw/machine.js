// Flying machine drawing (shared by the game canvas and the build preview).
import {INK} from '../data.js';
import {build} from '../state.js';
import {preview} from '../ui/build.js';
import {classicSprites,drawClassicSprite} from './machine-sprites.js';
export function drawMachine(c,b,t,bombsLoaded,damaged){
  const st=b.style||'classic';
  c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle=INK;c.lineWidth=1.6;
  if(st==='classic'&&classicSprites()){
    drawClassicSprite(c,b,t,bombsLoaded,damaged,()=>{c.strokeStyle=INK;c.lineWidth=1.6;armorAndBows(c,b);});
    c.restore();return;
  }
  if(st==='airship'){
    c.beginPath();c.moveTo(-18,-26);c.lineTo(-16,-4);c.moveTo(18,-26);c.lineTo(16,-4);c.moveTo(0,-22);c.lineTo(0,-4);c.stroke();
    c.beginPath();c.ellipse(0,-42,46,19,0,0,Math.PI*2);c.fillStyle=damaged?'#c9a663':'#dcb56c';c.fill();c.stroke();
    c.save();c.clip();c.fillStyle='rgba(163,52,31,.55)';for(let x=-40;x<46;x+=20)c.fillRect(x,-62,8,40);c.restore();
    c.beginPath();c.ellipse(0,-42,46,19,0,0,Math.PI*2);c.stroke();
    c.beginPath();c.moveTo(-46,-42);c.lineTo(-56,-54);c.lineTo(-56,-30);c.closePath();c.fillStyle='#dcb56c';c.fill();c.stroke();
  }
  // wings
  const n=b.wings;
  for(let i=n-1;i>=0;i--){
    const fl=Math.sin(t*9+i*1.3);
    if(st==='falcon'){
      const off=-12-i*7+(n-1)*2;
      c.beginPath();c.moveTo(-4,-4);c.lineTo(-2,off+5);c.stroke();
      c.beginPath();c.moveTo(-16,off+6);c.quadraticCurveTo(6,off-5+fl,32,off-3);c.lineTo(8,off+5);c.closePath();
      c.fillStyle=damaged?'#cfae78':'#e2c48e';c.fill();c.stroke();
      c.lineWidth=.8;c.beginPath();c.moveTo(-12,off+5);c.lineTo(28,off-2.5);c.stroke();c.lineWidth=1.6;
    }else if(st==='bat'){
      const off=-16-i*11+(n-1)*3, A=1.35;
      c.beginPath();c.moveTo(-6,-4);c.lineTo(-14,off+8);c.moveTo(6,-4);c.lineTo(10,off+4);c.stroke();
      c.beginPath();c.moveTo(-26,off+9);c.quadraticCurveTo(-4,off-12+fl*5,30*A/1.2,off-2+fl*2);
      c.quadraticCurveTo(22,off+8,14,off+4);c.quadraticCurveTo(7,off+11,0,off+6);c.quadraticCurveTo(-8,off+12,-14,off+7);c.quadraticCurveTo(-20,off+12,-26,off+9);c.closePath();
      c.fillStyle=damaged?'#4d3c2f':'#6a5444';c.fill();c.stroke();
      c.strokeStyle='#cbb08a';c.lineWidth=.9;c.beginPath();c.moveTo(-22,off+7);c.lineTo(32,off-1);c.moveTo(-6,off);c.lineTo(0,off+6);c.moveTo(8,off-2);c.lineTo(14,off+4);c.moveTo(-14,off+2);c.lineTo(-14,off+7);c.stroke();c.strokeStyle=INK;c.lineWidth=1.6;
    }else if(st==='airship'){
      const y=-8-i*6;
      c.beginPath();c.moveTo(-22,y);c.lineTo(-38,y-8);c.lineTo(-36,y+2);c.closePath();c.fillStyle='#efdcae';c.fill();c.stroke();
    }else{
      const off=(st==='galleon'?-21:-15)-i*9+(n-1)*2.5;
      c.beginPath();c.moveTo(-6,-6);c.lineTo(-14,off+8);c.moveTo(6,-6);c.lineTo(10,off+4);c.stroke();
      c.beginPath();c.moveTo(-20,off+8);c.quadraticCurveTo(-4,off-8+fl*2.2,24,off+1);
      c.quadraticCurveTo(17,off+7,11,off+3.5);c.quadraticCurveTo(4,off+9,-3,off+5);c.quadraticCurveTo(-10,off+10,-20,off+8);c.closePath();
      c.fillStyle=damaged?'#d8c08f':(st==='galleon'?'#eadbb8':'#efdcae');c.fill();c.stroke();
      c.lineWidth=.9;c.beginPath();c.moveTo(-18,off+7);c.lineTo(22,off+1.5);c.moveTo(-6,off+2);c.lineTo(-3,off+5);c.moveTo(6,off-1);c.lineTo(11,off+3.5);c.stroke();c.lineWidth=1.6;
    }
  }
  // propellers
  const px=st==='falcon'?-40:st==='galleon'?-40:st==='bat'?-32:-34;
  for(let i=0;i<b.props;i++){
    const py=-1+(i-(b.props-1)/2)*10;
    c.beginPath();c.moveTo(px+2,py*0.4);c.lineTo(px-8,py);c.stroke();
    const ry=7.5*Math.abs(Math.cos(t*28+i*1.7))+1.2;
    c.fillStyle='rgba(239,220,174,.85)';c.beginPath();c.ellipse(px-10,py,2.6,ry,0,0,Math.PI*2);c.fill();c.stroke();
    c.beginPath();c.moveTo(px-10,py-ry);c.lineTo(px-10,py+ry);c.stroke();
  }
  // hull
  c.beginPath();
  if(st==='falcon'){c.moveTo(-38,-4);c.quadraticCurveTo(-22,8,8,7);c.quadraticCurveTo(34,5,50,-2);c.lineTo(36,-6);c.lineTo(-38,-5);c.closePath();c.fillStyle='#7b3f22';}
  else if(st==='galleon'){c.moveTo(-38,-9);c.quadraticCurveTo(-35,17,-2,18);c.quadraticCurveTo(30,18,42,-9);c.closePath();c.fillStyle='#6e4a2a';}
  else if(st==='bat'){c.moveTo(-30,-3);c.quadraticCurveTo(-25,9,0,9);c.quadraticCurveTo(24,9,34,-2);c.lineTo(-30,-4);c.closePath();c.fillStyle='#4f3a2a';}
  else if(st==='airship'){c.moveTo(-28,-3);c.quadraticCurveTo(-24,10,0,10);c.quadraticCurveTo(24,10,32,-3);c.closePath();c.fillStyle='#9a6b3c';}
  else{c.moveTo(-34,-4);c.quadraticCurveTo(-31,11,-2,12);c.quadraticCurveTo(28,12,40,-3);c.lineTo(30,-5);c.lineTo(-34,-5);c.closePath();c.fillStyle='#9a6b3c';}
  c.fill();c.stroke();
  c.lineWidth=.8;c.beginPath();c.moveTo(-28,1);c.quadraticCurveTo(0,7,32,0);c.stroke();c.lineWidth=1.6;
  if(st==='galleon'){
    c.fillStyle='#6e4a2a';c.fillRect(-38,-17,14,8);c.strokeRect(-38,-17,14,8);
    c.fillStyle=INK;for(let x=-18;x<=22;x+=10){c.beginPath();c.arc(x,8,2,0,7);c.fill();}
  }
  if(st==='falcon'){c.beginPath();c.moveTo(-36,-5);c.lineTo(-46,-16);c.lineTo(-28,-5);c.fillStyle='#7b3f22';c.fill();c.stroke();
    c.beginPath();c.moveTo(48,-3);c.lineTo(57,0);c.lineTo(47,2);c.fillStyle='#b07d22';c.fill();c.stroke();}
  else{const nx=st==='galleon'?40:st==='bat'?33:st==='airship'?31:38;c.beginPath();c.moveTo(nx,-3);c.lineTo(nx+9,-1);c.lineTo(nx,2);c.fillStyle='#6d6f6a';c.fill();c.stroke();}
  armorAndBows(c,b);
  // pilot
  const hx=st==='falcon'?10:14,hy=st==='galleon'?-13:-9;
  c.fillStyle='#e5c49b';c.beginPath();c.arc(hx,hy,4.3,0,7);c.fill();c.stroke();
  c.fillStyle='#7a2a1c';c.beginPath();c.moveTo(hx-3,hy+3);c.quadraticCurveTo(hx-10,hy+1+Math.sin(t*12)*2,hx-14,hy+4);c.lineTo(hx-3,hy+5);c.fill();
  c.fillStyle=INK;c.beginPath();c.arc(hx,hy-2,4.3,Math.PI,0);c.fill();
  // bombs
  const nb=Math.min(bombsLoaded,9),by=st==='galleon'?20.5:st==='bat'||st==='airship'?12.5:st==='falcon'?10:14.5;
  const greek=b.bombType==='greek';
  for(let i=0;i<nb;i++){c.fillStyle=greek?'#b5562a':'#5a544c';c.beginPath();c.arc(-18+i*5,by,2.6,0,7);c.fill();c.stroke();}
  c.restore();
}
// Armor plates on the hull side and crossbows on deck (shared by the drawn and the sprite hull).
function armorAndBows(c,b){
  for(let i=0;i<b.armor;i++){c.fillStyle='#8f918b';c.beginPath();c.rect(-24+i*9.5,-3,8,7.5);c.fill();c.stroke();}
  for(let i=0;i<(b.crossbows||0);i++){
    const x=24-i*8,y=-8;c.fillStyle='#8a5e33';c.fillRect(x-6,y-1.5,14,3);c.strokeRect(x-6,y-1.5,14,3);
    c.beginPath();c.moveTo(x+6,y-6);c.quadraticCurveTo(x+10,y,x+6,y+6);c.stroke();
  }
}
