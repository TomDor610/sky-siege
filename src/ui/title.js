// Title screen: Play, Continue, mode cards, account line, Leaderboard, Settings, language.
// Play goes straight into a battle as a guest. A new player gets the tutorial battle
// (campaign, easy, unless they picked a mode); a returning player gets their last choice.
// Continue opens the workshop. Nothing here waits for Firebase.
import {analyticsOn,setAnalyticsOn,track} from '../analytics.js';
import {getLang,onLangChange,setLang,t} from '../i18n/index.js';
import {start,toMenu} from '../flow.js';
import {myRank,rankName} from '../progress.js';
import {onSoundChange,setSound,soundSettings} from '../sound.js';
import {difficulty,gameMode,prog,setDifficulty,setGameMode} from '../state.js';
import {cloudConfigured,info,onSyncChange,signInGoogle} from '../sync/index.js';
import {$,store} from '../util.js';
import {openLeaderboard} from './leaderboard-ui.js';
import {openRoomScreen} from './room-ui.js';
import {isNewPlayer} from './tutorial.js';

const chosenMode=()=>!!store.get('skysiege_mode');
// what Play will launch, so the highlighted card always tells the truth
const titleMode=()=>(isNewPlayer()&&!chosenMode()?'campaign':gameMode);

function play(){
  if(isNewPlayer()){
    const m=titleMode(),d=store.get('skysiege_diff')?difficulty:'easy';
    setGameMode(m);store.set('skysiege_mode',m);
    setDifficulty(d);store.set('skysiege_diff',d);
  }
  start();
}

export function renderTitle(){
  // 1v1 is still being built: visible with ?beta=1 (invite links work for everyone)
  $('ttlFriend').classList.toggle('hidden',!store.get('skysiege_beta'));
  const mode=titleMode();
  document.querySelectorAll('#ttlModes button[data-tm]').forEach(b=>b.classList.toggle('on',b.dataset.tm===mode));
  const hasSave=!!store.get('skysiege_prog'),r=myRank();
  $('ttlContinue').classList.toggle('hidden',!hasSave);
  $('ttlContinueSub').textContent=t('title.contSub',{r,name:rankName(r),coins:prog.coins});

  const configured=cloudConfigured(),c=info(),signedIn=!!c.uid&&c.isAnonymous===false,name=prog.nick||c.name;
  $('ttlLb').classList.toggle('hidden',!configured);
  $('ttlAcct').classList.toggle('hidden',!configured);
  $('ttlAcctTxt').classList.toggle('hidden',!signedIn);
  $('ttlAcctTxt').textContent=signedIn?(name?t('title.signedIn',{name,r}):t('title.signedInNoName',{r})):'';
  const g=$('ttlGoogle');
  g.classList.toggle('hidden',signedIn);
  g.disabled=c.status==='off'||c.status==='syncing';
}

function renderSettings(){
  const s=soundSettings(),on=k=>s[k]&&!s.muted;
  const fx=$('setSfx'),mu=$('setMusic'),an=$('setAnalytics');
  fx.textContent=t(on('sfx')?'snd.fx.on':'snd.fx.off');fx.classList.toggle('on',on('sfx'));
  mu.textContent=t(on('music')?'snd.music.on':'snd.music.off');mu.classList.toggle('on',on('music'));
  an.textContent=t(analyticsOn()?'set.an.on':'set.an.off');an.classList.toggle('on',analyticsOn());
  $('setLang').textContent='🌐 '+t('lang.other');
}

const switchLang=()=>setLang(getLang()==='he'?'en':'he');

// Called whenever the title screen is shown.
export function titleShown(){
  renderTitle();
  track('title_view',{new_player:isNewPlayer(),lang:getLang()});
}

export function initTitle(){
  $('ttlPlay').onclick=play;
  $('ttlContinue').onclick=()=>toMenu();
  document.querySelectorAll('#ttlModes button[data-tm]').forEach(b=>b.onclick=()=>{
    setGameMode(b.dataset.tm);store.set('skysiege_mode',b.dataset.tm);renderTitle();
  });
  $('ttlFriend').onclick=openRoomScreen;
  $('ttlGoogle').onclick=async()=>{try{await signInGoogle();}catch(e){}renderTitle();};
  $('ttlLb').onclick=openLeaderboard;
  $('ttlLang').onclick=switchLang;
  $('ttlSettings').onclick=()=>{renderSettings();$('settingsScreen').classList.remove('hidden');};
  $('setClose').onclick=()=>$('settingsScreen').classList.add('hidden');
  // same behaviour as the workshop toggles: turning a channel on also lifts a global mute
  $('setSfx').onclick=()=>{const s=soundSettings();setSound({sfx:!(s.sfx&&!s.muted),muted:false});};
  $('setMusic').onclick=()=>{const s=soundSettings();setSound({music:!(s.music&&!s.muted),muted:false});};
  $('setLang').onclick=switchLang;
  $('setAnalytics').onclick=()=>{setAnalyticsOn(!analyticsOn());renderSettings();};
  // one analytics event per press on the title screen and in Settings
  document.addEventListener('click',e=>{
    const el=e.target.closest&&e.target.closest('#titleScreen [data-track],#settingsScreen [data-track]');
    if(el&&!el.disabled)track('title_click',{target:el.dataset.track});
  },true);
  onSoundChange(renderSettings);
  onSyncChange(renderTitle);
  onLangChange(()=>{renderTitle();renderSettings();});
}
