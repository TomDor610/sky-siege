// Hand-painted sprites for the 2.5D art pass (docs/ART_2.5D brief). all five styles have
// sprites so far, and they show only in beta (?beta=1) until the new look is approved.
// Each style brings its own hull and wing; propeller, bombs, rack and armor are shared.
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
import crossbowUrl from '../assets/classic/crossbow.webp';
import falconHullUrl from '../assets/falcon/hull.webp';
import falconWingUrl from '../assets/falcon/wing.webp';
import galleonHullUrl from '../assets/galleon/hull.webp';
import galleonWingUrl from '../assets/galleon/wing.webp';
import batHullUrl from '../assets/bat/hull.webp';
import batWingUrl from '../assets/bat/wing.webp';
import batUpWingUrl from '../assets/bat/upwing.webp';
import batLowWingUrl from '../assets/bat/lowwing.webp';
import falconLowWingUrl from '../assets/falcon/lowwing.webp';
import airHullUrl from '../assets/airship/hull.webp';
import airWingUrl from '../assets/airship/wing.webp';
import airBalloonUrl from '../assets/airship/balloon.webp';

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
load('stone',stoneUrl,0.35);load('greek',greekUrl,0.35);load('armor',armorUrl);load('crossbow',crossbowUrl);
load('falconHull',falconHullUrl,0.3);load('falconWing',falconWingUrl,0.25);
load('galleonHull',galleonHullUrl,0.3);load('galleonWing',galleonWingUrl,0.25);
load('batHull',batHullUrl,0.3);load('batWing',batWingUrl,0.25);
load('batUp',batUpWingUrl,0.3);load('batLow',batLowWingUrl,0.3);load('falconLow',falconLowWingUrl,0.3);
load('airHull',airHullUrl,0.3);load('airWing',airWingUrl,0.25);load('airBalloon',airBalloonUrl,0.25);

// Layout per style, in machine units. hull: top-left corner and width (height follows the
// image). wing: centre x and width; kept clear of the pilot so the struts never hide him.
// bal: the airship's gas bag (top-left corner and width) and its ropes [x,y on the bag, x,y on the gondola].
// bow: [x,y] of the crossbow at the bow, y on the deck line (the post is cut there).
// wbase: y of the deck the lowest wing is strutted to (default: only a lone wing, 14 below it).
// wy: [y of a lone wing, y of the lowest of a stack, gap between stacked wings].
// wt: how much thicker than the image the wing is drawn (thin airfoils need it at phone size).
// prop: x of the hubs and of the stern bracket. rack: beam ends, post tops, beam height.
const ART={
  classic:{bow:[31,-6],hull:'hull',wing:'wing',hx:-37,hy:-11,hw:82,wcx:-4,ww:40,wt:1.4,wy:[-19,-12,9],wbase:-5,px:-40,stern:-34,rack:{x0:-17,x1:16,top:7.5,y:11.5}},
  falcon:{bow:[24,-5],hull:'falconHull',wing:'falconWing',hx:-40,hy:-11.7,hw:86,wcx:-14,ww:36,wt:1.7,wy:[-20,2,9.5],px:-43,stern:-37,rack:{x0:-17,x1:16,top:4,y:8.5}},
  galleon:{bow:[31,-10],hull:'galleonHull',wing:'galleonWing',hx:-43,hy:-16,hw:86,wcx:-6,ww:46,wt:1.3,wy:[-18,-9,9],px:-46,stern:-41,rack:{x0:-17,x1:16,top:9,y:14}},
  bat:{bow:[29,-7],hull:'batHull',wing:'batWing',hx:-43,hy:-12,hw:86,wcx:-2,ww:42,wt:0.6,wy:[-17,-11,9],wbase:-7,px:-46,stern:-41,rack:{x0:-17,x1:16,top:7,y:12}},
  airship:{bow:[22,-4],hull:'airHull',wing:'airWing',hx:-30,hy:-9,hw:66,wcx:-6,ww:24,wt:1.4,wy:[-12,-11,4.5],wbase:-4.5,px:-37,stern:-29,rack:{x0:-17,x1:16,top:6,y:11},
    bal:{x:-60,y:-61,w:112,ropes:[[-14,-28,-9.5,-5],[17,-28,12.9,-5],[-30,-31,-27,-4],[33,-31,30,-4]]}},
};
// Signature wings: styles listed here draw their own wing shapes instead of the stacked
// airfoil. Each piece: image key, root point in the image (fraction of its size), where that
// root sits on the machine, width, flip, and whether it goes behind the hull.
// Pieces are added in order as the wing count grows; extra ones sit behind and in shade.
const SIG={
  falcon:[
    {k:'falconLow',rx:0.95,ry:0.25,x:8,y:-2,w:44},
    {k:'falconLow',rx:0.95,ry:0.25,x:0,y:-8,w:40,back:true},
    {k:'falconLow',rx:0.95,ry:0.25,x:-8,y:-14,w:36,back:true},
    {k:'falconLow',rx:0.95,ry:0.25,x:-16,y:-20,w:32,back:true},
  ],
  bat:[
    {k:'batUp',rx:0.945,ry:0.91,x:-8,y:-2,w:44,back:true,lit:true},
    {k:'batLow',rx:0.95,ry:0.25,x:2,y:3,w:42},
    {k:'batUp',rx:0.945,ry:0.91,x:-30,y:0,w:34,back:true,keep:true},
    {k:'batLow',rx:0.95,ry:0.25,x:-12,y:10,w:36,back:true,keep:true},
  ],
};
function drawSig(c,set,n,back,damaged){
  // back pieces: the extra ones (in shade) first, then the lit ones
  const list=set.slice(0,Math.max(1,Math.min(n,4))).map((P,i)=>({P,i})).filter(o=>!!o.P.back===back);
  list.sort((a,b)=>(a.P.lit?1:0)-(b.P.lit?1:0)||b.i-a.i);
  for(const {P,i} of list){
    const h=hOf(P.k,P.w), shade=i>0&&!P.lit&&!P.keep&&back;   // keep: already dark, shading would hide it
    c.drawImage(shade?DARK[P.k]:img(P.k,damaged),P.x-P.rx*P.w,P.y-P.ry*h,P.w,h);
  }
}

