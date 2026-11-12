// 1v1 battle sync (stage 3). One rule: whatever happens to my things, I decide.
//  - My plane: I fly it and decide every hit on it. Its state goes out ~15 times a second;
//    the opponent draws it ~110 ms behind its arrival (more when arrivals are uneven, up to
//    500 ms), interpolated between two states. The sender's clock is mapped to the local one
//    from the arrivals themselves, so the two players' server-clock estimates never mix.
//  - Shots (bombs, crossbow arrows, defense shots, crashes) go out as events. Both sides
//    simulate them; only the owner of what they hit applies the damage.
//  - My castle: its strength, heights and defenses go out when they change (at most 5 Hz).
//  - Each player sees themselves on the left: everything is mirrored on the way in (x -> W-x).
//  - End: a fallen castle is announced with the server's time; 1.5 s later both sides look at
//    the same announcements (two = draw). At time-up each writes its castle's final % and
//    both compare the same two numbers.
//  - Drops (stage 4): a player who drops or hides the game is marked away (battle/away, set by
//    the server on a drop). The friend sees a 20 s countdown; a player who sends nothing for 25 s
//    counts too. Then the friend declares a technical loss (battle/forfeit), which the rules only
//    accept when the time has really passed. Shots at an absent player's castle are kept and
//    applied when they return.
//  - Emoji: battle/emoji/{uid} = {e, t}, at most one every 3 s, a bubble above the sender's castle.
import {castleHeightsFor,damageCastle,fortDefs,makeCastle} from '../castle.js';
import {BOLT_G,BOMBTYPE,BOMB_G,CW,DUEL_CASTLE_HP,DUEL_TIME,PLAYER_DEF_AI,POT_G,WORLD} from '../data.js';
import {reseedWorld} from '../draw/world.js';
import {floater,spark} from '../effects.js';
import {t} from '../i18n/index.js';
import {explode,makePlane,spawnPlane} from '../physics.js';
import {ZERO_UPG} from '../progress.js';
import {G,setG} from '../state.js';
import {sfx} from '../sound.js';
import {$,clamp,store} from '../util.js';
import {viewW} from '../view.js';
import {AWAY_MS,battleNet,markAway,offlineSince,serverNow,setBattlePresence} from './room.js';

const W=WORLD.width,SEND_MS=66,CASTLE_MS=200,AIM_MS=1000,DELAY=110,MAX_DELAY=500,GRACE=1500,FINAL_WAIT=8000;
export const SILENT_MS=25000,QUIET_MS=3000,EMOJI_MS=3000;
export const EMOJI=['👋','👍','😂','😮','😅','😡','🔥','🏳️'];
const r1=v=>Math.round(v*10)/10;
const castleHP=f=>Math.round(DUEL_CASTLE_HP*(1+0.25*f.walls));

let S=null;            // the running match (also kept on the result screen, for "another battle")
const listeners=[];
export const onNetChange=f=>listeners.push(f);
const notify=()=>listeners.forEach(f=>f());

// o: {mine:{build,fort}, theirs:{build,fort}, battleAt (when the battle starts, server time), seed, round, oppName}
export function beginNet(o){
  stopNet();
  const n=battleNet();if(!n)return false;
  if(o.seed!=null)reseedWorld(o.seed);
  const me=makePlane('L',Object.assign({},o.mine.build),ZERO_UPG,false);
  const opp=makePlane('R',Object.assign({},o.theirs.build),ZERO_UPG,false);opp.remote=true;
  const mf=o.mine.fort,tf=o.theirs.fort;
  const mine=makeCastle({side:'L',x0:150,heights:castleHeightsFor(mf.walls),hp:castleHP(mf),defs:fortDefs(mf,'L'),ai:PLAYER_DEF_AI,label:t('castle.labelMine'),tint:mf.walls*0.15,bands:mf.walls>=2,banners:mf.walls});
  const foe=makeCastle({side:'R',x0:W-150-CW,heights:castleHeightsFor(tf.walls).reverse(),hp:castleHP(tf),defs:fortDefs(tf,'R'),ai:PLAYER_DEF_AI,label:o.oppName||t('castle.labelFoe'),tint:tf.walls*0.15,bands:tf.walls>=2,banners:tf.walls});
  foe.remote=true;
  S={n,round:o.round,battleAt:o.battleAt,oppName:o.oppName||'',buf:[],seen:new Set(),unsub:[],
    lastSend:0,lastCastle:0,castleKey:'',falls:{},finals:{},rematch:{},fallSent:false,finalSent:false,timeUpAt:0,
    result:null,hits:0,sent:0,got:0,phase:'count',skew:null,jitter:0,delay:DELAY,counted:false,
    away:{},forfeit:{},lastT:0,oppGone:false,deadline:0,forfeitTry:0,banner:'',emojiT:0,emojiSentAt:0};
  const ctl={pre,post,emit,countdown,hit:()=>{S.hits++;}};
  setG({duel:true,net:ctl,diff:'medium',state:'play',t:0,end:0,bombs:[],bolts:[],arrows:[],burns:[],parts:[],floaters:[],
    cam:{x:0,y:WORLD.ground-650},shake:0,killedDefs:0,botDowns:0,mult:1,planes:[me,opp],me,opp,castles:[mine,foe],mine,foe,bubbles:[]});
  spawnPlane(me);spawnPlane(opp);
  G.cam.x=me.x-viewW*0.3;
  const {net,code,opp:ou}=n;
  S.unsub.push(
    net.watchPlane(code,ou,onPlane),
    net.watchEvents(code,ou,onEvent),
    net.watchCastle(code,ou,onCastle),
    net.watchNode(code,'fall',v=>{S.falls=v;}),
    net.watchNode(code,'final',v=>{S.finals=v;}),
    net.watchNode(code,'rematch',v=>{S.rematch=v;notify();}),
    net.watchNode(code,'away',v=>{S.away=v;notify();}),
    net.watchNode(code,'forfeit',v=>{S.forfeit=v;}),
    net.watchEmoji(code,ou,onEmoji));
  setBattlePresence(true);
  document.addEventListener('visibilitychange',onVisibility);
  notify();
  return true;
}

