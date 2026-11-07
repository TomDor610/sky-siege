// Progression, budget and localStorage persistence (keys must stay backward compatible).
import {ALLUPG,BOMBTYPE,DEF,DIFF,DUEL_CASTLE_HP,DUEL_EXTRA,PARTS,RANKS,RANK_MAX,STYLES,UPG_MAX,WALL_COST,WALL_MAX} from './data.js';
import {build,fort,gameMode,prog,setBuild,setDifficulty,setFort,setGameMode,setProg} from './state.js';
import {t} from './i18n/index.js';
import {clamp,store} from './util.js';
export const xpFor=r=>30*(r-1)*r;
export function rankOf(xp){let r=1;while(r<RANK_MAX&&xp>=xpFor(r+1))r++;return r;}
export function rankName(r){let n=RANKS[0][1];for(const [m,id] of RANKS)if(r>=m)n=id;return t('rank.'+n);}
export const upgMax=k=>ALLUPG[k].max||UPG_MAX;
export function freshProg(){return {coins:120,upg:{frame:0,wings:0,props:0,armor:0,weapons:0,workshop:0,stone:0,ballista:0,archers:0,mangonel:0},xp:0,styles:{classic:true},unl:{crossbow:false,greek:false,slot5:false},wins:{easy:0,medium:0,hard:0},duelWins:{easy:0,medium:0,hard:0},best:{}}}
export function defaultBuild(){return {style:'classic',wings:2,props:2,armor:1,bombs:4,crossbows:0,bombType:'stone'};}
export function defaultFort(){return {slots:['ballista',null,'archers',null,null],walls:0};}
export function loadSaved(){
setProg(freshProg());
try{const p=JSON.parse(store.get('skysiege_prog')||'null');if(p&&p.upg){const f=freshProg();setProg(Object.assign(f,p));prog.upg=Object.assign(freshProg().upg,p.upg);prog.wins=Object.assign(freshProg().wins,p.wins);prog.duelWins=Object.assign(freshProg().duelWins,p.duelWins);prog.unl=Object.assign(freshProg().unl,p.unl);prog.styles=Object.assign({classic:true},p.styles);}}catch(e){}
setGameMode('duel');setBuild(defaultBuild());setFort(defaultFort());setDifficulty('medium');
try{const s=JSON.parse(store.get('skysiege_build2')||'null');if(s&&s.wings)setBuild(Object.assign(build,s));
  const f=JSON.parse(store.get('skysiege_fort')||'null');if(f&&f.slots){const sl=f.slots.slice(0,5);while(sl.length<5)sl.push(null);setFort({slots:sl,walls:+f.walls||0});}
  const d=store.get('skysiege_diff');if(d&&DIFF[d])setDifficulty(d);const m=store.get('skysiege_mode');if(m==='duel'||m==='campaign')setGameMode(m);}catch(e){}
}
export function saveProg(){store.set('skysiege_prog',JSON.stringify(prog));}
export function costOf(k){return Math.round(ALLUPG[k].base*Math.pow(prog.upg[k]+1,1.6)/5)*5}
export const myRank=()=>rankOf(prog.xp||0);
export function budget(){return 100+10*prog.upg.workshop+5*(myRank()-1)}
export function partCost(k,b){return k==='bombs'?BOMBTYPE[b.bombType].cost:PARTS[k].cost}
export function spent(b){let s=0;for(const k in PARTS)s+=(b[k]||0)*partCost(k,b);return s}
export function myCastleHP(){return Math.round(DUEL_CASTLE_HP*(1+0.25*fort.walls)*(1+0.1*prog.upg.stone));}
export function fortCost(f){return f.slots.reduce((a,t)=>a+(t?DEF[t].cost:0),0)+f.walls*WALL_COST}
export function pool(){return budget()+(gameMode==='duel'?DUEL_EXTRA:0)}
export function used(){return spent(build)+(gameMode==='duel'?fortCost(fort):0)}
export function sanitize(){
  for(const k in PARTS)build[k]=clamp(+build[k]||0,PARTS[k].min,PARTS[k].max);
  if(!prog.unl.crossbow)build.crossbows=0;
  if(!BOMBTYPE[build.bombType]||(build.bombType==='greek'&&!prog.unl.greek))build.bombType='stone';
  if(!STYLES[build.style]||!prog.styles[build.style])build.style='classic';
  for(let i=0;i<5;i++)if(fort.slots[i]&&!DEF[fort.slots[i]])fort.slots[i]=null;
  if(!prog.unl.slot5)fort.slots[4]=null;
  fort.walls=clamp(fort.walls,0,WALL_MAX);
  let guard=0;
  while(used()>pool()&&guard++<80){
    if(gameMode==='duel'&&fort.walls>0){fort.walls--;continue;}
    if(gameMode==='duel'){let j=-1;for(let i=4;i>=0;i--)if(fort.slots[i]){j=i;break;}if(j>=0){fort.slots[j]=null;continue;}}
    let done=false;for(const k of ['bombs','armor','crossbows','props','wings'])if(build[k]>PARTS[k].min){build[k]--;done=true;break;}
    if(!done)break;
  }
}
export function saveBuild(){store.set('skysiege_build2',JSON.stringify(build));store.set('skysiege_fort',JSON.stringify(fort));}
