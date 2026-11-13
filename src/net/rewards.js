// 1v1 rewards and records (stage 5). Pure functions: no DOM, no network, no game state.
//
// Coins and XP are worked out like a duel against the bot (damage, defenses, machines downed,
// victory, the castle kept), with a fixed ×1.5 (a medium bot, never growing). Then:
//  - no reward at all for a battle shorter than 45 s, or one where a side never dropped a bomb;
//  - against the same friend on the same day: full reward for 3 battles, half for 3, then none;
//  - at most 1500 coins a day from all friends together (XP still comes after that).
// The record against each friend (wins, losses, draws, streak) is kept for every battle.
// Everything is worked out on the player's device: on the Spark plan nothing can check it.

export const VS_MULT=1.5,DAILY_CAP=1500,MIN_SECS=45,FULL_GAMES=3,HALF_GAMES=3,MAX_FRIENDS=200;

// the player's own calendar day (YYYY-MM-DD)
export function dayKey(d=new Date()){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

// result: 'won' | 'lost' | 'draw' | 'techWon' | 'techLost' | 'left'
export const outcomeOf=result=>result==='won'||result==='techWon'?'w':result==='lost'||result==='techLost'?'l':result==='draw'?'d':null;

// the reward lines of one battle, before limits. m: {result, dmgPct, keptPct, defs, downs}
export function battleLines(m){
  const o=outcomeOf(m.result),lines=[];
  lines.push({key:'res.dmgFoe',vars:{pct:m.dmgPct},coins:Math.round(m.dmgPct*0.8)});
  if(m.defs)lines.push({key:'res.defs',vars:{n:m.defs},coins:15*m.defs});
  if(m.downs)lines.push({key:'vs.res.downs',vars:{n:m.downs},coins:25*m.downs});
  if(o==='w'){
    lines.push({key:'res.victory',vars:{},coins:100});
    if(m.keptPct)lines.push({key:'res.kept',vars:{pct:m.keptPct},coins:Math.round(m.keptPct*0.4)});
  }else if(o==='d')lines.push({key:'vs.res.drawBonus',vars:{},coins:50});
  const sub=lines.reduce((a,l)=>a+l.coins,0);
  const xp=Math.round(20+m.dmgPct*0.5+(o==='w'?40:o==='d'?20:0)+5*(m.defs||0)+8*(m.downs||0));
  return {lines,sub,coins:Math.round(sub*VS_MULT),xp};
}

// m: {result, secs, myBombs, oppBombs, dmgPct, keptPct, defs, downs}
// day: {d, c, f} from prog.vsDay (may be missing); friend: the opponent's uid; today: dayKey()
// -> {lines, base, coins, xp, factor: 1 | 0.5 | 0, reason, game, capLeft, day}
export function vsReward(m,day,friend,today){
  const b=battleLines(m),o=outcomeOf(m.result);
  const d=day&&day.d===today?day:{d:today,c:0,f:{}};
  const game=((d.f&&d.f[friend])||0)+1;                       // which battle against this friend today
  let factor=game<=FULL_GAMES?1:game<=FULL_GAMES+HALF_GAMES?0.5:0;
  let reason=factor===1?null:factor===0.5?'half':'limit';
  if(!o){factor=0;reason='none';}
  else if(m.secs<MIN_SECS){factor=0;reason='short';}
  else if(!m.myBombs||!m.oppBombs){factor=0;reason='noBombs';}
  const valid=reason!=='short'&&reason!=='noBombs'&&reason!=='none';
  let coins=Math.round(b.coins*factor);
  const capLeft=Math.max(0,DAILY_CAP-(d.c||0));
  if(coins>capLeft){coins=capLeft;if(factor>0)reason='cap';}
  const xp=Math.round(b.xp*factor);
  // the day's counters: only a real battle counts against the friend's 3+3
  const next={d:today,c:(d.c||0)+coins,f:Object.assign({},d.f)};
  if(valid)next.f[friend]=game;
  return {lines:b.lines,base:b.coins,coins,xp,factor,reason,game,capLeft:Math.max(0,capLeft-coins),day:next};
}

// the record against one friend: {n: name, w, l, d, s: streak (+wins / -losses), b: best win streak, t: when}
export function addToRecord(rec,result,name,now){
  const r=Object.assign({n:'',w:0,l:0,d:0,s:0,b:0,t:0},rec||{});
  const o=outcomeOf(result);
  if(name)r.n=String(name).slice(0,16);
  r.t=now;
  if(o==='w'){r.w++;r.s=r.s>0?r.s+1:1;r.b=Math.max(r.b,r.s);}
  else if(o==='l'){r.l++;r.s=r.s<0?r.s-1:-1;}
  else if(o==='d'){r.d++;r.s=0;}
  return r;
}

// ---- merging two devices' copies (used by sync/merge.js)
const num=v=>(typeof v==='number'&&isFinite(v)?v:0);
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
// per friend: counters and the best streak take the max; the name and the current streak come
// from the copy that played last
export function mergeRecords(a,b){
  a=isObj(a)?a:{};b=isObj(b)?b:{};
  const out={};
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
    const x=isObj(a[k])?a[k]:null,y=isObj(b[k])?b[k]:null;
    if(!x||!y){out[k]=Object.assign({},x||y);continue;}
    const last=num(x.t)>=num(y.t)?x:y;
    out[k]={n:typeof last.n==='string'?last.n:'',w:Math.max(num(x.w),num(y.w)),l:Math.max(num(x.l),num(y.l)),d:Math.max(num(x.d),num(y.d)),
      s:num(last.s),b:Math.max(num(x.b),num(y.b)),t:Math.max(num(x.t),num(y.t))};
  }
  // keep the most recent friends if over the limit
  const ids=Object.keys(out);
  if(ids.length>MAX_FRIENDS)for(const k of ids.sort((p,q)=>num(out[q].t)-num(out[p].t)).slice(MAX_FRIENDS))delete out[k];
  return out;
}
// the day's counters: the later day wins; on the same day every counter takes the max
export function mergeDay(a,b){
  a=isObj(a)&&typeof a.d==='string'?a:null;b=isObj(b)&&typeof b.d==='string'?b:null;
  if(!a||!b)return a||b?Object.assign({},a||b):undefined;
  if(a.d!==b.d)return Object.assign({},a.d>b.d?a:b);
  const f={};for(const k of new Set([...Object.keys(a.f||{}),...Object.keys(b.f||{})]))f[k]=Math.max(num((a.f||{})[k]),num((b.f||{})[k]));
  return {d:a.d,c:Math.max(num(a.c),num(b.c)),f};
}
