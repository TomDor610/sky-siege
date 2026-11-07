// Leaderboard rows: built from the player's progress. Pure functions (no DOM, no Firebase).
//
// leaderboard/{uid} = {name, code, rank, lvl:{easy,medium,hard}, best:{...}, duelWins,
//                      score:{easy,medium,hard,duel}, friends:[uid], updatedAt}
// lvl.d  = campaign castles beaten at that difficulty (prog.wins[d]) = highest level reached
// best.d = fastest campaign win at that difficulty, rounded to 0.1 s (0 = none yet)
// score.d is a single sortable number (Firestore can order by one field without a custom
// index): more levels first, then the faster time. firestore.rules recomputes it.
import {rankOf} from '../progress.js';

export const DIFFS=['easy','medium','hard'];
export const VIEWS=['easy','medium','hard','duel'];
export const NICK_MIN=2,NICK_MAX=16,FRIENDS_MAX=200;
const T_MIN=3,T_MAX=10000,LVL_MAX=500,DUEL_MAX=100000;

// Friend code: the first 8 characters of the uid, upper-cased (rules check the same).
export const codeOf=uid=>String(uid||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
export const cleanCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

export function campaignScore(lvl,best){return lvl>0?lvl*100000+(99999-Math.min(99999,Math.round(best*10))):0;}

// Nicknames: 2-16 letters (Hebrew/English), digits, space, _ and -; trimmed; basic word filter.
const NICK_RE=/^[A-Za-z0-9א-ת _-]+$/;
const BLOCK=['fuck','shit','bitch','cunt','nigger','nazi','hitler','זונה','שרמוטה','כוס אמ','זין','מניאק','בן זונה'];
export function nickProblem(raw){
  const s=String(raw||'').trim().replace(/\s+/g,' ');
  if(s.length<NICK_MIN)return 'short';
  if(s.length>NICK_MAX)return 'long';
  if(!NICK_RE.test(s))return 'chars';
  const low=s.toLowerCase().replace(/[\s_-]/g,'');
  if(BLOCK.some(w=>low.includes(w.replace(/\s/g,''))))return 'word';
  return null;
}
export const cleanNick=raw=>String(raw||'').trim().replace(/\s+/g,' ');

const clampInt=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.floor(+v||0)));

export function buildRow(prog,uid){
  const lvl={},best={},score={};
  for(const d of DIFFS){
    lvl[d]=clampInt(prog.wins&&prog.wins[d],0,LVL_MAX);
    const b=prog.best&&prog.best[d];
    best[d]=lvl[d]>0&&b>0?Math.min(T_MAX,Math.max(T_MIN,Math.round(b*10)/10)):0;
    if(lvl[d]>0&&!best[d])best[d]=T_MAX; // a win with no recorded time (old saves): slowest possible
    score[d]=campaignScore(lvl[d],best[d]);
  }
  const duelWins=clampInt(Object.values(prog.duelWins||{}).reduce((a,v)=>a+(+v||0),0),0,DUEL_MAX);
  score.duel=duelWins;
  return {
    name:cleanNick(prog.nick),code:codeOf(uid),rank:clampInt(rankOf(prog.xp||0),1,20),
    lvl,best,duelWins,score,
    friends:(prog.friends||[]).filter(f=>typeof f==='string'&&f&&f!==uid).slice(0,FRIENDS_MAX),
  };
}

// A player who leaves the board keeps a row (rules forbid deletes) but with no name and
// scores of -1, so it sinks below everyone and is filtered out of every list.
export function hiddenRow(uid,friends){
  const z={easy:0,medium:0,hard:0};
  return {name:'',code:codeOf(uid),rank:1,lvl:{...z},best:{...z},duelWins:0,score:{easy:-1,medium:-1,hard:-1,duel:-1},friends:(friends||[]).slice(0,FRIENDS_MAX)};
}

export const visible=r=>!!r&&typeof r.name==='string'&&r.name.length>=NICK_MIN;

// Sort for a view (easy/medium/hard/duel): score desc, then name for stable ties.
export function sortRows(rows,view){
  return rows.filter(visible).slice().sort((a,b)=>((b.score&&b.score[view])||0)-((a.score&&a.score[view])||0)||String(a.name).localeCompare(String(b.name)));
}

// Order-independent comparison of the parts that matter (to skip needless writes).
export function rowKey(r){return JSON.stringify([r.name,r.code,r.rank,DIFFS.map(d=>[r.lvl[d],r.best[d]]),r.duelWins,[...r.friends].sort()]);}
