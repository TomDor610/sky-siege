// Screen flow: start, pause, finish/results and the main loop.
import {castleSpec} from './castle.js';
import {RANK_MAX} from './data.js';
import {paperOverlay} from './draw/paper.js';
import {render} from './draw/render.js';
import {newGame,update} from './game.js';
import {t} from './i18n/index.js';
import {input,isTouch} from './input.js';
import {myRank,rankName,sanitize,saveProg,xpFor} from './progress.js';
import {G,build,prog,setG} from './state.js';
import {drawPreview,refreshBuild,setPreviewStyle} from './ui/build.js';
import {hud,resetHud} from './ui/hud.js';
import {tutorialBegin,tutorialEnd,tutorialTick} from './ui/tutorial.js';
import {$} from './util.js';
import {ctx,cv,resize} from './view.js';
import {duckMusic,setMusicMode,sfx,soundFrame} from './sound.js';
export let mode='menu',last=0,tipTimer=0;
export function show(id){['buildScreen','resultScreen','pauseScreen'].forEach(s=>$(s).classList.toggle('hidden',s!==id));}
export function setPlayUI(on){['hud','pauseBtn','soundBtn'].forEach(s=>$(s).classList.toggle('hidden',!on));$('touch').classList.toggle('hidden',!(on&&isTouch));$('shootBtn').classList.toggle('hidden',!(build.crossbows>0));}
export function start(){
  sanitize();setPreviewStyle(null);
  newGame();resetHud();mode='play';show(null);setPlayUI(true);resize();
  for(const k in input)input[k]=false;
  const tip=$('tip');
  const dev=isTouch?'touch':'keys',ctl=t('tip.ctl.'+dev)+(build.crossbows>0?t('tip.bow.'+dev):'');
  tip.textContent=G.duel?t('tip.duel',{ctl}):(G.spec.newest?t('tip.newLevel',{lvl:G.spec.lvl,name:t(`def.${G.spec.newest}.name`)}):'')+t('tip.campaign',{ctl});
  tip.classList.remove('hidden');tip.style.opacity=1;clearTimeout(tipTimer);
  tipTimer=setTimeout(()=>{tip.style.opacity=0;setTimeout(()=>tip.classList.add('hidden'),700);},6000);
  tutorialBegin();
  setMusicMode('battle');duckMusic(false);sfx('launch');
}
export function toMenu(){tutorialEnd();setMusicMode('menu');duckMusic(false);mode='menu';setG(null);setPlayUI(false);show('buildScreen');refreshBuild();resize();}
export function pause(){if(mode!=='play')return;mode='pause';show('pauseScreen');duckMusic(true);}
export let shareText='';
export function finish(){
  G.state=G.state==='won'?'wonDone':'lostDone';const won=G.state==='wonDone';sfx(won?'win':'lose');setMusicMode('menu');duckMusic(false);
  tutorialEnd();mode='result';setPlayUI(false);$('tip').classList.add('hidden');
  const foe=G.foe,pct=Math.round(100*(1-Math.max(0,foe.hp)/foe.max));
  const lines=[[G.duel?t('res.dmgFoe',{pct}):t('res.dmg',{pct}),Math.round(pct*0.8)]];
  if(G.killedDefs)lines.push([t('res.defs',{n:G.killedDefs}),15*G.killedDefs]);
  if(G.duel&&G.botDowns)lines.push([t('res.botDowns',{n:G.botDowns}),25*G.botDowns]);
  if(won){
    lines.push([t('res.victory'),G.duel?100:60]);
    if(G.duel){const kept=Math.round(100*Math.max(0,G.mine.hp)/G.mine.max);if(kept)lines.push([t('res.kept',{pct:kept}),Math.round(kept*0.4)]);}
    else{const sp=Math.max(0,Math.round(90-G.winTime));if(sp)lines.push([t('res.speed'),sp]);if(G.me.hp>=G.me.st.hp*0.5)lines.push([t('res.intact'),20]);}
  }
  if(G.quit)lines.length=1,lines[0][1]=Math.round(lines[0][1]/2);
  const sub=lines.reduce((a,l)=>a+l[1],0),total=Math.round(sub*G.mult);
  prog.coins+=total;
  const xpGain=G.quit?5:Math.round(20+pct*0.5+(won?40:0)+5*G.killedDefs+(G.duel?8*G.botDowns:0));
  const r0=myRank();prog.xp=(prog.xp||0)+xpGain;const r1=myRank();
  let rec=false;
  if(won){
    if(G.duel)prog.duelWins[G.diff]++;
    else{const tm=G.winTime,prev=prog.best[G.diff];rec=!prev||tm<prev;if(rec)prog.best[G.diff]=tm;prog.wins[G.diff]++;}
  }
  saveProg();$('copyMsg').textContent='';
  if(G.duel){
    const myPct=Math.round(100*Math.max(0,G.mine.hp)/G.mine.max);
    const d=t(`diff.${G.diff}.inline`);
    if(won){const s=G.winTime.toFixed(0);$('resTitle').textContent=G.timeUp?t('res.winPoints'):t('res.winDuel');
      $('resText').textContent=G.timeUp?t('res.winPointsText',{mine:myPct,foe:100-pct,d}):t('res.winDuelText',{d,s,mine:myPct});
      shareText=t('share.winDuel',{d:t(`diff.${G.diff}.name`),s,mine:myPct});}
    else{$('resTitle').textContent=G.quit?t('res.quit'):G.timeUp?t('res.losePoints'):t('res.castleFell');
      $('resText').textContent=G.quit?t('res.quitText'):G.timeUp?t('res.losePointsText',{mine:myPct,foe:100-pct}):t('res.castleFellText',{pct});
      shareText=t('share.loseDuel',{pct});}
  }else if(won){
    $('resTitle').textContent=rec?t('res.winRecord'):t('res.win');
    const nx=castleSpec(G.diff,G.foe.lvl+1);
    $('resText').textContent=t('res.winText',{lvl:G.foe.lvl,d:t(`diff.${G.diff}.name`),s:G.winTime.toFixed(1),next:nx.lvl,hp:nx.castleHP,newPart:nx.newest?t('res.nextNew',{name:t(`def.${nx.newest}.name`)}):''});
    shareText=t('share.win',{lvl:G.foe.lvl,s:G.winTime.toFixed(1),style:t(`style.${build.style}.name`)});
  }else{
    $('resTitle').textContent=G.quit?t('res.quit'):t('res.downed');
    $('resText').textContent=G.quit?t('res.quitText'):t('res.downedText',{reason:t(G.me.reason||'reason.destroyed'),pct});
    shareText=t('share.lose',{pct,lvl:G.foe.lvl});
  }
  let html='';for(const [n,v] of lines)html+=`<div><span>${n}</span><span>${v}</span></div>`;
  if(G.mult!==1)html+=`<div><span>${t('res.mult')}</span><span>×${G.mult.toFixed(2)}</span></div>`;
  html+=`<div class="tot"><span>${t('res.earned')}</span><span>+${total} 🪙</span></div><div style="border:none"><span>${t('res.balance')}</span><span>${prog.coins} 🪙</span></div>`;
  html+=`<div style="border:none"><span>${t('res.xp')}</span><span>+${xpGain} ⭐</span></div>`;
  if(r1>r0)html+=`<div class="tot" style="color:var(--green)"><span>${t('res.rankUp',{r:r1,name:rankName(r1)})}</span><span>+${5*(r1-r0)} 🔨</span></div>`;
  else if(r1<RANK_MAX)html+=`<div style="border:none;font-size:13px;color:var(--ink2)"><span>${t('res.toRank',{r:r1+1})}</span><span>${t('res.xpLeft',{xp:xpFor(r1+1)-prog.xp})}</span></div>`;
  $('earn').innerHTML=html;show('resultScreen');
}
export function loop(now){
  const dt=Math.min(0.033,(now-last)/1000||0);last=now;const t=now/1000;
  if(mode==='play'){update(dt);tutorialTick(dt);hud();}
  soundFrame(dt,mode==='play');
  if(G&&mode!=='menu')render(t);
  else{ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#f4e6c8';ctx.fillRect(0,0,cv.width,cv.height);paperOverlay();}
  if(mode==='menu')drawPreview(t);
  requestAnimationFrame(loop);
}
export function initFlow(){
$('pauseBtn').onclick=pause;
$('resumeBtn').onclick=()=>{mode='play';show(null);last=performance.now();duckMusic(false);};
$('quitBtn').onclick=()=>{if(G&&G.state==='play'){G.quit=true;G.state='lost';finish();}else toMenu();};
$('launchBtn').onclick=start;$('againBtn').onclick=start;$('rebuildBtn').onclick=toMenu;
$('copyBtn').onclick=async()=>{try{await navigator.clipboard.writeText(shareText);$('copyMsg').textContent=t('res.copied');}catch(e){$('copyMsg').textContent=shareText;}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
}