// the game hidden (another app, another tab): the friend sees me away until I am back
function onVisibility(){if(S&&!S.result)markAway(document.hidden);}

// the host's own copy of the start time is its estimate until the server's value arrives
export function setNetStart(at){if(S&&S.phase==='count')S.battleAt=at;}

export function stopNet(){
  if(!S)return;
  for(const u of S.unsub)try{u();}catch(e){}
  document.removeEventListener('visibilitychange',onVisibility);
  setBattlePresence(false);
  showBanner('');S=null;$('vsCount').classList.add('hidden');notify();
}

// ---- countdown (mode 'vscount' in flow.js): true once the battle starts
function countdown(){
  const ms=S.battleAt-serverNow(),el=$('vsCount');
  if(ms>0){S.counted=true;el.classList.remove('hidden');el.textContent=String(Math.ceil(ms/1000));return false;}
  el.textContent=t('vs.go');S.phase='play';
  setTimeout(()=>el.classList.add('hidden'),700);
  return true;
}

// ---- incoming
function onPlane(s){
  if(!S||!s)return;S.got++;
  const b=S.buf;
  if(b.length&&s.t<=b[b.length-1].t)return;
  S.lastT=Math.max(S.lastT,s.t);
  // how late states arrive (sender's server time -> my server time); the view stays behind that
  // skew = local time minus the sender's time stamp, taken from the quickest arrivals (it drifts
  // up slowly, so a changed clock is followed); jitter = how much later than that states arrive
  const d=performance.now()-s.t;
  S.skew=S.skew===null||d<S.skew?d:S.skew+(d-S.skew)*0.002;
  S.jitter=S.jitter*0.9+(d-S.skew)*0.1;
  S.delay=clamp(DELAY+S.jitter*1.5,DELAY,MAX_DELAY);
  b.push({t:s.t,x:W-s.x,y:s.y,p:s.p,f:-s.f,s:s.s,hp:s.hp,vz:s.vz||0,dd:!!s.dd,cr:!!s.cr,ro:s.ro||0,bo:s.bo});
  if(b.length>40)b.splice(0,b.length-40);
}

function onEvent(id,e){
  if(!S||!e||S.seen.has(id)||!G)return;
  S.seen.add(id);S.got++;
  const age=clamp((serverNow()-e.t)/1000,0,0.3),x=W-e.x,y=e.y,vx=-(e.vx||0),vy=e.vy||0;
  const fly=(o,g)=>{o.x+=o.vx*age;o.y+=o.vy*age+0.5*g*age*age;o.vy+=g*age;return o;};
  switch(e.k){
    case 'b':sfx('drop',{x});G.bombs.push(fly({owner:'R',bt:G.opp.bt,mul:1,x,y,vx,vy},BOMB_G));break;
    case 'a':sfx('crossbow',{x});G.arrows.push(fly({owner:'R',mul:1,x,y,vx,vy,life:1.4-age},120));break;
    case 'D':sfx('ballista',{x});G.bolts.push(fly({owner:'R',kind:'bolt',x,y,vx,vy,life:3-age,dmg:e.dm},BOLT_G));break;
    case 'A':sfx('archers',{x});G.bolts.push(fly({owner:'R',kind:'arrow',x,y,vx,vy,life:2-age,dmg:e.dm},BOLT_G));break;
    case 'P':{sfx('mangonel',{x});const d=G.foe.defs[e.i];if(d)d.swing=0.5;
      G.bolts.push(fly({owner:'R',kind:'pot',x,y,vx,vy,life:e.l-age,fuse:e.fu-age,dmg:e.dm,rad:e.rd},POT_G));break;}
    case 'x':explode('R',x,y,BOMBTYPE.stone,true);break;                      // crashed near my things
    case 'r':explode('R',x,y,BOMBTYPE.stone,true);if(G.mine.hp>0)damageCastle(G.mine,x,y,20);break;   // rammed my castle
  }
}

