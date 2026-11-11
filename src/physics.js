// Flight physics, plane lifecycle and weapons.
import {castleMid,castleTop,damageCastle,hitsCastle,killDef} from './castle.js';
import {BOMBTYPE,CW,DRAG,GRAV,G_ALONG,HOME,STALL_K,STYLES,THRUST_K,WORLD} from './data.js';
import {floater,spark} from './effects.js';
import {t} from './i18n/index.js';
import {G,prog} from './state.js';
import {sfx} from './sound.js';
import {clamp} from './util.js';
import {viewW} from './view.js';
export function stats(b,u){
  u=u||prog.upg;const S=STYLES[b.style]||STYLES.classic,bt=BOMBTYPE[b.bombType];
  const raw=10+b.wings*3+b.props*4+b.armor*5+b.bombs*bt.w+b.crossbows*3;
  const m=raw*S.mass*(1-0.04*u.frame);
  const T=b.props*THRUST_K*(1+0.08*u.props);
  const drag=DRAG*S.drag;
  const vmax=Math.sqrt(T/drag);
  const vstall=STALL_K*Math.sqrt(m/b.wings)*S.stall*(1-0.06*u.wings);
  const hp=Math.round((30+b.armor*(25+6*u.armor))*S.hp*(1+0.1*u.frame));
  const agility=clamp((1.1+0.28*b.wings-0.012*(m-30))*S.agi*(1+0.06*u.wings),0.6,2.8);
  const dmgMul=1+0.15*u.weapons;
  const bombsMax=b.bombs+S.bombs;
  const fire=bombsMax*(bt.dmg+(bt.burn?bt.burn*3:0))*dmgMul+b.crossbows*40;
  return {m,T,drag,vmax,vstall,hp,agility,dmgMul,bombsMax,fire};
}
export function makePlane(side,b,upg,isBot){
  const st=stats(b,upg);
  return {side,build:b,st,bt:BOMBTYPE[b.bombType],isBot,inp:{up:false,down:false,shoot:false,bomb:false,flip:false},
    x:0,y:0,s:265,p:.15,facing:side==='L'?1:-1,vz:0,hp:st.hp,bombs:st.bombsMax,flip:0,roll:0,dead:false,crashed:false,wx:0,bombCD:0,shootCD:0,hitFlash:0,respawnT:0,downs:0};
}
export function spawnPlane(pl){
  const own=G.castles.find(c=>c.side===pl.side&&G.duel);
  if(own){pl.x=castleMid(own)+(pl.side==='L'?60:-60);pl.y=castleTop(own)-70;}
  else{pl.x=HOME.x0+40;pl.y=HOME.top-45;}
  Object.assign(pl,{s:265,p:.15,facing:pl.side==='L'?1:-1,vz:0,hp:pl.st.hp,bombs:pl.st.bombsMax,flip:0,roll:0,dead:false,crashed:false,wx:0,hitFlash:0,respawnT:0});
}
export const planeDir=pl=>({x:pl.facing*Math.cos(pl.p),y:-Math.sin(pl.p)});
export const foeOf=side=>G.planes.find(p=>p.side!==side&&!p.dead)||null;
export function hitPlane(pl,dmg,reason){if(pl.dead)return;
  if(pl.remote){pl.hitFlash=0.25;spark(pl.x,pl.y,'splinter',5);return;}   // 1v1: the friend decides hits on their plane
  if(G.net&&pl===G.me)G.net.hit();
  pl.hp-=dmg;pl.hitFlash=0.25;if(pl===G.me)G.shake=Math.max(G.shake,6);spark(pl.x,pl.y,'splinter',5);sfx('hit',{x:pl.x,mine:pl===G.me});if(pl.hp<=0){pl.hp=0;killPlane(pl,reason);}}
