// Firebase Analytics backend for src/analytics.js (loaded on demand).
// Consent is denied before Analytics starts, so no analytics or advertising cookies are stored.
import {getApp,getApps,initializeApp} from 'firebase/app';
import {getAnalytics,isSupported,logEvent,setAnalyticsCollectionEnabled,setConsent} from 'firebase/analytics';

export async function createAnalytics(config){
  if(!(await isSupported()))return null;
  setConsent({analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  const app=getApps().length?getApp():initializeApp(config),a=getAnalytics(app);
  return {log:(name,params)=>logEvent(a,name,params),enable:on=>setAnalyticsCollectionEnabled(a,on)};
}
