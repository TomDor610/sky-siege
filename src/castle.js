// Castles, defenses and castle damage.
import {BASE_HEIGHTS,BOLT_G,BOLT_SPEED,COL,CW,DEF,DIFF,FREE_COLS,LEVEL_ADDS,POT_G,SLOT_COLS,WORLD} from './data.js';
import {floater,spark} from './effects.js';
import {foeOf,planeDir} from './physics.js';
import {G,difficulty,prog} from './state.js';
import {clamp,rnd} from './util.js';
export function castleHeightsFor(walls){return BASE_HEIGHTS.map((h,i)=>h+((i>=2&&i<=3)||(i>=7&&i<=8)?walls:0)+(i>=4&&i<=6&&walls>=2?1:0));}
export function castleSpec(diff,lvl){
  diff=diff||difficulty;const d0=DIFF[diff];lvl=lvl||prog.wins[diff]+1;
  const defs=d0.ballistae.map(col=>({type:'ballista',col}));const usedC=new Set(defs.map(x=>x.col));
  let newest=null;
  for(let L=2;L<=Math.min(lvl,LEVEL_ADDS.length-1);L++){const col=FREE_COLS.find(c=>!usedC.has(c));if(col===undefined)break;usedC.add(col);defs.push({type:LEVEL_ADDS[L],col});if(L===lvl)newest=LEVEL_ADDS[L];}
  const g=lvl-1;
  const heights=BASE_HEIGHTS.map((h,i)=>{const tower=i<=1||i>=9,keep=i>=4&&i<=6;return Math.min(11,h+(tower?Math.floor(g/2):keep?Math.floor((g+1)/3):Math.floor(g/3)));});
  return Object.assign({},d0,{lvl,defs,newest,heights,castleHP:Math.round(d0.castleHP*(1+0.3*g)),ai:{fire:d0.fire*Math.max(0.5,1-0.06*g),spread:d0.spread*Math.max(0.45,1-0.07*g),lead:Math.min(1,d0.lead+0.1*g)},mult:d0.mult*(1+0.15*g)});
}
export function defsSummary(spec){const c={};for(const d of spec.defs)c[d.type]=(c[d.type]||0)+1;return Object.keys(c).map(k=>c[k]>1?`${c[k]} ${DEF[k].plural}`:DEF[k].name).join(', ');}
export function makeCastle(o){
  return {side:o.side,x0:o.x0,heights:o.heights.slice(),base:o.heights.slice(),hp:o.hp,max:o.hp,ai:o.ai,lvl:o.lvl||1,label:o.label,tint:o.tint||0,bands:!!o.bands,banners:o.banners||0,
    color:o.side==='L'?'#4f6b2c':'#a3341f',mods:o.mods||{ballista:0,archers:0,mangonel:0},
    defs:o.defs.map(d=>({type:d.type,col:d.col,alive:true,hp:DEF[d.type].hp,cd:1.5+Math.random()*1.5,angle:o.side==='L'?0:Math.PI,x:0,y:0,swing:0}))};
}
export function fortDefs(f,side){const out=[];f.slots.forEach((t,i)=>{if(t)out.push({type:t,col:SLOT_COLS[side][i]});});return out;}
export const colX=(c,i)=>c.x0+i*COL;
export const colTop=(c,i)=>WORLD.ground-c.heights[i]*COL;
export const castleTop=c=>WORLD.ground-Math.max(...c.heights)*COL;
export const castleMid=c=>c.x0+CW/2;
export function hitsCastle(c,x,y){if(x<c.x0||x>=c.x0+CW)return false;return y>=colTop(c,Math.floor((x-c.x0)/COL));}
export function killDef(c,b){if(!b.alive)return;b.alive=false;spark(b.x,b.y,'splinter',18);floater(b.x,b.y-40,'חוסל: '+DEF[b.type].name,c.side==='L'?'#a3341f':'#4f6b2c');c.hp-=10;if(c.side==='R')G.killedDefs++;}
export function damageCastle(c,x,y,dmg){
  const ci=Math.floor((x-c.x0)/COL);
  for(let d=-1;d<=1;d++){const i=ci+d;if(i<0||i>=c.heights.length)continue;
    if(c.heights[i]>1){const b=c.heights[i];c.heights[i]=Math.max(1,b-(d===0?2:1));if(c.heights[i]<b)spark(colX(c,i)+20,colTop(c,i),'debris',6);}}
  c.hp-=dmg;floater(x,y-50,'-'+Math.round(dmg),c.side==='L'?'#a3341f':'#4f6b2c');
}
export function updateDefenses(c,dt){
  const A=c.ai;
  for(const b of c.defs){
    if(!b.alive)continue;
    b.x=colX(c,b.col)+20;b.y=colTop(c,b.col)-12;
    if(c.heights[b.col]<=1&&G.state==='play'){killDef(c,b);continue;}
    if(b.swing>0)b.swing-=dt;
    const pl=foeOf(c.side);
    if(G.state!=='play'||!pl)continue;
    const dist=Math.hypot(pl.x-b.x,pl.y-b.y),dir=planeDir(pl),vx=dir.x*pl.s,vy=dir.y*pl.s+pl.vz;
    b.cd-=dt;
    if(b.type==='mangonel'){
      const T=clamp(dist/430,0.9,2.4),L=Math.max(0.5,A.lead),tx=pl.x+vx*T*L,ty=pl.y+vy*T*L;
      b.angle=Math.atan2(ty-b.y,tx-b.x);
      if(dist<1350&&b.cd<=0){b.cd=A.fire*1.7*rnd(.85,1.15);b.swing=0.5;const ex=rnd(-1,1)*A.spread*250,mm=1+0.15*c.mods.mangonel;
        G.bolts.push({owner:c.side,kind:'pot',x:b.x,y:b.y-10,vx:(tx+ex-b.x)/T,vy:(ty-b.y+10-0.5*POT_G*T*T)/T,life:T+0.8,fuse:T,dmg:20*mm,rad:mm});}
      continue;
    }
    const spd=b.type==='archers'?560:BOLT_SPEED,tt=dist/spd;
    const target=Math.atan2(pl.y+vy*tt*A.lead-0.5*BOLT_G*tt*tt-b.y,pl.x+vx*tt*A.lead-b.x);
    let da=target-b.angle;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
    b.angle+=clamp(da,-3*dt,3*dt);
    if(b.type==='archers'){
      if(dist<820*(1+0.1*c.mods.archers)&&b.cd<=0&&Math.abs(da)<0.4){b.cd=A.fire*1.1*(1-0.06*c.mods.archers)*rnd(.8,1.2);
        for(let k=0;k<3;k++){const a=b.angle+rnd(-1,1)*(A.spread+0.07);G.bolts.push({owner:c.side,kind:'arrow',x:b.x,y:b.y-8,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:2,dmg:10});}}
    }else if(dist<1150&&b.cd<=0&&Math.abs(da)<0.3){b.cd=A.fire*(1-0.06*c.mods.ballista)*rnd(0.8,1.2);const a=b.angle+rnd(-1,1)*A.spread;
      G.bolts.push({owner:c.side,kind:'bolt',x:b.x+Math.cos(a)*20,y:b.y+Math.sin(a)*20,vx:Math.cos(a)*BOLT_SPEED,vy:Math.sin(a)*BOLT_SPEED,life:3,dmg:25*(1+0.12*c.mods.ballista)});}
  }
}
