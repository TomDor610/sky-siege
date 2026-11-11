// Hand-painted sprites for the 2.5D art pass (docs/ART_2.5D brief). Only the Classic style
// has sprites so far, and they show only in beta (?beta=1) until the new look is approved.
// Units match drawMachine: nose to the right, y down, the hull about 80 units long.
// Drawing only: no game state is read or written and Math.random is never used.
import {INK} from '../data.js';
import {store} from '../util.js';
import hullUrl from '../assets/classic/hull.webp';
import wingUrl from '../assets/classic/wing.webp';
import bladeUrl from '../assets/classic/blade.webp';
import stoneUrl from '../assets/classic/stone.webp';
import greekUrl from '../assets/classic/greek.webp';
import armorUrl from '../assets/classic/armor.webp';

const IMG={}, DARK={};
let loaded=0, total=0, beta=null;
function load(key,url,dark){
  if(typeof Image==='undefined')return;
  total++;const im=new Image();
  im.onload=()=>{IMG[key]=im;if(dark)DARK[key]=darken(im,dark);loaded++;};
  im.src=url;
}
function darken(im,a){
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const x=c.getContext('2d');x.drawImage(im,0,0);x.globalCompositeOperation='source-atop';
  x.fillStyle=`rgba(30,18,6,${a})`;x.fillRect(0,0,c.width,c.height);return c;
}
load('hull',hullUrl,0.3);load('wing',wingUrl,0.25);load('blade',bladeUrl,0.55);
load('stone',stoneUrl,0.35);load('greek',greekUrl,0.35);load('armor',armorUrl);

/** True when the Classic should be drawn from sprites (beta flag on, all images loaded). */
export function classicSprites(){
  if(beta===null)beta=store.get('skysiege_beta')==='1';
  return beta&&total>0&&loaded===total;
}

// Layout (machine units)
const HULL={x:-37,y:-11,w:82};             // h follows the image
const WING={cx:20,w:40};               // ahead of the pilot, so the struts never hide him
const PROP={x:-40,K:0.32,MAX:40};          // K: depth axis of the spin ellipse; MAX rad/s

function img(k,dmg){return dmg&&DARK[k]?DARK[k]:IMG[k];}
function hOf(k,w){const im=IMG[k];return w*im.naturalHeight/im.naturalWidth;}

/**
 * Draws the sprite Classic. `mid` runs after the hull and armor, before the wings
 * (crossbows sit on deck, under the lower wing).
 */
export function drawClassicSprite(c,b,t,bombsLoaded,damaged,mid){
  const greek=b.bombType==='greek';
  const n=Math.min(bombsLoaded,12);
  // hull (pilot included in the sprite), then the bomb rack under it
  const hh=hOf('hull',HULL.w);
  c.drawImage(img('hull',damaged),HULL.x,HULL.y,HULL.w,hh);
  const bombs=[];for(let i=0;i<n;i++)bombs.push({row:i%2,col:i>>1});
  drawRack(c,bombs,greek);
  drawArmor(c,b.armor);
  mid();
  drawWings(c,b.wings,damaged);
  drawProps(c,b,t,damaged);
}

// A wooden beam on two posts under the hull. Bombs hang from it on short ropes in two
// staggered rows (the back row higher and in shade); Greek fire pots hang by the neck, fuse unlit.
const RACK={x0:-17,x1:16,y:11.5};
function drawRack(c,bombs,greek){
  c.fillStyle='#6b4521';c.strokeStyle=INK;c.lineWidth=0.7;
  for(const x of [RACK.x0+1.5,RACK.x1-1.5]){c.beginPath();c.rect(x-0.7,7.5,1.4,RACK.y-7.5);c.fill();c.stroke();}
  c.beginPath();c.rect(RACK.x0,RACK.y-0.7,RACK.x1-RACK.x0,1.4);c.fill();c.stroke();
  const k=greek?'greek':'stone', w=5, h=hOf(k,w);
  for(const row of [1,0])for(const q of bombs){
    if(q.row!==row)continue;
    const x=-13.5+q.col*5.4+(row?2.7:0), top=RACK.y+(row?1.2:3.6);
    c.strokeStyle='#8a6a3e';c.lineWidth=0.5;c.beginPath();c.moveTo(x,RACK.y);c.lineTo(x,top+(greek?1.2:0.6));c.stroke();
    c.drawImage(row?DARK[k]:IMG[k],x-w/2,top,w,h);
  }
  c.strokeStyle=INK;c.lineWidth=1.6;
}

function drawArmor(c,n){
  const w=8.4, h=hOf('armor',w);
  for(let i=0;i<n;i++)c.drawImage(IMG.armor,-27+i*9.2,-4.6,w,h);
}

