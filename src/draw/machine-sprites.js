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
load('stone',stoneUrl);load('greek',greekUrl);

/** True when the Classic should be drawn from sprites (beta flag on, all images loaded). */
export function classicSprites(){
  if(beta===null)beta=store.get('skysiege_beta')==='1';
  return beta&&total>0&&loaded===total;
}

// Layout (machine units)
const HULL={x:-37,y:-11,w:82};             // h follows the image
const WING={cx:6,w:40};
const PROP={x:-40,y:-1,K:0.32,MAX:40};     // K: depth axis of the spin ellipse; MAX rad/s
const spin=new WeakMap();                  // per build object: blade angles and speed

function img(k,dmg){return dmg&&DARK[k]?DARK[k]:IMG[k];}
function hOf(k,w){const im=IMG[k];return w*im.naturalHeight/im.naturalWidth;}

/**
 * Draws the sprite Classic. `mid` runs after the hull and before the wings
 * (armor plates and crossbows sit on the hull, under the lower wing).
 */
export function drawClassicSprite(c,b,t,bombsLoaded,damaged,mid){
  const greek=b.bombType==='greek';
  const n=Math.min(bombsLoaded,12);
  // bombs: two staggered rows; the back row hangs partly behind the hull
  const bombs=[];for(let i=0;i<n;i++)bombs.push({row:i%2,col:i>>1});
  drawBombs(c,bombs.filter(q=>q.row===1),greek);
  // hull (pilot included in the sprite)
  const hh=hOf('hull',HULL.w);
  c.drawImage(img('hull',damaged),HULL.x,HULL.y,HULL.w,hh);
  drawBombs(c,bombs.filter(q=>q.row===0),greek);
  mid();
  drawWings(c,b.wings,damaged);
  drawProps(c,b,t,damaged);
}

function drawBombs(c,list,greek){
  const k=greek?'greek':'stone', w=5, h=hOf(k,w);
  for(const q of list){
    const x=-14+q.col*5.4+(q.row?2.7:0), top=q.row?8.2:10.4;
    c.drawImage(IMG[k],x-w/2,top,w,h);
  }
}

function drawWings(c,n,damaged){
  const h=hOf('wing',WING.w)*1.7, ys=[];   // airfoil drawn thicker so it reads at phone size
  if(n<=1)ys.push(-17);else for(let i=0;i<n;i++)ys.push(1-i*11);
  // struts and X bracing
  const sx=[WING.cx-8,WING.cx+7];
  const pairs=[];for(let i=0;i<ys.length-1;i++)pairs.push([ys[i],ys[i+1]]);
  if(n<=1)pairs.push([-7,ys[0]]);
  for(const [a,z] of pairs){
    c.strokeStyle='#b08a55';c.lineWidth=0.6;c.beginPath();
    c.moveTo(sx[0],a);c.lineTo(sx[1],z);c.moveTo(sx[1],a);c.lineTo(sx[0],z);c.stroke();
    c.strokeStyle='#6b4521';c.lineWidth=1.4;c.beginPath();
    for(const x of sx){c.moveTo(x,a);c.lineTo(x,z);}c.stroke();
  }
  c.strokeStyle=INK;c.lineWidth=1.6;
  for(const y of ys)c.drawImage(img('wing',damaged),WING.cx-WING.w/2,y-h/2,WING.w,h);
}

function drawProps(c,b,t,damaged){
  const n=b.props, L=n<=2?9:7, gap=n>1?L*1.9:0;
  let s=spin.get(b);
  if(!s||t<s.t||t-s.t>1){s={t,om:0,ang:[0,0.9,1.7,2.6]};spin.set(b,s);}
  const dt=Math.min(0.05,t-s.t);s.t=t;
  let target=PROP.MAX;if(damaged)target*=0.65+0.2*Math.sin(t*3.1)*Math.sin(t*7.3);
  s.om+=(target-s.om)*(1-Math.exp(-dt*2.2));
  const blur=Math.max(0,Math.min(1,(s.om/PROP.MAX-0.28)/0.4));
  for(let i=0;i<n;i++){
    const py=PROP.y+(i-(n-1)/2)*gap;
    s.ang[i]+=s.om*dt*(1+i*0.035);
    c.strokeStyle=INK;c.lineWidth=1.2;c.beginPath();c.moveTo(-35,-1);c.lineTo(PROP.x+1,py);c.stroke();
    prop(c,PROP.x,py,s.ang[i],L,blur);
  }
  c.lineWidth=1.6;
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
