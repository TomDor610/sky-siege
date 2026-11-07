// Screen flow: start, pause, finish/results and the main loop.
import {castleSpec} from './castle.js';
import {BOT,DEF,DIFF,RANK_MAX,STYLES} from './data.js';
import {paperOverlay} from './draw/paper.js';
import {render} from './draw/render.js';
import {newGame,update} from './game.js';
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
  const ctl=(isTouch?'▲▼ גובה · ⟲ סיבוב · 💣 פצצה':'↑↓ גובה · ←→ סיבוב · רווח = פצצה')+(build.crossbows>0?(isTouch?' · 🏹 קשת':' · X = קשת'):'');
  tip.textContent=G.duel?`הפל את הטירה של היריב לפני שהוא מפיל את שלך · ${ctl} · חימוש מעל הטירה שלך`:(G.spec.newest?`טירה רמה ${G.spec.lvl} · חדש: ${DEF[G.spec.newest].name}! · `:'')+ctl+' · חזור למגדל כדי לחמש';
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
  const lines=[[G.duel?`נזק לטירת היריב (${pct}%)`:`נזק לטירה (${pct}%)`,Math.round(pct*0.8)]];
  if(G.killedDefs)lines.push([`הגנות שהושמדו (${G.killedDefs})`,15*G.killedDefs]);
  if(G.duel&&G.botDowns)lines.push([`מכונות יריב שהופלו (${G.botDowns})`,25*G.botDowns]);
  if(won){
    lines.push(['ניצחון',G.duel?100:60]);
    if(G.duel){const kept=Math.round(100*Math.max(0,G.mine.hp)/G.mine.max);if(kept)lines.push([`הטירה שלך שרדה (${kept}%)`,Math.round(kept*0.4)]);}
    else{const sp=Math.max(0,Math.round(90-G.winTime));if(sp)lines.push(['בונוס מהירות',sp]);if(G.me.hp>=G.me.st.hp*0.5)lines.push(['מכונה כמעט שלמה',20]);}
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
    if(won){$('resTitle').textContent=G.timeUp?'ניצחון בנקודות!':'ניצחון בדו-קרב! ⚔';
      $('resText').textContent=G.timeUp?`נגמר הזמן: לטירה שלך נשארו ${myPct}% ולטירת היריב ${100-pct}%. הבוט ה${BOT[G.diff].name} יתחזק בפעם הבאה.`:`הפלת את טירת הבוט ה${BOT[G.diff].name} תוך ${G.winTime.toFixed(0)} שניות, ולטירה שלך נשארו ${myPct}%.`;
      shareText=`ניצחתי בדו-קרב ב-Sky Siege מול בוט ${BOT[G.diff].name} תוך ${G.winTime.toFixed(0)} שניות, והטירה שלי שרדה עם ${myPct}%. נראה אותך 😏`;}
    else{$('resTitle').textContent=G.quit?'פרשת מהקרב':G.timeUp?'הפסד בנקודות':'הטירה שלך נפלה';
      $('resText').textContent=G.quit?'חצי מהמטבעות על הנזק נשמרו.':G.timeUp?`נגמר הזמן: לטירה שלך נשארו ${myPct}% ולטירת היריב ${100-pct}%.`:`הספקת להרוס ${pct}% מטירת היריב. אולי כדאי לחלק אחרת את הנקודות בין המכונה להגנות?`;
      shareText=`הרסתי ${pct}% מטירת הבוט ב-Sky Siege לפני שהטירה שלי נפלה. אתה תצליח יותר?`;}
  }else if(won){
    $('resTitle').textContent=rec?'ניצחון! 🏆 שיא חדש':'ניצחון!';
    const nx=castleSpec(G.diff,G.foe.lvl+1);
    $('resText').textContent=`טירה רמה ${G.foe.lvl} (${DIFF[G.diff].name}) נפלה תוך ${G.winTime.toFixed(1)} שניות. הבאה: רמה ${nx.lvl}, חוזק ${nx.castleHP}${nx.newest?', וחדש: '+DEF[nx.newest].name:''}.`;
    shareText=`הפלתי טירה רמה ${G.foe.lvl} ב-Sky Siege תוך ${G.winTime.toFixed(1)} שניות עם "${STYLES[build.style].name}" שבניתי. נראה אותך 😏`;
  }else{
    $('resTitle').textContent=G.quit?'פרשת מהקרב':'המכונה הופלה';
    $('resText').textContent=G.quit?'חצי מהמטבעות על הנזק נשמרו.':`${G.me.reason||'המכונה הושמדה'}. הספקת להרוס ${pct}% מהטירה. המטבעות שלך, אז אולי זה הזמן לשדרג?`;
    shareText=`הרסתי ${pct}% מטירה רמה ${G.foe.lvl} ב-Sky Siege. אתה תצליח יותר?`;
  }
  let html='';for(const [n,v] of lines)html+=`<div><span>${n}</span><span>${v}</span></div>`;
  if(G.mult!==1)html+=`<div><span>מכפיל קושי ורמה</span><span>×${G.mult.toFixed(2)}</span></div>`;
  html+=`<div class="tot"><span>הרווחת</span><span>+${total} 🪙</span></div><div style="border:none"><span>יתרה</span><span>${prog.coins} 🪙</span></div>`;
  html+=`<div style="border:none"><span>ניסיון</span><span>+${xpGain} ⭐</span></div>`;
  if(r1>r0)html+=`<div class="tot" style="color:var(--green)"><span>עלית לדרגה ${r1} · ${rankName(r1)}!</span><span>+${5*(r1-r0)} 🔨</span></div>`;
  else if(r1<RANK_MAX)html+=`<div style="border:none;font-size:13px;color:var(--ink2)"><span>לדרגה ${r1+1}</span><span>עוד ${xpFor(r1+1)-prog.xp} ⭐</span></div>`;
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
$('copyBtn').onclick=async()=>{try{await navigator.clipboard.writeText(shareText);$('copyMsg').textContent='הועתק! אפשר להדביק בוואטסאפ.';}catch(e){$('copyMsg').textContent=shareText;}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
}
