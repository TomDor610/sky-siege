// Merging a local save with the cloud copy. Pure functions: no DOM, no Firebase.
//
// A save is {prog, build, fort, buildAt}.
// prog (progress) never goes down:
//   - a higher epoch (someone pressed "reset progress") wins outright;
//   - otherwise every counter takes the max: coinsEarned, coinsSpent (coins = earned - spent),
//     xp, upgrade levels, wins per difficulty; styles/unlocks are OR-ed;
//   - best campaign times take the MIN (a lower time is a better record).
// build/fort are choices, not progress: the most recently edited one wins (buildAt).

const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const num=v=>(typeof v==='number'&&isFinite(v)?v:0);
const clone=v=>JSON.parse(JSON.stringify(v));

// Fill in counters for saves written before they existed (coins = earned - spent).
export function normalizeProg(p){
  const out=isObj(p)?clone(p):{};
  out.coins=num(out.coins);
  if(out.coinsEarned===undefined||out.coinsSpent===undefined){out.coinsEarned=out.coins;out.coinsSpent=0;}
  out.coinsEarned=num(out.coinsEarned);out.coinsSpent=num(out.coinsSpent);
  if(out.coinsEarned-out.coinsSpent!==out.coins)out.coinsEarned=out.coins+out.coinsSpent;
  out.epoch=num(out.epoch);out.xp=num(out.xp);
  for(const k of ['upg','styles','unl','wins','duelWins','best'])if(!isObj(out[k]))out[k]={};
  return out;
}

const keys=(a,b)=>[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])];
const maxMap=(a,b)=>{const o={};for(const k of keys(a,b))o[k]=Math.max(num(a[k]),num(b[k]));return o;};
const orMap=(a,b)=>{const o={};for(const k of keys(a,b))o[k]=!!(a[k]||b[k]);return o;};
const minTimes=(a,b)=>{const o={};for(const k of keys(a,b)){const v=[a[k],b[k]].filter(x=>typeof x==='number'&&x>0);if(v.length)o[k]=Math.min(...v);}return o;};

export function mergeProg(localRaw,remoteRaw){
  const a=normalizeProg(localRaw),b=normalizeProg(remoteRaw);
  if(a.epoch!==b.epoch)return a.epoch>b.epoch?a:b;
  const m=Object.assign({},b,a); // unknown/future fields: keep local, fill from remote
  m.coinsEarned=Math.max(a.coinsEarned,b.coinsEarned);
  m.coinsSpent=Math.max(a.coinsSpent,b.coinsSpent);
  m.coins=m.coinsEarned-m.coinsSpent;
  m.xp=Math.max(a.xp,b.xp);
  m.upg=maxMap(a.upg,b.upg);
  m.wins=maxMap(a.wins,b.wins);
  m.duelWins=maxMap(a.duelWins,b.duelWins);
  m.styles=orMap(a.styles,b.styles);
  m.unl=orMap(a.unl,b.unl);
  m.best=minTimes(a.best,b.best);
  return m;
}

// local/remote: {prog, build, fort, buildAt}. remote may be null (first upload).
export function mergeSave(local,remote){
  if(!remote||!isObj(remote.prog))return {prog:normalizeProg(local.prog),build:clone(local.build),fort:clone(local.fort),buildAt:num(local.buildAt)};
  const remoteNewer=num(remote.buildAt)>num(local.buildAt)&&isObj(remote.build)&&isObj(remote.fort);
  return {
    prog:mergeProg(local.prog,remote.prog),
    build:clone(remoteNewer?remote.build:local.build),
    fort:clone(remoteNewer?remote.fort:local.fort),
    buildAt:Math.max(num(local.buildAt),num(remote.buildAt)),
  };
}

// Order-independent comparison (key order differs between merged and stored copies).
const stable=v=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:isObj(v)?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')}}`:JSON.stringify(v===undefined?null:v);
export const sameSave=(a,b)=>!!a&&!!b&&stable(a)===stable(b);
