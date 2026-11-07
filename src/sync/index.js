// Cloud save, offline-first.
//
// localStorage stays the source of truth: the game loads from it instantly and works
// with no network. In the background we sign in (anonymously, or with Google) and keep
// users/{uid} in Firestore in step with the local save:
//   every sync = read the cloud copy -> mergeSave() -> apply locally -> write back.
// Reading before every write means two devices never overwrite each other's progress.
// Failed syncs (offline) are retried when the browser comes back online.
//
// The backend is pluggable: src/sync/firebase.js in production, or a fake injected by
// the tests as window.__skyCloudBackend. With no config (or under automation without a
// fake) sync is off and the game behaves exactly as before.
// Never touches the simulation and never calls Math.random.
import {firebaseConfig} from './config.js';
import {mergeSave,normalizeProg,sameSave} from './merge.js';
import {freshProg,onSaved,sanitize,saveBuild,saveProg} from '../progress.js';
import {build,fort,prog,setBuild,setFort,setProg} from '../state.js';
import {store} from '../util.js';

const META='skysiege_sync';          // {buildAt, dirty} — device-local bookkeeping
const DEBOUNCE=2000;
let meta={buildAt:0,dirty:false};
try{const m=JSON.parse(store.get(META)||'null');if(m&&typeof m==='object')meta=Object.assign(meta,m);}catch(e){}
const saveMeta=()=>store.set(META,JSON.stringify(meta));

let backend=null,user=null,status='off',busy=false,again=false,timer=null,muted=false,pending=null,syncs=0;
let hooks={canApply:()=>true,onApplied:()=>{}};
const listeners=[];
const setStatus=s=>{if(status!==s){status=s;listeners.forEach(f=>f(info()));}};
export const onSyncChange=f=>listeners.push(f);
export function info(){return {status,uid:user&&user.uid,isAnonymous:user?user.isAnonymous:null,name:user&&user.name||'',dirty:meta.dirty,syncs};}

function currentSave(){return {prog,build,fort,buildAt:meta.buildAt||0};}

// Put a merged save into the game (only when no battle is running).
function apply(m){
  muted=true;
  try{
    const p=Object.assign(freshProg(),m.prog);
    for(const k of ['upg','wins','duelWins','unl'])p[k]=Object.assign(freshProg()[k],m.prog[k]);
    p.styles=Object.assign({classic:true},m.prog.styles);
    setProg(p);
    setBuild(Object.assign({},build,m.build));
    const sl=(m.fort.slots||[]).slice(0,5);while(sl.length<5)sl.push(null);
    setFort({slots:sl,walls:+m.fort.walls||0});
    sanitize();saveProg();saveBuild();
    meta.buildAt=m.buildAt||meta.buildAt;saveMeta();
  }finally{muted=false;}
  hooks.onApplied();
}

async function syncOnce(){
  if(!user)user=await backend.ensureUser();
  setStatus('syncing');
  const remote=await backend.load(user.uid);
  const local=currentSave();
  const merged=mergeSave(local,remote);
  const localView={prog:normalizeProg(local.prog),build:local.build,fort:local.fort,buildAt:local.buildAt};
  if(!sameSave(merged,localView)){
    if(hooks.canApply())apply(merged);else pending=merged;
  }
  const remoteView=remote&&{prog:remote.prog,build:remote.build,fort:remote.fort,buildAt:remote.buildAt||0};
  if(!sameSave(merged,remoteView))await backend.save(user.uid,{v:1,prog:merged.prog,build:merged.build,fort:merged.fort,buildAt:merged.buildAt});
  meta.dirty=false;saveMeta();syncs++;
  setStatus('saved');
}

// Serialized: a sync requested while one is running runs once more afterwards.
export async function syncNow(){
  if(!backend)return;
  if(busy){again=true;return;}
  busy=true;
  try{
    do{again=false;await syncOnce();}while(again);
  }catch(e){
    meta.dirty=true;saveMeta();
    setStatus(typeof navigator!=='undefined'&&navigator.onLine===false||/offline|network|unavailable|failed to fetch/i.test(String(e&&(e.code||e.message)))?'offline':'error');
  }finally{busy=false;}
}

function schedule(){
  if(!backend)return;
  clearTimeout(timer);timer=setTimeout(syncNow,DEBOUNCE);
}

// A merge that arrived during a battle is applied once back in the menus.
export function syncResume(){
  if(pending&&hooks.canApply()){const m=pending;pending=null;
    // progress may have grown meanwhile: merge again so nothing earned in that battle is lost
    apply(mergeSave(currentSave(),m));schedule();}
}

// "Save progress to your Google account": links the anonymous account (same uid, nothing
// moves). If that Google account already has a save from another device, the backend signs
// into it instead and the sync below merges both progressions (always the higher values).
const CANCELLED=/popup-closed-by-user|cancelled-popup-request|user-cancelled/;
export async function signInGoogle(){
  if(!backend)return;
  const before=status;
  try{setStatus('syncing');user=await backend.signInGoogle();await syncNow();}
  catch(e){
    if(CANCELLED.test(String(e&&e.code))){setStatus(before);return;} // closed the window: no harm done
    setStatus('error');throw e;
  }
}
export async function signOutCloud(){
  if(!backend)return;
  await backend.signOut();user=null;
  await syncNow(); // continue anonymously; local progress stays on this device
}

export async function initSync(h){
  hooks=Object.assign(hooks,h);
  onSaved(what=>{
    if(muted)return;
    if(what==='build'){meta.buildAt=Date.now();}
    meta.dirty=true;saveMeta();schedule();
  });
  try{
    if(window.__skyCloudBackend)backend=window.__skyCloudBackend;
    else if(firebaseConfig&&!navigator.webdriver){const {createBackend}=await import('./firebase.js');backend=createBackend(firebaseConfig);}
  }catch(e){backend=null;}
  if(!backend){setStatus('off');return;}
  setStatus('syncing');
  addEventListener('online',()=>syncNow());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&meta.dirty)syncNow();});
  try{user=await backend.ready();}catch(e){user=null;}
  await syncNow();
}
