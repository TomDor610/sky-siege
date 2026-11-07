// In-battle HUD.
import {DUEL_TIME} from '../data.js';
import {t} from '../i18n/index.js';
import {G} from '../state.js';
import {$,clamp} from '../util.js';
export let hudCache={};
export function setTxt(id,v){if(hudCache[id]!==v){hudCache[id]=v;$(id).textContent=v;}}
export function setW(id,v){const s=(clamp(v,0,1)*100).toFixed(1)+'%';if(hudCache[id]!==s){hudCache[id]=s;$(id).style.width=s;}}
// Pause/sound buttons sit under the enemy-castle box. A longer label (e.g. English on a
// portrait phone) can wrap to two lines, so measure the box when its text changes and
// expose the result as --btnTop (the tutorial bubble is placed below it too).
function placeButtons(){
  if(hudCache.btnFor===hudCache.castleTxt)return;hudCache.btnFor=hudCache.castleTxt;
  const r=$('castleTxt').parentElement.getBoundingClientRect();
  const top=Math.max(64,Math.round(r.bottom+8))+'px';
  if(hudCache.btnTop!==top){hudCache.btnTop=top;document.documentElement.style.setProperty('--btnTop',top);}
}
export function hud(){
  const me=G.me;
  setTxt('hpTxt',t('hud.machineHp',{hp:Math.ceil(me.hp),max:me.st.hp}));setW('hpBar',me.hp/me.st.hp);
  setTxt('castleTxt',G.duel?t('hud.foeCastleHp',{hp:Math.max(0,Math.ceil(G.foe.hp))}):t('hud.castleLevel',{lvl:G.foe.lvl}));setW('castleBar',G.foe.hp/G.foe.max);
  placeButtons();
  if(G.mine){setTxt('ownTxt',t('hud.ownCastleHp',{hp:Math.max(0,Math.ceil(G.mine.hp))}));setW('ownBar',G.mine.hp/G.mine.max);}
  let tt;if(G.duel){const r=Math.max(0,DUEL_TIME-G.t);tt=`${Math.floor(r/60)}:${String(Math.floor(r%60)).padStart(2,'0')}`;}else tt=t('hud.seconds',{s:(G.winTime!==undefined?G.winTime:G.t).toFixed(1)});
  setTxt('timeTxt',tt);setTxt('bombTxt',String(me.bombs));
  let msg='',vis='hidden';
  if(me.dead&&G.duel&&me.crashed&&G.state==='play'){msg=t('hud.respawn',{n:Math.ceil(me.respawnT)});vis='visible';}
  else if(me.stalling&&!me.dead&&G.state==='play'){msg=t('hud.stall');vis='visible';}
  setTxt('stall',msg);if(hudCache.stallV!==vis){hudCache.stallV=vis;$('stall').style.visibility=vis;}
}
export function resetHud(){hudCache={};}
