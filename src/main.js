// Entry point. Init order mirrors the original single-file script.
import {initPaper} from './draw/paper.js';
import {initWorld} from './draw/world.js';
import {initFlow,loop,start,toMenu,toTitle} from './flow.js';
import {initAnalytics} from './analytics.js';
import {initTitle} from './ui/title.js';
import {handleRoomLink,initRoomUI} from './ui/room-ui.js';
import {initVsUI} from './ui/vs-ui.js';
import {vsMode} from './progress.js';
import {roomInfo} from './net/room.js';
import {update} from './game.js';
import {initInput,input,pressed} from './input.js';
import {stats} from './physics.js';
import {loadSaved,sanitize} from './progress.js';
import {G,build,fort,prog,setGameMode} from './state.js';
import {initBuildUI,refreshBuild,renderControls} from './ui/build.js';
import {getLang,initLang,onLangChange,setLang} from './i18n/index.js';
import {$} from './util.js';
import {initTutorial,tutorialInfo,tutorialTick} from './ui/tutorial.js';
import {initSound,soundInfo} from './sound.js';
import {initSoundUI} from './ui/sound-ui.js';
import {initSync,info as syncInfo} from './sync/index.js';
import {initCloudUI} from './ui/cloud-ui.js';
import {initLeaderboard} from './leaderboard/index.js';
import {initLeaderboardUI} from './ui/leaderboard-ui.js';
import {mode} from './flow.js';
import {initView,resize} from './view.js';
initLang();
{const q=new URLSearchParams(location.search),b=q.get('beta');if(b!==null){try{b==='1'?localStorage.setItem('skysiege_beta','1'):localStorage.removeItem('skysiege_beta');}catch(e){}q.delete('beta');const u=new URL(location.href);u.search=q.toString();history.replaceState(null,'',u.toString());}}
loadSaved();sanitize();
initBuildUI();
initView();
initPaper();
initWorld();
initInput();
initFlow();
initTutorial();
initSound();
initSoundUI();
$('langBtn').onclick=()=>setLang(getLang()==='he'?'en':'he');
onLangChange(()=>{refreshBuild();renderControls();});
initCloudUI();
initLeaderboard();
initLeaderboardUI();
initTitle();
initRoomUI();
initVsUI();
resize();refreshBuild();
if(window.__skySkipTitle)toMenu();else toTitle(); // the flag is for tests that start in the workshop
handleRoomLink();
requestAnimationFrame(loop);
// cloud save starts in the background; merges are applied only outside battles
// (after the first paint, so the title screen never waits for Firebase)
const afterPaint=f=>requestAnimationFrame(()=>setTimeout(()=>window.requestIdleCallback?requestIdleCallback(f,{timeout:800}):f(),0));
afterPaint(()=>{
  initSync({canApply:()=>mode!=='play'&&mode!=='pause'&&!vsMode,onApplied:()=>{if(mode==='menu')refreshBuild();}});
  initAnalytics();
});
window.__sky={get G(){return G},get prog(){return prog},start,input,stats,build:()=>build,fort:()=>fort,setMode:m=>{setGameMode(m);refreshBuild();},press:k=>{if(k==='bomb')pressed.bomb=true;if(k==='flip')pressed.flip=true;},step:(n,dt)=>{for(let i=0;i<n;i++){if(G.state==='play'||G.state==='won'||G.state==='lost'){update(dt||1/60);tutorialTick(dt||1/60);}}},refresh:refreshBuild,tutorial:tutorialInfo,sound:soundInfo,lang:getLang,cloud:syncInfo,room:roomInfo};