function onCastle(c){
  if(!S||!c||!G)return;S.got++;
  const f=G.foe;
  f.hp=c.hp;
  for(let i=0;i<11&&i<c.h.length;i++)f.heights[10-i]=parseInt(c.h[i],16);
  const d=c.d||'',a=(c.a||'').split(',');
  f.defs.forEach((b,i)=>{
    if(a[i]!==undefined&&a[i]!=='')b.angle=Math.PI-Number(a[i]);
    if(b.alive&&d[i]==='0'){b.alive=false;spark(b.x,b.y,'splinter',18);sfx('defDown',{x:b.x});
      floater(b.x,b.y-40,t('fl.defDown',{name:t(`def.${b.type}.name`)}),'#4f6b2c');G.killedDefs++;}
  });
  if(c.f&&!f.fallen)fall(f);
}

function fall(c){
  c.hp=0;c.fallen=true;for(const b of c.defs)b.alive=false;
  sfx('castleFall',{x:c.x0+CW/2});
  floater(c.x0+CW/2,WORLD.ground-Math.max(...c.heights)*40-60,c.side==='L'?t('fl.castleFellMine'):t('fl.castleFell'),c.side==='L'?'#a3341f':'#4f6b2c');
}

// ---- per frame: before the simulation (clock, the remote plane)
function pre(dt){
  G.t=(serverNow()-S.battleAt)/1000;
  const o=G.opp;
  if(o.hitFlash>0)o.hitFlash-=dt;
  const b=S.buf;if(!b.length)return;
  const rt=S.skew===null?0:performance.now()-S.skew-S.delay;   // in the sender's time
  let k=b.length-1;while(k>=0&&b[k].t>rt)k--;
  let s;
  if(k<0)s=b[0];
  else if(k===b.length-1){                         // nothing newer yet: carry on briefly
    const a=b[k],e=Math.min(0.25,(rt-a.t)/1000);
    s=Object.assign({},a);
    if(!a.dd&&e>0){s.x+=a.f*Math.cos(a.p)*a.s*e;s.y+=-Math.sin(a.p)*a.s*e+a.vz*e;}
  }else{
    const a=b[k],c=b[k+1],u=(rt-a.t)/Math.max(1,c.t-a.t);
    if(a.f!==c.f||a.dd!==c.dd||Math.abs(a.p-c.p)>1.5||Math.hypot(c.x-a.x,c.y-a.y)>300)s=u<0.5?a:c;
    else s=Object.assign({},c,{x:a.x+(c.x-a.x)*u,y:a.y+(c.y-a.y)*u,p:a.p+(c.p-a.p)*u,s:a.s+(c.s-a.s)*u,ro:a.ro+(c.ro-a.ro)*u});
  }
  if(s.dd&&!o.dead){spark(o.x,o.y,'splinter',16);spark(o.x,o.y,'fire',12);sfx('planeDown',{x:o.x});floater(o.x,o.y-40,t('vs.fl.oppDown'),'#4f6b2c');G.botDowns++;}
  if(!s.dd&&o.dead)sfx('launch',{x:s.x});
  o.x=s.x;o.y=s.y;o.p=s.p;o.facing=s.f;o.s=s.s;o.vz=s.vz;o.hp=s.hp;o.dead=s.dd;o.crashed=s.cr;o.roll=s.ro;
  if(s.bo!==undefined)o.bombs=s.bo;
  if(!o.dead&&o.hp<o.st.hp*0.5&&Math.random()<0.35)spark(o.x,o.y,'smoke');
}

