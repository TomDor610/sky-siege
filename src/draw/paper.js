// Paper texture and vignette overlay.
import {ctx,cv} from '../view.js';
let paperTile,paperPat;
export function initPaper(){
paperTile=(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
  x.fillStyle='#f3e6c6';x.fillRect(0,0,512,512);
  const img=x.getImageData(0,0,512,512),d=img.data;
  for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*20+(Math.random()<.004?-30:0);d[i]+=n;d[i+1]+=n;d[i+2]+=n*.8;}
  x.putImageData(img,0,0);
  x.lineCap='round';
  for(let i=0;i<320;i++){const px=Math.random()*512,py=Math.random()*512,a=Math.random()*7,l=4+Math.random()*14;x.strokeStyle=`rgba(${Math.random()<.5?140:240},${Math.random()<.5?105:225},70,${.05+Math.random()*.06})`;x.lineWidth=.6+Math.random();x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+Math.cos(a+.5)*l*.6,py+Math.sin(a+.5)*l*.6,px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();}
  for(let i=0;i<9;i++){const px=Math.random()*512,py=Math.random()*512,r=30+Math.random()*90;
    for(const ox of [-512,0,512])for(const oy of [-512,0,512]){const g=x.createRadialGradient(px+ox,py+oy,r*.2,px+ox,py+oy,r);g.addColorStop(0,'rgba(160,115,60,.07)');g.addColorStop(.85,'rgba(160,115,60,.04)');g.addColorStop(1,'rgba(150,100,50,0)');x.fillStyle=g;x.fillRect(px+ox-r,py+oy-r,r*2,r*2);}}
  return c;})();
paperPat=ctx.createPattern(paperTile,'repeat');
try{document.documentElement.style.setProperty('--paper',`url(${paperTile.toDataURL('image/jpeg',0.85)})`);}catch(e){}
}
export let vignette=document.createElement('canvas');
export function buildVignette(){
  const W=cv.width,H=cv.height;vignette.width=W;vignette.height=H;const x=vignette.getContext('2d');
  const g=x.createRadialGradient(W/2,H*.48,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.78);
  g.addColorStop(0,'rgba(120,80,40,0)');g.addColorStop(.7,'rgba(120,80,40,.10)');g.addColorStop(1,'rgba(95,60,25,.38)');x.fillStyle=g;x.fillRect(0,0,W,H);
  const cg=x.createLinearGradient(W/2-W*.03,0,W/2+W*.03,0);cg.addColorStop(0,'rgba(100,70,40,0)');cg.addColorStop(.5,'rgba(100,70,40,.06)');cg.addColorStop(1,'rgba(100,70,40,0)');x.fillStyle=cg;x.fillRect(W/2-W*.03,0,W*.06,H);
}
export function paperOverlay(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation='multiply';ctx.fillStyle=paperPat;ctx.fillRect(0,0,cv.width,cv.height);
  ctx.globalCompositeOperation='source-over';ctx.drawImage(vignette,0,0);
}
