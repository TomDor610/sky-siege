// Live background of the title screen, drawn with the same art as the game: paper, sky,
// clouds, a castle and the player's own machine flying over it.
// Purely decorative: a fixed path, no physics, and no game state is touched.
import {colTop,colX,castleTop,makeCastle} from '../castle.js';
import {CW,WORLD} from '../data.js';
import {t as tr} from '../i18n/index.js';
import {build} from '../state.js';
import {ctx,cv,scale,viewH,viewW} from '../view.js';
import {drawCastle} from './castle.js';
import {drawMachine} from './machine.js';
import {paperOverlay} from './paper.js';
import {drawGround,drawSky} from './world.js';

const CAM0=1200;
let castle=null;

function makeTitleCastle(){
  return makeCastle({side:'R',x0:0,heights:[6,6,4,4,8,8,8,4,4,6,6],hp:1,ai:{},label:'',tint:.25,bands:true,banners:2,
    defs:[{type:'archers',col:0},{type:'ballista',col:5},{type:'mangonel',col:10}]});
}

export function drawTitleScene(time){
  if(!castle)castle=makeTitleCastle();
  const W=cv.width,H=cv.height;
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#fcf4de');g.addColorStop(1,'#fef9ec');
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  const camx=CAM0+Math.sin(time*.07)*50,camy=WORLD.ground+70-viewH;
  castle.x0=CAM0+viewW/2-CW/2;
  castle.label=tr('castle.labelFoe');
  for(const b of castle.defs){b.x=colX(castle,b.col)+20;b.y=colTop(castle,b.col)-12;b.angle=Math.PI+Math.sin(time*.6+b.col)*.35;b.cd=1;}

  ctx.setTransform(scale,0,0,scale,0,0);
  drawSky(camx,camy,time);
  ctx.save();ctx.translate(-camx,-camy);
  drawGround(camx);
  drawCastle(castle,time);

  // the machine crosses the screen above the castle, bobbing gently, then comes around again
  const span=viewW+500,x=CAM0-250+((time*125)%span),y=castleTop(castle)-165+Math.sin(time*.9)*34;
  ctx.save();ctx.translate(x,y);ctx.rotate(-Math.cos(time*.9)*.1);ctx.scale(1.2,1.2);
  drawMachine(ctx,build,time,Math.min(build.bombs,9),false);
  ctx.restore();

  ctx.restore();
  paperOverlay();
}