// ---- per frame: after the simulation (send, end of the battle)
function post(){
  const now=serverNow(),me=G.me,c=G.mine,{net,code,uid}=S.n;
  // (not while my line is down: only the latest state matters, and old ones would be refused)
  if(now-S.lastSend>=SEND_MS&&!offlineSince()){
    S.lastSend=now;S.sent++;
    net.setPlane(code,uid,{t:Math.round(now),x:Math.round(me.x),y:Math.round(me.y),p:Math.round(me.p*100)/100,f:me.facing,s:Math.round(me.s),hp:Math.ceil(me.hp),vz:Math.round(me.vz),
      dd:me.dead?1:0,cr:me.crashed?1:0,ro:r1(me.roll),bo:me.bombs}).catch(()=>{});
  }
  if(c.hp<=0&&!c.fallen&&G.state==='play'&&G.t<DUEL_TIME){fall(c);if(!S.fallSent){S.fallSent=true;net.setFall(code,uid).catch(()=>{});}}
  if(now-S.lastCastle>=CASTLE_MS){
    // the aim of the defenses alone (it changes all the time) goes out at most once a second
    const snap={hp:r1(Math.max(0,c.hp)),h:c.heights.map(h=>clamp(h,0,15).toString(16)).join(''),d:c.defs.map(b=>b.alive?'1':'0').join(''),f:c.fallen?1:0};
    const key=JSON.stringify(snap),aim=c.defs.map(b=>Math.round(b.angle*10)/10).join(',');
    if(key!==S.castleKey||(aim!==S.aim&&now-S.lastCastle>=AIM_MS)){
      S.castleKey=key;S.aim=aim;S.lastCastle=now;S.sent++;snap.a=aim;net.setCastle(code,uid,snap).catch(()=>{});}
  }
  presence(now);
  decide(now);
}

// ---- drops: the friend away or silent, or my own line gone
function showBanner(text){if(S)S.banner=text;const el=$('vsNet');el.textContent=text;el.classList.toggle('hidden',!text);}
function presence(now){
  if(S.result)return;
  const {net,code,opp}=S.n,awayAt=S.away[opp],last=S.lastT||S.battleAt,silent=now-last>QUIET_MS;
  S.oppGone=!!awayAt||silent;
  S.deadline=Math.min(awayAt?awayAt+AWAY_MS:Infinity,silent?last+SILENT_MS:Infinity);
  G.opp.away=S.oppGone;
  const off=offlineSince(),secs=ms=>Math.max(0,Math.ceil(ms/1000));
  let text='';
  if(off){
    const left=AWAY_MS-(Date.now()-off);
    text=t('vs.net.me',{s:secs(left)});
    if(left<-3000)return settle('techLost',false);        // the friend has been told by now
  }else if(S.oppGone){
    text=t(awayAt?'vs.net.away':'vs.net.silent',{s:secs(S.deadline-now)});
    // the time is up: declare it (the rules check the time too); retried until it is accepted
    if(now>=S.deadline&&now-S.forfeitTry>1000){S.forfeitTry=now;net.setForfeit(code,opp).catch(()=>{});}
  }
  if(text!==S.banner)showBanner(text);
}

function decide(now){
  if(S.result)return;
  const {uid,opp,net,code}=S.n,end=S.battleAt+DUEL_TIME*1000;
  if(S.forfeit[opp]!=null)return settle('techWon',false);
  if(S.forfeit[uid]!=null)return settle('techLost',false);
  const mf=S.falls[uid],tf=S.falls[opp],first=Math.min(mf??Infinity,tf??Infinity);
  if(first<end){
    if(now<first+GRACE)return;
    const a=mf!=null&&mf<=first+GRACE,b=tf!=null&&tf<=first+GRACE;
    return settle(a&&b?'draw':a?'lost':'won',false);
  }
  if(G.t<DUEL_TIME)return;
  if(!S.finalSent){
    S.finalSent=true;S.timeUpAt=now;G.state='timeup';
    S.myFinal=r1(100*Math.max(0,G.mine.hp)/G.mine.max);
    net.setFinal(code,uid,S.myFinal).catch(()=>{});
    floater(G.me.x,G.me.y-50,t('fl.timeUp'));
  }
  let theirs=S.finals[opp];
  if(theirs==null&&now-S.timeUpAt>FINAL_WAIT)theirs=r1(100*Math.max(0,G.foe.hp)/G.foe.max);
  if(theirs==null)return;
  S.theirFinal=theirs;
  settle(S.myFinal>theirs?'won':S.myFinal<theirs?'lost':'draw',true);
}

function settle(res,timeUp){
  S.result=res;S.timeUp=timeUp;S.phase='end';
  showBanner('');G.opp.away=false;setBattlePresence(false);
  G.state=res==='draw'?'draw':res==='techWon'?'won':res==='techLost'?'lost':res;G.timeUp=timeUp;G.winTime=G.t;G.end=G.t+(timeUp?1.5:2.6);
  if(res==='draw')floater(G.me.x,G.me.y-50,t('vs.fl.draw'));
  notify();
}