function drawWings(c,n,damaged){
  const h=hOf('wing',WING.w)*1.7, ys=[];   // airfoil drawn thicker so it reads at phone size
  if(n<=1)ys.push(-20);else for(let i=0;i<n;i++)ys.push(2-i*9.5);
  // struts and X bracing
  const sx=[WING.cx-8,WING.cx+7];
  const pairs=[];for(let i=0;i<ys.length-1;i++)pairs.push([ys[i],ys[i+1]]);
  if(n<=1)pairs.push([-6,ys[0]]);
  for(const [a,z] of pairs){
    c.strokeStyle='#b08a55';c.lineWidth=0.6;c.beginPath();
    c.moveTo(sx[0],a);c.lineTo(sx[1],z);c.moveTo(sx[1],a);c.lineTo(sx[0],z);c.stroke();
    c.strokeStyle='#6b4521';c.lineWidth=1.4;c.beginPath();
    for(const x of sx){c.moveTo(x,a);c.lineTo(x,z);}c.stroke();
  }
  c.strokeStyle=INK;c.lineWidth=1.6;
  for(const y of ys)c.drawImage(img('wing',damaged),WING.cx-WING.w/2,y-h/2,WING.w,h);
}

// Spin is a pure function of time (no per-machine state: the workshop preview draws a fresh
// build object every frame). Several propellers turn slightly out of phase.
function drawProps(c,b,t,damaged){
  const n=b.props, L=n<=2?11:8.5, gap=n>1?L*1.85:0, cy=n>2?-5:-2;
  const om=PROP.MAX*(damaged?0.62+0.06*Math.sin(t*3.1):1);
  const blur=0.7*Math.max(0,Math.min(1,(om/PROP.MAX-0.28)/0.4));   // keep the blades visible through the disc
  const ys=[];for(let i=0;i<n;i++)ys.push(cy+(i-(n-1)/2)*gap);
  // a short bracket from the stern, and a wooden mast when there are several propellers
  c.strokeStyle='#5a3a1c';c.lineWidth=2.2;c.beginPath();c.moveTo(-34,-1);c.lineTo(PROP.x,Math.max(ys[0],Math.min(-1,ys[n-1])));
  if(n>1){c.moveTo(PROP.x,ys[0]);c.lineTo(PROP.x,ys[n-1]);}
  c.stroke();
  for(let i=0;i<n;i++)prop(c,PROP.x-1.5,ys[i],t*om*(1+i*0.035)+i*0.9,L,blur);
  c.strokeStyle=INK;c.lineWidth=1.6;
}

function prop(c,x,y,angle,L,blur){
  const K=PROP.K, aspect=IMG.blade.naturalWidth/IMG.blade.naturalHeight;
  const blades=[0,Math.PI].map(o=>{const th=angle+o;return {th,tx:Math.sin(th)*L*K,ty:-Math.cos(th)*L,tz:Math.sin(th)};})
    .sort((a,b)=>a.tz-b.tz);
  const alpha=1-0.85*blur, ga=c.globalAlpha;
  if(blur>0.01){
    c.save();c.translate(x,y);c.scale(K,1);
    const g=c.createRadialGradient(0,0,L*0.1,0,0,L);
    g.addColorStop(0,`rgba(122,81,40,${0.32*blur})`);g.addColorStop(0.75,`rgba(168,118,63,${0.18*blur})`);g.addColorStop(1,'rgba(168,118,63,0)');
    c.fillStyle=g;c.beginPath();c.arc(0,0,L,0,Math.PI*2);c.fill();
    c.strokeStyle=`rgba(59,42,26,${0.35*blur})`;c.lineWidth=0.5/K;
    for(let i=0;i<3;i++){const a0=angle*0.35+i*2.1;c.beginPath();c.arc(0,0,L*(0.55+i*0.15),a0,a0+0.9);c.stroke();}
    c.restore();
  }
  const one=bl=>{
    const len=Math.hypot(bl.tx,bl.ty);if(len<0.3)return;
    const face=0.35+0.65*Math.abs(Math.sin(bl.th)), dw=L*aspect*face, light=bl.tz*0.5+0.5;
    c.save();c.translate(x,y);c.rotate(Math.atan2(bl.tx,-bl.ty));
    c.globalAlpha=ga*alpha;c.drawImage(DARK.blade,-dw/2,-len,dw,len);
    c.globalAlpha=ga*alpha*light;c.drawImage(IMG.blade,-dw/2,-len,dw,len);
    c.restore();
  };
  for(const bl of blades)if(bl.tz<=0)one(bl);
  c.fillStyle='#7a5128';c.strokeStyle=INK;c.lineWidth=0.9;
  c.beginPath();c.ellipse(x,y,L*0.1,L*0.15,0,0,Math.PI*2);c.fill();c.stroke();
  for(const bl of blades)if(bl.tz>0)one(bl);
}