export function killPlane(pl,reason){
  if(pl.dead)return;pl.dead=true;const d=planeDir(pl);pl.wx=d.x*pl.s*0.6;pl.vz=d.y*pl.s*0.6;pl.reason=reason;
  spark(pl.x,pl.y,'splinter',16);spark(pl.x,pl.y,'fire',12);sfx('planeDown',{x:pl.x,mine:pl===G.me});if(pl===G.me)G.shake=12;
  if(pl.isBot){G.botDowns++;floater(pl.x,pl.y-40,t('fl.botDown'),'#4f6b2c');}
}
export function explode(owner,x,y,bt,big){
  spark(x,y,'fire',big?26:14);sfx('boom',{x,big,greek:!!bt.burn});for(let i=0;i<(big?8:4);i++)spark(x,y,'smoke');
  if(Math.abs(x-(G.cam.x+viewW/2))<viewW)G.shake=Math.max(G.shake,big?10:5);
  for(const c of G.castles){if(c.side===owner)continue;for(const b of c.defs)if(b.alive&&Math.hypot(b.x-x,b.y-y)<bt.radius)killDef(c,b);}
  if(bt.burn){const c=G.castles.find(c=>c.side!==owner&&x>c.x0-30&&x<c.x0+CW+30);if(c&&!c.remote)G.burns.push({c,x,y,t:3,rate:bt.burn});else G.burns.push({c:null,x,y,t:3,rate:0});}
}
export function rearmZone(pl){
  if(G.duel){const c=G.castles.find(c=>c.side===pl.side),top=castleTop(c);return {x0:c.x0-30,x1:c.x0+CW+30,y0:top-200,y1:top-15};}
  return {x0:HOME.x0-40,x1:HOME.x1+40,y0:HOME.top-190,y1:HOME.top};
}
export function updatePlane(pl,dt){
  const st=pl.st,inp=pl.inp;
  if(pl.dead){
    if(!pl.crashed){pl.vz+=GRAV*dt;pl.x+=pl.wx*dt;pl.y+=pl.vz*dt;pl.p-=1.5*dt;if(Math.random()<0.6)spark(pl.x,pl.y,'smoke');
      if(pl.y>WORLD.ground-8){pl.y=WORLD.ground-8;pl.crashed=true;explode(pl.side,pl.x,pl.y,BOMBTYPE.stone,true);if(G.net)G.net.emit({k:'x',x:pl.x,y:pl.y});
        if(G.duel)pl.respawnT=4;else if(pl===G.me&&G.state==='play'){G.state='lost';G.end=G.t+1.6;}}}
    else if(G.duel&&G.state==='play'){pl.respawnT-=dt;if(pl.respawnT<=0){spawnPlane(pl);sfx('launch',{x:pl.x,mine:!pl.isBot});floater(pl.x,pl.y-30,pl.isBot?t('fl.botRespawn'):t('fl.respawn'));}}
    return;
  }
  if(inp.flip&&pl.flip===0){pl.flip=1;if(pl.p<0)pl.p=Math.max(pl.p,-0.3);}
  if(pl.flip>0){pl.p+=Math.max(st.agility*1.55,2.2)*dt;if(pl.p>=Math.PI){pl.p=0;pl.facing*=-1;pl.flip=0;pl.roll=1;}}
  else{const pin=(inp.up?1:0)-(inp.down?1:0);pl.p=clamp(pl.p+pin*st.agility*dt,-1.25,1.25);}
  if(pl.roll>0)pl.roll=Math.max(0,pl.roll-dt*3.5);
  const a=(st.T-st.drag*pl.s*pl.s)/st.m-G_ALONG*Math.sin(pl.p);
  pl.s=Math.max(35,pl.s+a*dt);
  const lf=clamp((pl.s/st.vstall)**2,0,1);
  if(lf<1){pl.vz+=GRAV*(1-lf)*dt;if(pl.flip===0)pl.p-=0.9*(1-lf)*dt;}else pl.vz*=Math.pow(0.12,dt);
  pl.stalling=lf<0.97;
  if(pl.y<WORLD.ceiling){pl.vz+=420*dt;if(pl.flip===0)pl.p=Math.max(-1.25,pl.p-1.4*dt);}
  const dir=planeDir(pl);
  pl.x+=dir.x*pl.s*dt;pl.y+=dir.y*pl.s*dt+pl.vz*dt;
  if(pl.flip===0&&((pl.x<60&&pl.facing===-1)||(pl.x>WORLD.width-60&&pl.facing===1)))pl.flip=1;
  pl.x=clamp(pl.x,10,WORLD.width-10);
  if(pl.hp<st.hp*0.5&&Math.random()<0.35)spark(pl.x-dir.x*30,pl.y-dir.y*30,'smoke');
  pl.bombCD-=dt;
  if(inp.bomb&&pl.bombs>0&&pl.bombCD<=0){pl.bombs--;pl.bombCD=0.22;sfx('drop',{x:pl.x,mine:pl===G.me});const bm={owner:pl.side,bt:pl.bt,mul:st.dmgMul,x:pl.x,y:pl.y+12,vx:dir.x*pl.s*0.9,vy:dir.y*pl.s*0.9+pl.vz+20};G.bombs.push(bm);
    if(G.net)G.net.emit({k:'b',x:bm.x,y:bm.y,vx:bm.vx,vy:bm.vy});}
  else if(inp.bomb&&pl.bombs===0&&pl===G.me&&pl.bombCD<=0){pl.bombCD=0.6;sfx('empty');floater(pl.x,pl.y-30,G.duel?t('fl.noBombsDuel'):t('fl.noBombs'));}
  pl.shootCD-=dt;
  if(inp.shoot&&pl.build.crossbows>0&&pl.shootCD<=0){pl.shootCD=0.5/pl.build.crossbows;const v=pl.s+650;
    sfx('crossbow',{x:pl.x,mine:pl===G.me});const ar={owner:pl.side,mul:st.dmgMul,x:pl.x+dir.x*45,y:pl.y+dir.y*45,vx:dir.x*v,vy:dir.y*v+pl.vz,life:1.4};G.arrows.push(ar);
    if(G.net)G.net.emit({k:'a',x:ar.x,y:ar.y,vx:ar.vx,vy:ar.vy});}
  const z=rearmZone(pl);
  if(pl.x>z.x0&&pl.x<z.x1&&pl.y>z.y0&&pl.y<z.y1&&pl.bombs<st.bombsMax){pl.bombs=st.bombsMax;sfx('rearm',{x:pl.x,mine:!pl.isBot});floater(pl.x,pl.y-35,pl.isBot?t('fl.botRearm'):t('fl.rearm'),pl.isBot?'#a3341f':'#4f6b2c');}
  if(G.state!=='play'&&pl.y>WORLD.ground-140)pl.p=Math.max(pl.p,0.3);
  if(pl.y>=WORLD.ground-12)killPlane(pl,'reason.ground');
  else if(!G.duel&&pl.x>HOME.x0&&pl.x<HOME.x1&&pl.y>HOME.top)killPlane(pl,'reason.home');
  else for(const c of G.castles){if(c.hp>0&&hitsCastle(c,pl.x,pl.y)){killPlane(pl,'reason.castle');if(c.side!==pl.side){damageCastle(c,pl.x,pl.y,20);if(G.net)G.net.emit({k:'r',x:pl.x,y:pl.y});}explode(pl.side,pl.x,pl.y,BOMBTYPE.stone,true);break;}}
  if(pl.hitFlash>0)pl.hitFlash-=dt;
}
