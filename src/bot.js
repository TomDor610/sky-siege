// Duel bot: loadout and piloting.
import {castleMid,castleTop} from './castle.js';
import {BOMB_G,BOT,CW,DEF,WALL_COST,WALL_MAX,WORLD} from './data.js';
import {planeDir} from './physics.js';
import {spent} from './progress.js';
import {G,prog} from './state.js';
import {clamp,pick,rnd} from './util.js';
export function botPool(diff){return BOT[diff].pool+Math.min(100,10*prog.duelWins[diff]);}
export function botLoadout(diff){
  const P=botPool(diff);
  const arch=pick([{style:'classic',wings:2,props:2,armor:1,bombs:5},{style:'falcon',wings:2,props:3,armor:0,bombs:4},{style:'galleon',wings:3,props:2,armor:2,bombs:4},{style:'bat',wings:2,props:2,armor:1,bombs:4}]);
  const b=Object.assign({crossbows:0,bombType:'stone'},arch);
  if(diff==='hard'&&Math.random()<.35)b.bombType='greek';
  while(spent(b)>P*0.6&&b.bombs>2)b.bombs--;
  let left=P-spent(b);
  const f={slots:[null,null,null,null],walls:0};
  for(const i of [0,2,1,3]){const opts=['ballista','archers','mangonel'].filter(t=>DEF[t].cost<=left);if(!opts.length)break;const t=pick(opts);f.slots[i]=t;left-=DEF[t].cost;}
  while(left>=WALL_COST&&f.walls<WALL_MAX){f.walls++;left-=WALL_COST;}
  const L=Math.min(5,BOT[diff].upg+Math.floor(prog.duelWins[diff]/2));
  return {b,f,upg:{frame:L,wings:L,props:L,armor:L,weapons:L,workshop:0}};
}
export function botThink(pl){
  const A=BOT[G.diff],inp=pl.inp;inp.up=inp.down=inp.bomb=inp.flip=inp.shoot=false;
  if(pl.dead)return;
  const tc=G.castles.find(c=>c.side!==pl.side),hc=G.castles.find(c=>c.side===pl.side);
  const attack=pl.bombs>0,tgt=attack?tc:hc,tx=castleMid(tgt);
  const topT=castleTop(tc),topH=castleTop(hc);
  let alt=attack?topT-A.alt:(Math.abs(pl.x-tx)<650?topH-95:Math.min(topT,topH)-A.alt-40);
  alt=clamp(alt,WORLD.ceiling+90,WORLD.ground-170);
  const dx=tx-pl.x,want=Math.sign(dx)||pl.facing;
  if(pl.flip===0&&want!==pl.facing&&Math.abs(dx)>(attack?240:110)){inp.flip=true;pl.newPass=true;}
  const dir=planeDir(pl);
  let desired=clamp((pl.y-alt)*0.004,-0.45,0.45);
  if(pl.s<pl.st.vstall*1.18)desired=Math.min(desired,-0.2);
  for(const c of G.castles){const ahead=pl.x+dir.x*140;if(ahead>c.x0-30&&ahead<c.x0+CW+30&&pl.y>castleTop(c)-70)desired=0.6;}
  if(pl.y>WORLD.ground-170)desired=0.6;
  if(pl.p<desired-0.05)inp.up=true;else if(pl.p>desired+0.05)inp.down=true;
  if(attack&&pl.facing===want&&pl.flip===0){
    if(pl.newPass||pl.aimErr===undefined){pl.aimErr=rnd(-1,1)*A.err;pl.newPass=false;pl.passBombs=0;}
    const vx=dir.x*pl.s*0.9,vy=dir.y*pl.s*0.9+pl.vz+20,h=(castleTop(tc)+60)-(pl.y+12),disc=vy*vy+2*BOMB_G*h;
    if(h>0&&disc>0){const t=(-vy+Math.sqrt(disc))/BOMB_G,ix=pl.x+vx*t;if(Math.abs(ix-(tx+pl.aimErr))<35&&(pl.passBombs||0)<A.perPass&&pl.bombCD<=0){inp.bomb=true;pl.passBombs=(pl.passBombs||0)+1;}}
  }
}
