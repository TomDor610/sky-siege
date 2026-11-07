// In-battle HUD.
import {DUEL_TIME} from '../data.js';
import {G} from '../state.js';
import {$,clamp} from '../util.js';
export let hudCache={};
export function setTxt(id,v){if(hudCache[id]!==v){hudCache[id]=v;$(id).textContent=v;}}
export function setW(id,v){const s=(clamp(v,0,1)*100).toFixed(1)+'%';if(hudCache[id]!==s){hudCache[id]=s;$(id).style.width=s;}}
export function hud(){
  const me=G.me;
  setTxt('hpTxt',`המכונה ${Math.ceil(me.hp)}/${me.st.hp}`);setW('hpBar',me.hp/me.st.hp);
  setTxt('castleTxt',G.duel?`טירת היריב ${Math.max(0,Math.ceil(G.foe.hp))}`:`טירה רמה ${G.foe.lvl}`);setW('castleBar',G.foe.hp/G.foe.max);
  if(G.mine){setTxt('ownTxt',`הטירה שלך ${Math.max(0,Math.ceil(G.mine.hp))}`);setW('ownBar',G.mine.hp/G.mine.max);}
  let tt;if(G.duel){const r=Math.max(0,DUEL_TIME-G.t);tt=`${Math.floor(r/60)}:${String(Math.floor(r%60)).padStart(2,'0')}`;}else tt=(G.winTime!==undefined?G.winTime:G.t).toFixed(1)+' שנ\'';
  setTxt('timeTxt',tt);setTxt('bombTxt',String(me.bombs));
  let msg='',vis='hidden';
  if(me.dead&&G.duel&&me.crashed&&G.state==='play'){msg=`משוגר שוב בעוד ${Math.ceil(me.respawnT)}…`;vis='visible';}
  else if(me.stalling&&!me.dead&&G.state==='play'){msg='⚠ הזדקרות!';vis='visible';}
  setTxt('stall',msg);if(hudCache.stallV!==vis){hudCache.stallV=vis;$('stall').style.visibility=vis;}
}
export function resetHud(){hudCache={};}
