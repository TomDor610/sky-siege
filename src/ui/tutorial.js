// First-battle tutorial: Hebrew speech bubbles that react to what the player does
// (climb, descend, flip, bomb, rearm), with a skip button.
//
// Shown once: completing, skipping or finishing the first battle stores
// 'skysiege_tutorial' in localStorage. Players who already have progress never
// see it. The tutorial only READS game state and never calls Math.random, so it
// cannot change the simulation (the baseline tests run with it active).
import {G,prog} from '../state.js';
import {isTouch} from '../input.js';
import {$,store} from '../util.js';

const KEY='skysiege_tutorial';
const ORDER=['climb','descend','flip','bomb','rearm'];
const HOLD=0.35;     // seconds of holding ▲/▼ that count as "did it"
const LINGER=3;      // seconds the praise / final bubble stays up
const BTN={climb:'up',descend:'down',flip:'flip',bomb:'bomb'};

let T=null;          // active tutorial, or null
let lastSeen=[],lastDid=[]; // bubbles shown / actions recognized in the most recent tutorial (for tests)
let shown;           // cache of what is on screen

function isFreshPlayer(){
  return !(prog.xp>0)&&!Object.values(prog.wins).some(Boolean)&&!Object.values(prog.duelWins).some(Boolean);
}

function text(k){
  const duel=G.duel;
  switch(k){
    case 'climb':return isTouch?'החזק ▲ כדי לטפס':'החזק ↑ כדי לטפס';
    case 'descend':return isTouch?'עכשיו החזק ▼ כדי לרדת':'עכשיו החזק ↓ כדי לרדת';
    case 'flip':return isTouch?'לחץ ⟲ כדי להסתובב לאחור':'לחץ ← כדי להסתובב לאחור (ו-→ כדי לחזור)';
    case 'bomb':return `טוס אל ${duel?'טירת היריב':'הטירה'} (החץ האדום מראה לאן) ולחץ ${isTouch?'💣':'רווח'} כשאתה מעליה`;
    case 'praise':return 'יפה! המשך להפציץ עד שהפצצות ייגמרו';
    case 'rearm':return duel?'נגמרו הפצצות! חזור אל מעל הטירה שלך, לתוך המסגרת הירוקה, כדי לחמש':'נגמרו הפצצות! חזור אל מעל מגדל הבית, לתוך המסגרת הירוקה, כדי לחמש';
    case 'done':return 'מעולה, אתה מוכן! עכשיו הפל את הטירה 🏰';
  }
  return '';
}

function render(view){
  if(view===shown)return;shown=view;
  document.querySelectorAll('.tbtn.tut').forEach(b=>b.classList.remove('tut'));
  const box=$('tut');
  if(!view){box.classList.add('hidden');return;}
  if(T&&!T.seen.includes(view))T.seen.push(view);
  const i=ORDER.indexOf(view);
  $('tutStep').textContent=i>=0?`הדרכה ${i+1}/${ORDER.length}`:'הדרכה';
  $('tutTxt').textContent=text(view);
  box.classList.remove('hidden');
  if(BTN[view]){const b=document.querySelector(`.tbtn[data-k="${BTN[view]}"]`);if(b)b.classList.add('tut');}
}

function stop(value){
  if(T){store.set(KEY,value);lastSeen=T.seen.slice();lastDid=ORDER.filter(k=>T.flags[k]);}
  T=null;render(null);
}

// Called at the start of every battle.
export function tutorialBegin(){
  T=null;render(null);
  if(store.get(KEY)||!isFreshPlayer()||!G)return;
  const me=G.me;
  T={seen:[],flags:{},up:0,down:0,prevBombs:me.bombs,prevDead:me.dead,praiseT:0,doneT:0};
  $('tip').classList.add('hidden'); // the bubble replaces the generic start tip
  tick(0);
}

// Called after every simulation step (game loop and window.__sky.step).
export function tutorialTick(dt){if(T&&G)tick(dt);}

function tick(dt){
  const me=G.me,f=T.flags;
  if(!me.dead){
    if(me.inp.up)T.up+=dt;
    if(me.inp.down)T.down+=dt;
    if(T.up>=HOLD)f.climb=true;
    if(T.down>=HOLD)f.descend=true;
    if(me.flip>0)f.flip=true;
    if(me.bombs<T.prevBombs)f.bomb=true;
    if(!T.prevDead&&me.bombs>T.prevBombs)f.rearm=true; // refill in the rearm zone, not a respawn
  }
  T.prevBombs=me.bombs;T.prevDead=me.dead;

  const cur=ORDER.find(k=>!f[k]);
  let view;
  if(!cur){T.doneT+=dt;if(T.doneT>=LINGER){stop('done');return;}view='done';}
  else if(cur==='rearm'&&me.bombs>0){T.praiseT+=dt;view=T.praiseT<LINGER?'praise':null;}
  else view=cur;
  if(me.dead||G.state!=='play')view=null;
  render(view);
}

// Battle over (result screen) or back to the workshop: the tutorial counts as seen.
export function tutorialEnd(){stop('done');}

export function tutorialInfo(){
  return {active:!!T,step:T?(ORDER.find(k=>!T.flags[k])||'done'):null,seen:T?T.seen.slice():lastSeen.slice(),did:T?ORDER.filter(k=>T.flags[k]):lastDid.slice(),stored:store.get(KEY)};
}

export function initTutorial(){
  $('tutSkip').onclick=e=>{e.currentTarget.blur();stop('skipped');};
}