// the opponent is gone in the middle of the battle
export function abortNet(){
  if(!S||S.result)return false;
  S.result='left';S.phase='end';showBanner('');setBattlePresence(false);if(G){G.state='left';G.end=G.t;}
  notify();return true;
}

// ---- outgoing events, from physics.js / castle.js (my coordinates)
function emit(e){
  const {net,code,uid}=S.n;S.sent++;
  const o={t:Math.round(serverNow())};
  for(const k in e)o[k]=typeof e[k]==='number'?Math.round(e[k]*100)/100:e[k];
  net.pushEvent(code,uid,o).catch(()=>{});
}

// ---- the result screen
const TITLE={won:'vs.res.won',lost:'vs.res.lost',draw:'vs.res.draw',left:'vs.res.left',techWon:'vs.res.techWon',techLost:'vs.res.techLost'};
// the result screen is up (flow.js): the screens that follow the match refresh their buttons
export function resultShown(){notify();}

export function netResult(){
  const res=S?S.result:'left',name=S&&S.oppName||t('room.guestName');
  const mine=G?Math.round(100*Math.max(0,G.mine.hp)/G.mine.max):0,foe=G?Math.round(100*Math.max(0,G.foe.hp)/G.foe.max):0;
  if(S&&S.timeUp){
    const m=Math.round(S.myFinal),f=Math.round(S.theirFinal);
    return {res,title:t(TITLE[res]),text:t('vs.res.pointsText',{mine:m,foe:f,name})};
  }
  if(res==='left')return {res,title:t('vs.res.left'),text:t('vs.res.leftText')};
  if(res==='techWon')return {res,title:t(TITLE.techWon),text:t('vs.res.techWonText',{name})};
  if(res==='techLost')return {res,title:t(TITLE.techLost),text:t('vs.res.techLostText')};
  if(res==='draw')return {res,title:t('vs.res.draw'),text:t('vs.res.drawText')};
  return {res,title:t(TITLE[res]),text:t(res==='won'?'vs.res.wonText':'vs.res.lostText',{mine,foe,name})};
}

export function sendRematch(){
  if(!S)return Promise.reject(new Error('no match'));
  const {net,code,uid}=S.n;return net.setRematch(code,uid,S.round);
}

// ---- emoji
export const emojiMuted=()=>store.get('skysiege_emoji')==='0';
export const emojiWait=()=>S?Math.max(0,EMOJI_MS-(serverNow()-S.emojiSentAt)):0;
export function sendEmoji(i){
  if(!S||!EMOJI[i]||emojiWait()>0)return false;
  S.emojiSentAt=serverNow();
  const {net,code,uid}=S.n;net.sendEmoji(code,uid,i).catch(()=>{});
  bubble('L',i);return true;
}
function onEmoji(v){
  if(!S||!v||typeof v.e!=='number'||!(v.t>S.emojiT))return;
  S.emojiT=v.t;
  if(serverNow()-v.t>4000||emojiMuted())return;   // an old one (from before I joined) or muted
  S.emojiGot=(S.emojiGot||0)+1;
  bubble('R',v.e);
}
// in the battle: a bubble above the sender's castle (drawn in draw/render.js);
// on the result screen: a short line under the title
let toastTimer=null;
function bubble(side,i){
  if(!G)return;
  if(G.state==='over'){
    const el=$('vsToast');el.textContent=(side==='L'?t('room.you'):S.oppName||t('room.guestName'))+' '+EMOJI[i];
    el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),3000);
    return;
  }
  G.bubbles=G.bubbles.filter(b=>b.side!==side);
  G.bubbles.push({side,e:EMOJI[i],until:performance.now()+3000});
}

export function netInfo(){
  if(!S)return {active:false};
  const {uid,opp}=S.n;
  return {active:true,now:serverNow(),delay:Math.round(S.delay),skew:S.skew,counted:S.counted,phase:S.phase,result:S.result,round:S.round,timeUp:!!S.timeUp,hits:S.hits,sent:S.sent,got:S.got,
    buffered:S.buf.length,falls:S.falls,finals:S.finals,
    rematchMine:S.rematch[uid]===S.round,rematchTheirs:S.rematch[opp]===S.round,
    oppGone:S.oppGone,banner:S.banner,away:S.away,forfeit:S.forfeit,emojiGot:S.emojiGot||0,emojiWait:emojiWait()};
}