const PROP={K:0.32,MAX:40};                // K: depth axis of the spin ellipse; MAX rad/s

/** True when this style should be drawn from sprites (beta flag on, all images loaded). */
export function hasSprites(style){
  if(beta===null)beta=store.get('skysiege_beta')==='1';
  return beta&&!!ART[style]&&total>0&&loaded===total;
}

function img(k,dmg){return dmg&&DARK[k]?DARK[k]:IMG[k];}
function hOf(k,w){const im=IMG[k];return w*im.naturalHeight/im.naturalWidth;}

/** Draws a sprite machine. */
export function drawSpriteMachine(c,b,t,bombsLoaded,damaged){
  const A=ART[b.style||'classic'], greek=b.bombType==='greek';
  const n=Math.min(bombsLoaded,12);
  if(A.bal)drawBalloon(c,A.bal,damaged);
  const sig=SIG[b.style];
  if(sig)drawSig(c,sig,b.wings,true,damaged);
  // hull (pilot included in the sprite), then the bomb rack under it
  c.drawImage(img(A.hull,damaged),A.hx,A.hy,A.hw,hOf(A.hull,A.hw));
  const bombs=[];for(let i=0;i<n;i++)bombs.push({row:i%2,col:i>>1});
  drawRack(c,A.rack,bombs,greek);
  drawArmor(c,b.armor);
  if(sig)drawSig(c,sig,b.wings,false,damaged);else drawWings(c,A,b.wings,damaged);
  drawBow(c,A.bow,b.crossbows||0);
  drawProps(c,A,b,t,damaged);
}

