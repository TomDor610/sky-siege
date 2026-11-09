// Leaderboard: publishes this player's row and loads the Friends / Everyone lists.
//
// - Opt-in: a row is published only after the player picks a nickname (prog.nick).
// - The row is rebuilt from progress after every successful cloud sync and written only
//   when something in it changed, at most once per 25 s (rules allow one write per 20 s).
// - Friends: one-way, by friend code or invite link (?friend=CODE). The Friends tab shows
//   the people I added AND the people who added me, plus my own row.
// - Results are cached for a minute; offline, the last loaded results are shown.
// Reads only from the game state; never touches the simulation.
import {saveProg} from '../progress.js';
import {prog} from '../state.js';
import {cloud,onSynced} from '../sync/index.js';
import {store} from '../util.js';
import {buildRow,cleanCode,cleanNick,codeOf,hiddenRow,nickProblem,rowKey,sortRows,visible} from './rows.js';

const META='skysiege_lb';            // {key, at}: last published row (device-local)
const GAP=25000,CACHE_MS=60000,TOP=50;
let meta={key:'',at:0};
try{const m=JSON.parse(store.get(META)||'null');if(m&&typeof m==='object')meta=Object.assign(meta,m);}catch(e){}
const saveMeta=()=>store.set(META,JSON.stringify(meta));

let timer=null,busy=false,again=false;
const cache={};
const listeners=[];
export const onLbChange=f=>listeners.push(f);
const notify=()=>listeners.forEach(f=>{try{f();}catch(e){}});

export const available=()=>{const c=cloud();return !!(c.backend&&c.backend.lbSave);};
export const myUid=()=>{const c=cloud();return c.user&&c.user.uid||null;};
export const myCode=()=>codeOf(myUid());
export const onBoard=()=>!!prog.nick;
export const myRow=()=>{const u=myUid();return u&&onBoard()?{uid:u,...buildRow(prog,u)}:null;};

// ---- publishing my row
export async function publish(){
  const {backend,user}=cloud();
  if(!backend||!backend.lbSave||!user)return;
  if(!prog.nick&&!meta.key)return;                       // never joined the board
  const row=prog.nick?buildRow(prog,user.uid):hiddenRow(user.uid,prog.friends);
  const key=user.uid+'|'+rowKey(row);
  if(key===meta.key)return;                              // nothing changed
  const wait=meta.at+GAP-Date.now();
  if(wait>0){clearTimeout(timer);timer=setTimeout(publish,wait+250);return;}
  if(busy){again=true;return;}
  busy=true;
  try{
    await backend.lbSave(user.uid,row);
    meta={key,at:Date.now()};saveMeta();
    for(const k in cache)delete cache[k];
    notify();
  }catch(e){
    // too soon (rate limit) or offline: try again later; the next sync also retries
    clearTimeout(timer);timer=setTimeout(publish,GAP);
  }finally{
    busy=false;
    if(again){again=false;publish();}
  }
}

// ---- nickname
export function setNick(raw){
  const problem=nickProblem(raw);
  if(problem)return problem;
  prog.nick=cleanNick(raw);saveProg();publish();notify();
  return null;
}
export function leaveBoard(){prog.nick='';saveProg();publish();notify();}

// ---- friends
export async function findByCode(raw){
  const {backend}=cloud(),code=cleanCode(raw);
  if(!backend||code.length<2)return {error:'notFound'};
  if(code===myCode())return {error:'self'};
  const row=await backend.lbByCode(code);
  if(!row||!visible(row))return {error:'notFound'};
  return {row};
}
export function addFriend(row){
  if(!row||row.uid===myUid())return 'self';
  if((prog.friends||[]).includes(row.uid))return 'already';
  prog.friends=[...(prog.friends||[]),row.uid].slice(0,200);
  saveProg();publish();
  for(const k in cache)if(k.startsWith('friends'))delete cache[k];
  notify();
  return 'added';
}
export function inviteLink(){
  const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('friend',myCode());
  return u.toString();
}

// ---- loading lists. Returns {rows, me:{place,row}|null, stale}
async function cached(key,load){
  const c=cache[key];
  if(c&&Date.now()-c.at<CACHE_MS)return {data:c.data,stale:false};
  try{const data=await load();cache[key]={at:Date.now(),data};store.set('skysiege_lbcache_'+key,JSON.stringify(data));return {data,stale:false};}
  catch(e){
    if(c)return {data:c.data,stale:true};
    try{const d=JSON.parse(store.get('skysiege_lbcache_'+key)||'null');if(d)return {data:d,stale:true};}catch(_){}
    throw e;
  }
}
const withMine=(rows,me)=>{const out=rows.filter(r=>r.uid!==(me&&me.uid));if(me)out.push(me);return out;};

export async function loadList(tab,view){
  const {backend}=cloud(),uid=myUid(),me=myRow();
  if(!backend||!backend.lbTop||(tab==='friends'&&!uid))throw new Error('offline'); // not connected yet
  if(tab==='all'){
    const {data,stale}=await cached('all_'+view,()=>backend.lbTop(view,TOP));
    const rows=sortRows(withMine(data,me),view).slice(0,TOP);
    let place=null;
    if(me){
      const i=rows.findIndex(r=>r.uid===me.uid);
      if(i>=0)place=i+1;
      else{try{place=await backend.lbPlace(view,me.score[view]);}catch(e){place=null;}}
    }
    return {rows,me:me&&{place,row:me},stale};
  }
  const friends=(prog.friends||[]).filter(f=>f!==uid);
  const {data,stale}=await cached('friends_'+friends.slice().sort().join(','),async()=>{
    const [mine,followers]=await Promise.all([friends.length?backend.lbGet(friends):[],uid?backend.lbFollowers(uid):[]]);
    const seen=new Map();for(const r of [...mine,...followers])seen.set(r.uid,r);
    return [...seen.values()];
  });
  const rows=sortRows(withMine(data,me),view);
  return {rows,me:me&&{place:rows.findIndex(r=>r.uid===me.uid)+1,row:me},stale};
}

// ---- invite links: ?friend=CODE -> ask once the cloud is ready
let pendingInvite=null,inviteHandler=null;
export function onInvite(f){inviteHandler=f;}
export function initLeaderboard(){
  const code=cleanCode(new URLSearchParams(location.search).get('friend'));
  if(code){
    pendingInvite=code;
    const u=new URL(location.href);u.searchParams.delete('friend');history.replaceState(null,'',u.toString());
  }
  onSynced(async()=>{
    publish();
    if(pendingInvite&&inviteHandler){
      const code=pendingInvite;pendingInvite=null;
      try{const r=await findByCode(code);if(r.row&&!(prog.friends||[]).includes(r.row.uid))inviteHandler(r.row);}catch(e){}
    }
  });
}
