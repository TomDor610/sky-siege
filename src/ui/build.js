// Workshop screen: styles, parts, fort slots, shop, difficulty.
import {botPool} from '../bot.js';
import {castleHeightsFor,castleSpec,defsSummary} from '../castle.js';
import {BOT,DEF,DEF_ORDER,INK,PARTS,RANK_MAX,SLOT_COLS,STYLES,UNLOCKS,UPG,UPG_CASTLE,WALL_COST,WALL_MAX} from '../data.js';
import {drawMachine} from '../draw/machine.js';
import {t} from '../i18n/index.js';
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
    b.innerHTML=`<b>${t(`style.${k}.name`)}</b><i>${own?t(`style.${k}.tag`):t('style.lockedTag',{cost:S.cost})}</i>`;
    b.onclick=()=>{if(own){build.style=k;previewStyle=null;saveBuild();}else previewStyle=k;refreshBuild();};
    box.appendChild(b);
  }
  const S=STYLES[cur];$('styDesc').textContent=t(`style.${cur}.desc`);
  const ub=$('unlockStyle');
  if(previewStyle&&!prog.styles[previewStyle]){
    ub.classList.remove('hidden');ub.disabled=prog.coins<S.cost;
    ub.textContent=prog.coins>=S.cost?t('style.unlock',{name:t(`style.${cur}.name`),cost:S.cost}):t('style.need',{cost:S.cost,missing:S.cost-prog.coins});
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
    partRow(box,k==='bombs'?t(`bomb.${build.bombType}.plural`):t(`part.${k}.name`),c,t(`part.${k}.desc`),build[k],build[k]>p.min,build[k]<p.max&&c<=free,
      ()=>{build[k]--;saveBuild();refreshBuild();},()=>{build[k]++;saveBuild();refreshBuild();});
  }
  $('bombSeg').querySelectorAll('button').forEach(b=>{
    const bt=b.dataset.b,locked=bt==='greek'&&!prog.unl.greek;
    b.classList.toggle('on',build.bombType===bt);b.disabled=locked;b.textContent=t(`bomb.${bt}.name`)+(locked?' 🔒':'');
    b.onclick=()=>{build.bombType=bt;sanitize();saveBuild();refreshBuild();};
  });
}
export function renderFort(){
  $('fortBox').classList.toggle('hidden',gameMode!=='duel');
  if(gameMode!=='duel')return;
  const box=$('slots');box.innerHTML='';
  // visual order left->right on screen: back tower, keep, wall, front tower (enemy comes from right)
  const visual=prog.unl.slot5?[3,4,2,1,0]:[3,2,1,0];box.style.setProperty('--nslots',visual.length);
  for(const i of visual){
    const d=fort.slots[i];
    const b=document.createElement('button');b.className='slot'+(d?' filled':'');
    b.innerHTML=`<i>${t('slot.'+i)}</i><b>${d?t(`def.${d}.name`):t('slot.empty')}</b><i>${d?DEF[d].cost+' 🔨 · '+t(`def.${d}.short`):t('slot.place')}</i>`;
    b.onclick=()=>{
      const free=pool()-used()+(d?DEF[d].cost:0);
      let idx=DEF_ORDER.indexOf(d);
      for(let n=0;n<4;n++){idx=(idx+1)%DEF_ORDER.length;const nt=DEF_ORDER[idx];if(!nt||DEF[nt].cost<=free){fort.slots[i]=nt;break;}}
      saveBuild();refreshBuild();
    };
    box.appendChild(b);
  }
  const wr=$('wallsRow');wr.innerHTML='';const free=pool()-used();
  partRow(wr,t('walls.name'),WALL_COST,t('walls.desc'),fort.walls,fort.walls>0,fort.walls<WALL_MAX&&WALL_COST<=free,
    ()=>{fort.walls--;saveBuild();refreshBuild();},()=>{fort.walls++;saveBuild();refreshBuild();});
  const hp=myCastleHP();
  $('fortInfo').textContent=t('fort.info',{hp,cost:fortCost(fort)});
  drawFortPic();
}
export function drawFortPic(){
  const c=$('fortPic'),x=c.getContext('2d'),dp=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;if(!w)return;
  if(c.width!==Math.round(w*dp)){c.width=Math.round(w*dp);c.height=Math.round(h*dp);}
  x.setTransform(dp,0,0,dp,0,0);x.clearRect(0,0,w,h);
  const hs=castleHeightsFor(fort.walls),cw=Math.min(16,w/14),x0=(w-cw*11)/2,base=h-4,u=Math.min(5.5,(h-14)/9);
  x.strokeStyle=INK;x.lineWidth=1;
  for(let i=0;i<11;i++){x.fillStyle=i>=4&&i<=6?'#c9ad7e':'#d6bd8f';x.fillRect(x0+i*cw,base-hs[i]*u,cw,hs[i]*u);x.strokeRect(x0+i*cw,base-hs[i]*u,cw,hs[i]*u);}
  SLOT_COLS.L.forEach((col,i)=>{if(i===4&&!prog.unl.slot5)return;const d=fort.slots[i];const cx=x0+col*cw+cw/2,cy=base-hs[col]*u-6;
    x.fillStyle=d?'#a3341f':'rgba(107,79,51,.35)';x.beginPath();x.arc(cx,cy,5,0,7);x.fill();x.stroke();});
  // the enemy always comes from the right (the world does not mirror with the language)
  x.fillStyle=INK;x.font='bold 12px "Frank Ruhl Libre",serif';x.textAlign='right';x.fillText(t('fort.enemyFrom'),w-2,12);
}
export function renderShop(){
  const box=$('shop');box.innerHTML='';
  const sec=(title,dict)=>{const h=document.createElement('h2');h.textContent=title;h.style.marginTop='10px';box.appendChild(h);
  for(const k in dict){
    const U=dict[k],l=prog.upg[k],mx=upgMax(k),maxed=l>=mx,c=maxed?0:costOf(k);
    const eff=lv=>t(`upg.${k}.eff`,U.eff(lv));
    const d=document.createElement('div');d.className='upg';
    let pips='';for(let i=0;i<mx;i++)pips+=`<i class="${i<l?'f':''}"></i>`;
    d.innerHTML=`<div class="nm">${t(`upg.${k}.name`)}<span class="pips">${pips}</span></div>
      <div class="ds">${l>0?t('upg.now',{eff:eff(l)}):t('upg.notYet')}${maxed?'':'<br>'+t('upg.next',{eff:eff(l+1)})}</div>
      <button class="${!maxed&&prog.coins>=c?'buy':''}" ${maxed||prog.coins<c?'disabled':''}>${maxed?t('upg.max'):c+' 🪙'}</button>`;
    d.querySelector('button').onclick=()=>{if(maxed||prog.coins<c)return;prog.coins-=c;prog.upg[k]++;saveProg();refreshBuild();};
    box.appendChild(d);
  }};
  sec(t('shop.machineTitle'),UPG);
  sec(t('shop.castleTitle'),UPG_CASTLE);
  const ub=$('unlocks');ub.innerHTML='';
  for(const k in UNLOCKS){
    const U=UNLOCKS[k],own=prog.unl[k];
    const d=document.createElement('div');d.className='upg';
    d.innerHTML=`<div class="nm">${t(`unlock.${k}.name`)}</div><div class="ds">${t(`unlock.${k}.desc`)}</div>
      <button class="${!own&&prog.coins>=U.cost?'buy':''}" ${own||prog.coins<U.cost?'disabled':''}>${own?t('unlock.owned'):U.cost+' 🪙'}</button>`;
    d.querySelector('button').onclick=()=>{if(own||prog.coins<U.cost)return;prog.coins-=U.cost;prog.unl[k]=true;saveProg();refreshBuild();};
    ub.appendChild(d);
  }
}
export let resetArm=0;
export function refreshBuild(){
  sanitize();
  document.body.classList.toggle('duel',gameMode==='duel');
  $('coinTxt').textContent=prog.coins;
  {const r=myRank(),x=prog.xp||0;$('rankTxt').textContent=t('rank.label',{r,name:rankName(r)});$('rankBar').style.width=(r>=RANK_MAX?100:clamp((x-xpFor(r))/(xpFor(r+1)-xpFor(r)),0,1)*100)+'%';$('rankTxt').title=r>=RANK_MAX?t('rank.max'):t('rank.next',{xp:xpFor(r+1)-x});}
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===gameMode));
  $('modeDesc').textContent=gameMode==='duel'?t('mode.duelDesc'):t('mode.campaignDesc');
  renderStyles();renderParts();renderFort();renderShop();
  $('poolLbl').innerHTML=(gameMode==='duel'?t('pool.duel'):t('pool.campaign'))+(myRank()>1?`<br><span class="small">${t('pool.bonus',{pts:5*(myRank()-1),r:myRank()})}</span>`:'');
  $('goldLeft').textContent=`${pool()-used()} / ${pool()}`;
  const show=Object.assign({},build,{style:previewStyle||build.style});const s=stats(show);
  const pct=(el,v)=>$(el).style.width=(clamp(v,0.03,1)*100)+'%';
  pct('sSpeed',s.vmax/460);pct('sStab',1-(s.vstall-40)/200);pct('sAgi',(s.agility-0.6)/2.2);pct('sHp',s.hp/320);pct('sFire',s.fire/700);
  let w='';
  if(s.vmax<s.vstall*1.08)w=t('warn.heavy');
  else if(s.vmax<s.vstall*1.3)w=t('warn.margin');
  $('warn').textContent=w;
  document.querySelectorAll('#diffSeg button').forEach(b=>b.classList.toggle('on',b.dataset.d===difficulty));
  if(gameMode==='duel'){
    $('targetTitle').textContent=t('build.opponent');
    const wins=prog.duelWins[difficulty];
    $('diffDesc').innerHTML=`<b>${t('bot.title',{d:t(`diff.${difficulty}.name`)})}</b> · ${t(`bot.${difficulty}.desc`)}<br>${t('bot.budget',{pts:botPool(difficulty)})}${wins?t('bot.wins',{n:wins}):''}`;
  }else{
    $('targetTitle').textContent=t('build.target');
    const sp=castleSpec(),best=prog.best[difficulty];
    $('diffDesc').innerHTML=`<b>${t('castle.level',{lvl:sp.lvl})}</b> · ${t('castle.strength',{hp:sp.castleHP})} · ${t('castle.defs',{list:defsSummary(sp)})}${sp.newest?` · <b style="color:var(--red)">${t('castle.new',{name:t(`def.${sp.newest}.name`)})}</b>`:''}<br>${t('castle.grows')}${best?' '+t('castle.best',{s:best.toFixed(1)}):''}`;
  }
  const lb=$('launchBtn');
  if(previewStyle&&!prog.styles[previewStyle]){lb.disabled=true;lb.textContent=t('launch.locked');}
  else{lb.disabled=false;lb.textContent=gameMode==='duel'?t('launch.duel'):t('launch.siege');}
}
export function drawPreview(time){
  const dp=window.devicePixelRatio||1,w=preview.clientWidth,h=preview.clientHeight;if(!w)return;
  if(preview.width!==Math.round(w*dp)){preview.width=Math.round(w*dp);preview.height=Math.round(h*dp);}
  pctx.setTransform(dp,0,0,dp,0,0);pctx.clearRect(0,0,w,h);
  pctx.strokeStyle='rgba(107,79,51,.25)';pctx.lineWidth=1;
  for(let x=10;x<w;x+=20){pctx.beginPath();pctx.moveTo(x,0);pctx.lineTo(x,h);pctx.stroke();}
  const show=Object.assign({},build,{style:previewStyle||build.style});const s=stats(show);
  pctx.save();const air=show.style==='airship';const sc=Math.min(w/125,h/(air?95:60));
  pctx.translate(w/2+4,h/2+(air?19*sc:2*sc)+Math.sin(time*2)*3);pctx.scale(sc,sc);
  drawMachine(pctx,show,time,s.bombsMax,false);pctx.restore();
  pctx.fillStyle='rgba(59,42,26,.75)';pctx.font='italic 12px "Frank Ruhl Libre",serif';pctx.textAlign='left';
  pctx.fillText(t('preview.stats',{m:s.m.toFixed(0),v:s.vmax.toFixed(0),st:s.vstall.toFixed(0),hp:s.hp,b:s.bombsMax}),6,h-7);
}
export function renderControls(){$('controlsTxt').textContent=isTouch?t('controls.touch'):t('controls.keys');}
export function initBuildUI(){
$('resetBtn').onclick=()=>{
  if(Date.now()-resetArm<3000){setProg(freshProg());saveProg();setBuild(defaultBuild());setFort(defaultFort());sanitize();saveBuild();$('resetBtn').textContent=t('reset.btn');refreshBuild();}
  else{resetArm=Date.now();$('resetBtn').textContent=t('reset.confirm');setTimeout(()=>$('resetBtn').textContent=t('reset.btn'),3000);}
};
document.querySelectorAll('#diffSeg button').forEach(b=>b.onclick=()=>{setDifficulty(b.dataset.d);store.set('skysiege_diff',difficulty);refreshBuild();});
document.querySelectorAll('#modeSeg button').forEach(b=>b.onclick=()=>{setGameMode(b.dataset.m);store.set('skysiege_mode',gameMode);refreshBuild();});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $('tabMachine').classList.toggle('hidden',b.dataset.tab!=='machine');$('tabShop').classList.toggle('hidden',b.dataset.tab!=='shop');
  previewStyle=null;refreshBuild();
});
renderControls();
}
