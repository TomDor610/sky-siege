// Workshop screen: styles, parts, fort slots, shop, difficulty.
import {botPool} from '../bot.js';
import {castleHeightsFor,castleSpec,defsSummary} from '../castle.js';
import {BOMBTYPE,BOT,DEF,DEF_ORDER,INK,PARTS,RANK_MAX,SLOT_COLS,SLOT_NAMES,STYLES,UNLOCKS,UPG,UPG_CASTLE,WALL_COST,WALL_MAX} from '../data.js';
import {drawMachine} from '../draw/machine.js';
import {isTouch} from '../input.js';
import {stats} from '../physics.js';
import {costOf,defaultBuild,defaultFort,fortCost,freshProg,myCastleHP,myRank,partCost,pool,rankName,sanitize,saveBuild,saveProg,upgMax,used,xpFor} from '../progress.js';
import {build,difficulty,fort,gameMode,prog,setBuild,setDifficulty,setFort,setGameMode,setProg} from '../state.js';
import {$,clamp,store} from '../util.js';
export const preview=$('preview'),pctx=preview.getContext('2d');
export let previewStyle=null;
export function setPreviewStyle(v){previewStyle=v;}
export function renderStyles(){
  const box=$('styles');box.innerHTML='';
  const cur=previewStyle||build.style;
  for(const k in STYLES){
    const S=STYLES[k],own=!!prog.styles[k];
    const b=document.createElement('button');b.className='sty'+(k===cur?' on':'')+(own?'':' locked');
    b.innerHTML=`<b>${S.name}</b><i>${own?S.tag:'🔒 '+S.cost+' 🪙'}</i>`;
    b.onclick=()=>{if(own){build.style=k;previewStyle=null;saveBuild();}else previewStyle=k;refreshBuild();};
    box.appendChild(b);
  }
  const S=STYLES[cur];$('styDesc').textContent=S.desc;
  const ub=$('unlockStyle');
  if(previewStyle&&!prog.styles[previewStyle]){
    ub.classList.remove('hidden');ub.disabled=prog.coins<S.cost;
    ub.textContent=prog.coins>=S.cost?`פתח את "${S.name}" ב-${S.cost} 🪙`:`צריך ${S.cost} 🪙 (חסרים ${S.cost-prog.coins})`;
    ub.onclick=()=>{if(prog.coins<S.cost)return;prog.coins-=S.cost;prog.styles[previewStyle]=true;build.style=previewStyle;previewStyle=null;saveProg();saveBuild();refreshBuild();};
  }else ub.classList.add('hidden');
}
export function partRow(box,label,cost,desc,val,canDec,canInc,onDec,onInc){
  const d=document.createElement('div');d.className='part';
  d.innerHTML=`<div class="nm">${label} <span class="cost">(${cost} 🔨)</span></div>
    <div class="ctl"><button>−</button><span>${val}</span><button>+</button></div><div class="ds">${desc}</div>`;
  const [m,p]=d.querySelectorAll('button');m.disabled=!canDec;p.disabled=!canInc;m.onclick=onDec;p.onclick=onInc;box.appendChild(d);
}
export function renderParts(){
  const box=$('parts');box.innerHTML='';const free=pool()-used();
  for(const k in PARTS){
    const p=PARTS[k];if(p.req&&!prog.unl[p.req])continue;
    const c=partCost(k,build);
    partRow(box,k==='bombs'?BOMBTYPE[build.bombType].plural:p.name,c,p.desc,build[k],build[k]>p.min,build[k]<p.max&&c<=free,
      ()=>{build[k]--;saveBuild();refreshBuild();},()=>{build[k]++;saveBuild();refreshBuild();});
  }
  $('bombSeg').querySelectorAll('button').forEach(b=>{
    const t=b.dataset.b,locked=t==='greek'&&!prog.unl.greek;
    b.classList.toggle('on',build.bombType===t);b.disabled=locked;b.textContent=BOMBTYPE[t].name+(locked?' 🔒':'');
    b.onclick=()=>{build.bombType=t;sanitize();saveBuild();refreshBuild();};
  });
}
export function renderFort(){
  $('fortBox').classList.toggle('hidden',gameMode!=='duel');
  if(gameMode!=='duel')return;
  const box=$('slots');box.innerHTML='';
  // visual order left->right on screen: back tower, keep, wall, front tower (enemy comes from right)
  const visual=prog.unl.slot5?[3,4,2,1,0]:[3,2,1,0];box.style.setProperty('--nslots',visual.length);
  for(const i of visual){
    const t=fort.slots[i];
    const b=document.createElement('button');b.className='slot'+(t?' filled':'');
    b.innerHTML=`<i>${SLOT_NAMES[i]}</i><b>${t?DEF[t].name:'ריק'}</b><i>${t?DEF[t].cost+' 🔨 · '+DEF[t].short:'לחץ להצבה'}</i>`;
    b.onclick=()=>{
      const free=pool()-used()+(t?DEF[t].cost:0);
      let idx=DEF_ORDER.indexOf(t);
      for(let n=0;n<4;n++){idx=(idx+1)%DEF_ORDER.length;const nt=DEF_ORDER[idx];if(!nt||DEF[nt].cost<=free){fort.slots[i]=nt;break;}}
      saveBuild();refreshBuild();
    };
    box.appendChild(b);
  }
  const wr=$('wallsRow');wr.innerHTML='';const free=pool()-used();
  partRow(wr,'חומות מחוזקות',WALL_COST,'כל רמה: +25% חוזק לטירה וחומות גבוהות יותר',fort.walls,fort.walls>0,fort.walls<WALL_MAX&&WALL_COST<=free,
    ()=>{fort.walls--;saveBuild();refreshBuild();},()=>{fort.walls++;saveBuild();refreshBuild();});
  const hp=myCastleHP();
  $('fortInfo').textContent=`חוזק הטירה: ${hp} · עלות ההגנות: ${fortCost(fort)} 🔨`;
  drawFortPic();
}
export function drawFortPic(){
  const c=$('fortPic'),x=c.getContext('2d'),dp=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;if(!w)return;
  if(c.width!==Math.round(w*dp)){c.width=Math.round(w*dp);c.height=Math.round(h*dp);}
  x.setTransform(dp,0,0,dp,0,0);x.clearRect(0,0,w,h);
  const hs=castleHeightsFor(fort.walls),cw=Math.min(16,w/14),x0=(w-cw*11)/2,base=h-4,u=Math.min(5.5,(h-14)/9);
  x.strokeStyle=INK;x.lineWidth=1;
  for(let i=0;i<11;i++){x.fillStyle=i>=4&&i<=6?'#c9ad7e':'#d6bd8f';x.fillRect(x0+i*cw,base-hs[i]*u,cw,hs[i]*u);x.strokeRect(x0+i*cw,base-hs[i]*u,cw,hs[i]*u);}
  SLOT_COLS.L.forEach((col,i)=>{if(i===4&&!prog.unl.slot5)return;const t=fort.slots[i];const cx=x0+col*cw+cw/2,cy=base-hs[col]*u-6;
    x.fillStyle=t?'#a3341f':'rgba(107,79,51,.35)';x.beginPath();x.arc(cx,cy,5,0,7);x.fill();x.stroke();});
  x.fillStyle=INK;x.font='bold 12px "Frank Ruhl Libre",serif';x.textAlign='right';x.fillText('← היריב מגיע מכאן',w-2,12);
}
export function renderShop(){
  const box=$('shop');box.innerHTML='';
  const sec=(title,dict)=>{const h=document.createElement('h2');h.textContent=title;h.style.marginTop='10px';box.appendChild(h);
  for(const k in dict){
    const U=dict[k],l=prog.upg[k],mx=upgMax(k),maxed=l>=mx,c=maxed?0:costOf(k);
    const d=document.createElement('div');d.className='upg';
    let pips='';for(let i=0;i<mx;i++)pips+=`<i class="${i<l?'f':''}"></i>`;
    d.innerHTML=`<div class="nm">${U.name}<span class="pips">${pips}</span></div>
      <div class="ds">${l>0?'עכשיו: '+U.eff(l):'עוד לא שודרג'}${maxed?'':'<br>הבא: '+U.eff(l+1)}</div>
      <button class="${!maxed&&prog.coins>=c?'buy':''}" ${maxed||prog.coins<c?'disabled':''}>${maxed?'מקסימום':c+' 🪙'}</button>`;
    d.querySelector('button').onclick=()=>{if(maxed||prog.coins<c)return;prog.coins-=c;prog.upg[k]++;saveProg();refreshBuild();};
    box.appendChild(d);
  }};
  sec('🛠 שדרוגי מכונה',UPG);
  sec('🏰 שדרוגי טירה (דו-קרב)',UPG_CASTLE);
  const ub=$('unlocks');ub.innerHTML='';
  for(const k in UNLOCKS){
    const U=UNLOCKS[k],own=prog.unl[k];
    const d=document.createElement('div');d.className='upg';
    d.innerHTML=`<div class="nm">${U.name}</div><div class="ds">${U.desc}</div>
      <button class="${!own&&prog.coins>=U.cost?'buy':''}" ${own||prog.coins<U.cost?'disabled':''}>${own?'✓ נפתח':U.cost+' 🪙'}</button>`;
    d.querySelector('button').onclick=()=>{if(own||prog.coins<U.cost)return;prog.coins-=U.cost;prog.unl[k]=true;saveProg();refreshBuild();};
    ub.appendChild(d);
  }
}
export let resetArm=0;
export function refreshBuild(){
  sanitize();
  document.body.classList.toggle('duel',gameMode==='duel');
  $('coinTxt').textContent=prog.coins;
  {const r=myRank(),x=prog.xp||0;$('rankTxt').textContent=`דרגה ${r} · ${rankName(r)}`;$('rankBar').style.width=(r>=RANK_MAX?100:clamp((x-xpFor(r))/(xpFor(r+1)-xpFor(r)),0,1)*100)+'%';$('rankTxt').title=r>=RANK_MAX?'דרגה מרבית':`עוד ${xpFor(r+1)-x} ניסיון לדרגה הבאה (+5 🔨)`;}
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===gameMode));
  $('modeDesc').textContent=gameMode==='duel'?'חלק את אותן נקודות הבנייה בין המכונה להגנות הטירה שלך. מי שמפיל ראשון את הטירה של השני, מנצח.':'הפל טירות שמתחזקות בכל ניצחון. כל הנקודות הולכות למכונה.';
  renderStyles();renderParts();renderFort();renderShop();
  $('poolLbl').innerHTML=(gameMode==='duel'?'🔨 נקודות בנייה (מכונה + טירה)':'🔨 נקודות בנייה')+(myRank()>1?`<br><span class="small">כולל ${5*(myRank()-1)} נקודות בונוס מדרגה ${myRank()}</span>`:'');
  $('goldLeft').textContent=`${pool()-used()} / ${pool()}`;
  const show=Object.assign({},build,{style:previewStyle||build.style});const s=stats(show);
  const pct=(el,v)=>$(el).style.width=(clamp(v,0.03,1)*100)+'%';
  pct('sSpeed',s.vmax/460);pct('sStab',1-(s.vstall-40)/200);pct('sAgi',(s.agility-0.6)/2.2);pct('sHp',s.hp/320);pct('sFire',s.fire/700);
  let w='';
  if(s.vmax<s.vstall*1.08)w='⚠ כבדה מדי: המכונה בקושי תחזיק את עצמה באוויר. הוסף כנפיים או בורגי אוויר.';
  else if(s.vmax<s.vstall*1.3)w='⚠ שולי ביטחון נמוכים. טיפוס חד יגרום להזדקרות.';
  $('warn').textContent=w;
  document.querySelectorAll('#diffSeg button').forEach(b=>b.classList.toggle('on',b.dataset.d===difficulty));
  if(gameMode==='duel'){
    $('targetTitle').textContent='היריב';
    const B=BOT[difficulty],wins=prog.duelWins[difficulty];
    $('diffDesc').innerHTML=`<b>בוט ${B.name}</b> · ${B.desc}<br>תקציב היריב: ${botPool(difficulty)} 🔨${wins?` · ניצחת אותו ${wins} פעמים, והוא מתחזק בכל פעם`:''}`;
  }else{
    $('targetTitle').textContent='יעד';
    const sp=castleSpec(),best=prog.best[difficulty];
    $('diffDesc').innerHTML=`<b>טירה רמה ${sp.lvl}</b> · חוזק ${sp.castleHP} · הגנות: ${defsSummary(sp)}${sp.newest?` · <b style="color:var(--red)">חדש: ${DEF[sp.newest].name}!</b>`:''}<br>כל ניצחון מוסיף לטירה גובה, חוזק והגנות.${best?` 🏆 שיא: ${best.toFixed(1)} שנ'`:''}`;
  }
  const lb=$('launchBtn');
  if(previewStyle&&!prog.styles[previewStyle]){lb.disabled=true;lb.textContent='🔒 הסגנון עוד לא נפתח';}
  else{lb.disabled=false;lb.textContent=gameMode==='duel'?'לקרב! ⚔':'שגר! 🏹';}
}
export function drawPreview(t){
  const dp=window.devicePixelRatio||1,w=preview.clientWidth,h=preview.clientHeight;if(!w)return;
  if(preview.width!==Math.round(w*dp)){preview.width=Math.round(w*dp);preview.height=Math.round(h*dp);}
  pctx.setTransform(dp,0,0,dp,0,0);pctx.clearRect(0,0,w,h);
  pctx.strokeStyle='rgba(107,79,51,.25)';pctx.lineWidth=1;
  for(let x=10;x<w;x+=20){pctx.beginPath();pctx.moveTo(x,0);pctx.lineTo(x,h);pctx.stroke();}
  const show=Object.assign({},build,{style:previewStyle||build.style});const s=stats(show);
  pctx.save();const air=show.style==='airship';const sc=Math.min(w/125,h/(air?95:60));
  pctx.translate(w/2+4,h/2+(air?19*sc:2*sc)+Math.sin(t*2)*3);pctx.scale(sc,sc);
  drawMachine(pctx,show,t,s.bombsMax,false);pctx.restore();
  pctx.fillStyle='rgba(59,42,26,.75)';pctx.font='italic 12px "Frank Ruhl Libre",serif';pctx.textAlign='left';
  pctx.fillText(`משקל ${s.m.toFixed(0)} · מהירות ${s.vmax.toFixed(0)} · הזדקרות ב-${s.vstall.toFixed(0)} · עמידות ${s.hp} · פצצות ${s.bombsMax}`,6,h-7);
}
export function initBuildUI(){
$('resetBtn').onclick=()=>{
  if(Date.now()-resetArm<3000){setProg(freshProg());saveProg();setBuild(defaultBuild());setFort(defaultFort());sanitize();saveBuild();$('resetBtn').textContent='איפוס התקדמות';refreshBuild();}
  else{resetArm=Date.now();$('resetBtn').textContent='בטוח? לחץ שוב לאיפוס';setTimeout(()=>$('resetBtn').textContent='איפוס התקדמות',3000);}
};
document.querySelectorAll('#diffSeg button').forEach(b=>b.onclick=()=>{setDifficulty(b.dataset.d);store.set('skysiege_diff',difficulty);refreshBuild();});
document.querySelectorAll('#modeSeg button').forEach(b=>b.onclick=()=>{setGameMode(b.dataset.m);store.set('skysiege_mode',gameMode);refreshBuild();});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $('tabMachine').classList.toggle('hidden',b.dataset.tab!=='machine');$('tabShop').classList.toggle('hidden',b.dataset.tab!=='shop');
  previewStyle=null;refreshBuild();
});
$('controlsTxt').textContent=isTouch?'שליטה: ▲▼ גובה · ⟲ סיבוב לאחור · 💣 פצצה · 🏹 קשת':'שליטה: ↑↓ גובה · ←→ סיבוב · רווח פצצה · X קשת · Esc עצירה';
}
