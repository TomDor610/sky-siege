// Battle setup and the per-frame simulation step.
import {botLoadout,botThink} from './bot.js';
import {castleHeightsFor,castleMid,castleSpec,castleTop,colTop,colX,damageCastle,fortDefs,hitsCastle,killDef,makeCastle,updateDefenses} from './castle.js';
import {BOLT_G,BOMB_G,BOT,CW,DUEL_CASTLE_HP,DUEL_TIME,PLAYER_DEF_AI,POT_G,WORLD} from './data.js';
import {floater,spark} from './effects.js';
import {t} from './i18n/index.js';
import {finish} from './flow.js';
import {input,pressed} from './input.js';
import {explode,foeOf,hitPlane,makePlane,spawnPlane,updatePlane} from './physics.js';
import {myCastleHP} from './progress.js';
import {G,build,difficulty,fort,gameMode,prog,setG} from './state.js';
import {sfx} from './sound.js';
import {clamp} from './util.js';
import {viewH,viewW} from './view.js';
export function newGame(){
  const duel=gameMode==='duel';
  setG({duel,diff:difficulty,state:'play',t:0,end:0,bombs:[],bolts:[],arrows:[],burns:[],parts:[],floaters:[],cam:{x:0,y:WORLD.ground-650},shake:0,killedDefs:0,botDowns:0});
  const me=makePlane('L',Object.assign({},build),prog.upg,false);
  G.planes=[me];G.me=me;
  if(duel){
    const bot=botLoadout(difficulty);G.botInfo=bot;
    const hpL=myCastleHP(),hpR=Math.round(DUEL_CASTLE_HP*(1+0.25*bot.f.walls)*(1+0.1*bot.upg.frame));
    G.castles=[
      makeCastle({side:'L',x0:150,heights:castleHeightsFor(fort.walls),hp:hpL,defs:fortDefs(fort,'L'),ai:PLAYER_DEF_AI,mods:{ballista:prog.upg.ballista,archers:prog.upg.archers,mangonel:prog.upg.mangonel},label:t('castle.labelMine'),tint:fort.walls*0.15,bands:fort.walls>=2,banners:fort.walls}),
      makeCastle({side:'R',x0:WORLD.width-150-CW,heights:castleHeightsFor(bot.f.walls),hp:hpR,defs:fortDefs(bot.f,'R'),ai:BOT[difficulty].ai,mods:{ballista:bot.upg.frame,archers:bot.upg.frame,mangonel:bot.upg.frame},label:t('castle.labelFoe'),tint:bot.f.walls*0.15,bands:bot.f.walls>=2,banners:bot.f.walls})];
    const bp=makePlane('R',bot.b,bot.upg,true);G.planes.push(bp);G.bot=bp;
    G.mult=BOT[difficulty].mult*(1+0.1*prog.duelWins[difficulty]);
  }else{
    const sp=castleSpec();G.spec=sp;
    G.castles=[makeCastle({side:'R',x0:3000,heights:sp.heights,hp:sp.castleHP,defs:sp.defs,ai:sp.ai,lvl:sp.lvl,label:t('castle.labelLevel',{lvl:sp.lvl}),tint:Math.min(1,(sp.lvl-1)/6),bands:sp.lvl>=4,banners:Math.min(4,sp.lvl-1)})];
    G.mult=sp.mult;
  }
  G.foe=G.castles.find(c=>c.side==='R');G.mine=G.castles.find(c=>c.side==='L')||null;
  for(const p of G.planes)spawnPlane(p);
  G.cam.x=me.x-viewW*0.3;
  for(let i=0;i<10;i++)spark(me.x,me.y+30,'smoke');
  floater(me.x+60,me.y-30,duel?t('fl.duelStart'):t('fl.siegeStart',{lvl:G.foe.lvl}));
}
export function update(dt){
  if(G.net)G.net.pre(dt);else G.t+=dt;
  const me=G.me;
  me.inp.up=input.up;me.inp.down=input.down;me.inp.shoot=input.shoot;me.inp.bomb=pressed.bomb;me.inp.flip=pressed.flip;
  pressed.bomb=false;pressed.flip=false;
  if(G.bot)botThink(G.bot);
  for(const p of G.planes)if(!p.remote)updatePlane(p,dt);   // 1v1: the friend's plane comes from the network
  for(const c of G.castles)updateDefenses(c,dt);
  for(const bo of G.bolts){
    bo.vy+=(bo.kind==='pot'?POT_G:BOLT_G)*dt;bo.x+=bo.vx*dt;bo.y+=bo.vy*dt;bo.life-=dt;
    const pl=G.state==='play'?foeOf(bo.owner):null,dp=pl?Math.hypot(bo.x-pl.x,bo.y-pl.y):1e9;
    if(bo.kind==='pot'){
      if(Math.random()<.6)spark(bo.x,bo.y,'flame');bo.fuse-=dt;
      const rr=bo.rad||1;
      if(dp<55*rr||bo.fuse<=0){bo.life=0;sfx('pot',{x:bo.x});spark(bo.x,bo.y,'fire',16);spark(bo.x,bo.y,'smoke');spark(bo.x,bo.y,'smoke');
        if(pl&&dp<80*rr)hitPlane(pl,bo.dmg,'reason.mangonel');}
    }else if(pl&&dp<24){bo.life=0;spark(bo.x,bo.y,'spark',10);hitPlane(pl,bo.dmg,bo.kind==='arrow'?'reason.arrows':'reason.bolt');}
    if(bo.y>WORLD.ground)bo.life=0;
  }
  G.bolts=G.bolts.filter(b=>b.life>0);
  for(const ar of G.arrows){
    ar.vy+=120*dt;ar.x+=ar.vx*dt;ar.y+=ar.vy*dt;ar.life-=dt;
    for(const c of G.castles){if(c.side===ar.owner)continue;
      for(const b of c.defs)if(ar.life>0&&b.alive&&Math.hypot(b.x-ar.x,b.y-ar.y)<30){ar.life=0;spark(ar.x,ar.y,'splinter',5);if(!c.remote){b.hp--;if(b.hp<=0)killDef(c,b);}}
      if(ar.life>0&&c.hp>0&&hitsCastle(c,ar.x,ar.y)){ar.life=0;sfx('thunk',{x:ar.x});if(!c.remote)c.hp-=3*ar.mul;spark(ar.x,ar.y,'spark',6);}}
    const pl=foeOf(ar.owner);
    if(ar.life>0&&pl&&Math.hypot(pl.x-ar.x,pl.y-ar.y)<26){ar.life=0;hitPlane(pl,8*ar.mul,'reason.crossbow');spark(ar.x,ar.y,'spark',8);}
    if(ar.y>WORLD.ground)ar.life=0;
  }
  G.arrows=G.arrows.filter(a=>a.life>0);
  for(const bm of G.bombs){
    bm.vy+=BOMB_G*dt;bm.vx*=Math.pow(0.9,dt);bm.x+=bm.vx*dt;bm.y+=bm.vy*dt;
    if(bm.bt.burn&&Math.random()<.5)spark(bm.x,bm.y-4,'flame');
    let hit=false;
    for(const c of G.castles){if(c.side===bm.owner||c.hp<=0)continue;if(hitsCastle(c,bm.x,bm.y)){bm.dead=true;hit=true;explode(bm.owner,bm.x,bm.y,bm.bt,true);damageCastle(c,bm.x,bm.y,bm.bt.dmg*bm.mul);break;}}
    if(!hit&&bm.y>=WORLD.ground-4){bm.dead=true;explode(bm.owner,bm.x,WORLD.ground-4,bm.bt,false);
      for(const c of G.castles)if(c.side!==bm.owner&&c.hp>0&&bm.x>c.x0-30&&bm.x<c.x0+CW+30){if(!c.remote)c.hp-=8;floater(bm.x,bm.y-40,'-8');}}
    else if(bm.x<0||bm.x>WORLD.width)bm.dead=true;
  }
  G.bombs=G.bombs.filter(b=>!b.dead);
  for(const bu of G.burns){bu.t-=dt;if(Math.random()<0.7)spark(bu.x,bu.y,'flame');if(bu.c&&!bu.c.remote&&bu.c.hp>0&&G.state==='play')bu.c.hp-=bu.rate*dt;}
  G.burns=G.burns.filter(b=>b.t>0);
  // outcome
  if(G.net)G.net.post(dt);   // 1v1: send my state, decide the end (net/battle.js)
  else if(G.state==='play'){
    const foeDown=G.foe.hp<=0,mineDown=G.mine&&G.mine.hp<=0;
    if(foeDown||mineDown){
      G.state=foeDown&&!mineDown?'won':'lost';G.winTime=G.t;G.end=G.t+2.6;
      for(const c of G.castles)if(c.hp<=0){c.hp=0;c.fallen=true;sfx('castleFall',{x:castleMid(c)});floater(castleMid(c),castleTop(c)-60,c.side==='L'?t('fl.castleFellMine'):t('fl.castleFell'),c.side==='L'?'#a3341f':'#4f6b2c');for(const b of c.defs)b.alive=false;}
    }else if(G.duel&&G.t>=DUEL_TIME){
      const mp=G.mine.hp/G.mine.max,fp=G.foe.hp/G.foe.max;G.state=mp>fp?'won':'lost';G.timeUp=true;G.winTime=G.t;G.end=G.t+1.5;
      floater(me.x,me.y-50,t('fl.timeUp'));
    }
  }
  for(const c of G.castles)if(c.fallen&&Math.random()<0.5){const i=Math.floor(Math.random()*c.heights.length);if(c.heights[i]>0){c.heights[i]-=1;spark(colX(c,i)+20,colTop(c,i),'debris',5);spark(colX(c,i)+20,colTop(c,i),'smoke');}}
  for(const p of G.parts){
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.type==='debris'){p.vy+=500*dt;p.rot+=p.vr*dt;if(p.y>WORLD.ground-3){p.y=WORLD.ground-3;p.vy*=-0.3;p.vx*=0.6;}}
    else if(p.type==='fire'){p.vx*=0.92;p.vy=p.vy*0.92-20*dt;}
    else if(p.type==='smoke')p.sz+=12*dt;
  }
  G.parts=G.parts.filter(p=>p.life>0);if(G.parts.length>600)G.parts.splice(0,G.parts.length-600);
  for(const f of G.floaters){f.life-=dt;f.y-=30*dt;}
  G.floaters=G.floaters.filter(f=>f.life>0);
  const look=me.dead?0:me.facing*viewW*0.14;
  G.cam.x+=(me.x-viewW/2+look-G.cam.x)*Math.min(1,dt*3);
  G.cam.x=clamp(G.cam.x,-200,WORLD.width+200-viewW);
  const bottom=WORLD.ground+70-viewH;
  G.cam.y+=(Math.min(me.y-viewH*0.45,bottom)-G.cam.y)*Math.min(1,dt*4);
  G.cam.y=Math.min(G.cam.y,bottom);
  G.shake=Math.max(0,G.shake-dt*25);
  if(G.end&&G.t>=G.end&&G.state!=='over')finish();
}