// A wooden beam on two posts under the hull. Bombs hang from it on short ropes in two
// staggered rows (the back row higher and in shade); Greek fire pots hang by the neck, fuse unlit.
function drawRack(c,RACK,bombs,greek){
  c.fillStyle='#6b4521';c.strokeStyle=INK;c.lineWidth=0.7;
  for(const x of [RACK.x0+1.5,RACK.x1-1.5]){c.beginPath();c.rect(x-0.7,RACK.top,1.4,RACK.y-RACK.top);c.fill();c.stroke();}
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

function drawBalloon(c,B,damaged){
  c.strokeStyle='#8a6a3e';c.lineWidth=0.7;c.beginPath();
  for(const [x0,y0,x1,y1] of B.ropes){c.moveTo(x0,y0);c.lineTo(x1,y1);}
  c.stroke();
  c.drawImage(img('airBalloon',damaged),B.x,B.y,B.w,hOf('airBalloon',B.w));
}

// The repeating crossbow, at the bow. Only one is ever drawn (a second one adds fire rate,
// not looks). It goes on top of the wings so they never hide it, and is cut at the deck line
// so its swivel post looks sunk into the hull.
function drawBow(c,B,n){
  if(n<=0)return;
  const w=17, h=hOf('crossbow',w);
  c.save();c.beginPath();c.rect(B[0]-w,B[1]-h*2,w*2,h*2);c.clip();
  c.drawImage(IMG.crossbow,B[0]-w/2,B[1]-h*0.72,w,h);
  c.restore();
}

function drawArmor(c,n){
  const w=8.4, h=hOf('armor',w);
  for(let i=0;i<n;i++)c.drawImage(IMG.armor,-27+i*9.2,-4.6,w,h);
}

function drawWings(c,A,n,damaged){
  const WING={cx:A.wcx,w:A.ww}, h=hOf(A.wing,WING.w)*A.wt, ys=[];
  const [y1,y0,gap]=A.wy;
  if(n<=1)ys.push(y1);else for(let i=0;i<n;i++)ys.push(y0-i*gap);
  // struts and X bracing
  const sx=[WING.cx-8,WING.cx+7];
  const pairs=[];for(let i=0;i<ys.length-1;i++)pairs.push([ys[i],ys[i+1]]);
  if(A.wbase!=null)pairs.push([A.wbase,ys[0]]);else if(n<=1)pairs.push([y1+14,ys[0]]);
  for(const [a,z] of pairs){
    c.strokeStyle='#b08a55';c.lineWidth=0.6;c.beginPath();
    c.moveTo(sx[0],a);c.lineTo(sx[1],z);c.moveTo(sx[1],a);c.lineTo(sx[0],z);c.stroke();
    c.strokeStyle='#6b4521';c.lineWidth=1.4;c.beginPath();
    for(const x of sx){c.moveTo(x,a);c.lineTo(x,z);}c.stroke();
  }
  c.strokeStyle=INK;c.lineWidth=1.6;
  for(const y of ys)c.drawImage(img(A.wing,damaged),WING.cx-WING.w/2,y-h/2,WING.w,h);
}

// Spin is a pure function of time (no per-machine state: the workshop preview draws a fresh
// build object every frame). Several propellers turn slightly out of phase.
function drawProps(c,A,b,t,damaged){
  const n=b.props, L=n<=2?11:8.5, gap=n>1?L*1.85:0, cy=n>2?-5:-2;
  const om=PROP.MAX*(damaged?0.62+0.06*Math.sin(t*3.1):1);
  const blur=0.7*Math.max(0,Math.min(1,(om/PROP.MAX-0.28)/0.4));   // keep the blades visible through the disc
  const ys=[];for(let i=0;i<n;i++)ys.push(cy+(i-(n-1)/2)*gap);
  // a short bracket from the stern, and a wooden mast when there are several propellers
  c.strokeStyle='#5a3a1c';c.lineWidth=2.2;c.beginPath();c.moveTo(A.stern,-1);c.lineTo(A.px,Math.max(ys[0],Math.min(-1,ys[n-1])));
  if(n>1){c.moveTo(A.px,ys[0]);c.lineTo(A.px,ys[n-1]);}
  c.stroke();
  for(let i=0;i<n;i++)prop(c,A.px-1.5,ys[i],t*om*(1+i*0.035)+i*0.9,L,blur);
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
