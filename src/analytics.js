// Title-screen analytics: which buttons players press.
// Firebase Analytics in cookieless mode, loaded in the background; events raised before it
// is ready wait in a small queue. Players can turn it off in Settings ('skysiege_analytics').
// Failures (ad blockers, no network, the claude.ai artifact) are silent: the game never waits.
// Tests inject an array as window.__skyAnalytics and read the events from it.
import {firebaseConfig} from './sync/config.js';
import {store} from './util.js';

const KEY='skysiege_analytics';
let backend=null,started=false,queue=[];

export const analyticsOn=()=>store.get(KEY)!=='0';

export function track(name,params={}){
  if(!analyticsOn())return;
  if(window.__skyAnalytics){window.__skyAnalytics.push({name,params});return;}
  if(backend){try{backend.log(name,params);}catch(e){}}
  else if(queue.length<50)queue.push([name,params]);
}

export async function initAnalytics(){
  if(started||window.__skyAnalytics||!analyticsOn()||navigator.webdriver)return;
  if(!firebaseConfig||!firebaseConfig.measurementId)return;
  started=true;
  try{
    const {createAnalytics}=await import('./sync/analytics-firebase.js');
    backend=await createAnalytics(firebaseConfig);
    if(!backend){queue=[];return;}
    for(const [n,p] of queue)backend.log(n,p);
    queue=[];
  }catch(e){backend=null;queue=[];}
}

export function setAnalyticsOn(on){
  store.set(KEY,on?'1':'0');
  if(backend){try{backend.enable(on);}catch(e){}}
  if(on)initAnalytics();else queue=[];
}
