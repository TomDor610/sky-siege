// Cloud save: account badge in the menu header (Guest / Saved to cloud ✓), status line and
// "Save progress to your Google account" / "Sign out" in the workshop.
// Hidden when sync is off (no Firebase config).
import {onLangChange,t} from '../i18n/index.js';
import {info,onSyncChange,signInGoogle,signOutCloud} from '../sync/index.js';
import {$} from '../util.js';

function render(s){
  const off=s.status==='off',google=!!s.uid&&s.isAnonymous===false;
  $('cloudBox').classList.toggle('hidden',off);
  // small account badge in the menu header: "Saved to cloud ✓" (Google) or "Guest"
  const badge=$('acctBadge');
  badge.classList.toggle('hidden',off);badge.classList.toggle('cloud',google);badge.classList.toggle('guest',!google);
  badge.textContent=google?t('cloud.badgeCloud'):t('cloud.badgeGuest');
  badge.title=google?t('cloud.badgeCloudTitle',{name:s.name||'Google'}):t('cloud.badgeGuestTitle');
  if(off)return;
  $('cloudStatus').textContent=s.status==='saved'?(google&&s.name?t('cloud.savedAs',{name:s.name}):t('cloud.saved'))
    :s.status==='offline'?t('cloud.offline'):s.status==='error'?t('cloud.error'):t('cloud.syncing');
  const btn=$('googleBtn');
  btn.textContent=google?t('cloud.signOut'):t('cloud.google');
  btn.disabled=s.status==='syncing';
}

export function initCloudUI(){
  $('googleBtn').onclick=async()=>{
    const s=info();
    try{if(s.uid&&s.isAnonymous===false)await signOutCloud();else await signInGoogle();}
    catch(e){/* popup closed or blocked: status already shows the error */}
    render(info());
  };
  onSyncChange(render);
  onLangChange(()=>render(info()));
  render(info());
}
