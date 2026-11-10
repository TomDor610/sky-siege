// 1v1 loadouts: the build + castle defenses a player brings to a match. Pure functions.
// Sent through the Realtime Database, where database.rules.json checks the same limits and the
// same cost (VS_POOL), so an over-budget or impossible loadout is refused by the server.
// Defense slots travel as a full array with '-' for empty (the database drops nulls in arrays).
import {BOMBTYPE,DEF,PARTS,STYLES,VS_POOL,WALL_COST,WALL_MAX} from '../data.js';

const EMPTY='-';
const isInt=v=>Number.isInteger(v);

export function encodeLoadout(build,fort){
  const b={};
  for(const k of ['style','bombType',...Object.keys(PARTS)])b[k]=build[k];
  return {build:b,fort:{s:[0,1,2,3,4].map(i=>fort.slots[i]||EMPTY),walls:fort.walls}};
}

export function decodeLoadout(l){
  return {build:{...l.build},fort:{slots:l.fort.s.map(x=>(x===EMPTY?null:x)),walls:l.fort.walls}};
}

export function loadoutCost(l){
  const b=l.build;
  let c=0;
  for(const k in PARTS)c+=b[k]*(k==='bombs'?BOMBTYPE[b.bombType].cost:PARTS[k].cost);
  for(const s of l.fort.s)if(s!==EMPTY)c+=DEF[s].cost;
  return c+l.fort.walls*WALL_COST;
}

// Mirrors the rules: true when the server would accept it.
export function validLoadout(l){
  if(!l||!l.build||!l.fort||!Array.isArray(l.fort.s)||l.fort.s.length!==5)return false;
  const b=l.build;
  if(!STYLES[b.style]||!BOMBTYPE[b.bombType])return false;
  for(const k in PARTS)if(!isInt(b[k])||b[k]<PARTS[k].min||b[k]>PARTS[k].max)return false;
  if(l.fort.s.some(s=>s!==EMPTY&&!DEF[s]))return false;
  if(!isInt(l.fort.walls)||l.fort.walls<0||l.fort.walls>WALL_MAX)return false;
  return loadoutCost(l)<=VS_POOL;
}
