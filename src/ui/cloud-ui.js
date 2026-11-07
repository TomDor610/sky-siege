// Cloud save status line + "Sign in with Google" / "Sign out" in the workshop.
// Hidden when sync is off (no Firebase config).
import {onLangChange,t} from '../i18n/index.js';
import {info,onSyncChange,signInGoogle,signOutCloud} from '../sync/index.js';
import {$} from '../util.js';

function render(s){
  $('cloudBox').classList.toggle('hidden',s.status==='off');
  if(s.status==='off')return;
  const google=s.uid&&s.isAnonymous===false;
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
