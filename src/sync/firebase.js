// Firebase backend for src/sync/index.js (loaded on demand, only when a config exists).
// Firestore "lite": plain request/response, no offline cache — offline-first is handled
// by our own localStorage save, which keeps the bundle small.
import {initializeApp} from 'firebase/app';
import {GoogleAuthProvider,getAuth,linkWithPopup,onAuthStateChanged,signInAnonymously,signInWithCredential,signInWithPopup,signOut} from 'firebase/auth';
import {collection,doc,documentId,getCount,getDoc,getDocs,getFirestore,limit,orderBy,query,serverTimestamp,setDoc,where} from 'firebase/firestore/lite';

export function createBackend(config){
  const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
  const lb=()=>collection(db,'leaderboard');
  const rows=snap=>snap.docs.map(d=>({uid:d.id,...d.data()}));
  const toUser=u=>u&&{uid:u.uid,isAnonymous:u.isAnonymous,name:u.displayName||(u.providerData[0]&&u.providerData[0].displayName)||''};
  return {
    // resolves once Firebase has restored (or not) a previous session — works offline
    ready:()=>new Promise(res=>{const off=onAuthStateChanged(auth,u=>{off();res(toUser(u));});}),
    async ensureUser(){
      if(auth.currentUser)return toUser(auth.currentUser);
      return toUser((await signInAnonymously(auth)).user);
    },
    async load(uid){const s=await getDoc(doc(db,'users',uid));return s.exists()?s.data():null;},
    async save(uid,data){await setDoc(doc(db,'users',uid),{...data,updatedAt:serverTimestamp()});},
    // Anonymous player: link Google to the same uid (progress stays put). If that Google
    // account already has a save, sign into it instead; the next sync merges both.
    async signInGoogle(){
      const provider=new GoogleAuthProvider(),cur=auth.currentUser;
      if(cur&&cur.isAnonymous){
        try{return toUser((await linkWithPopup(cur,provider)).user);}
        catch(e){
          const cred=(e.code==='auth/credential-already-in-use'||e.code==='auth/email-already-in-use')&&GoogleAuthProvider.credentialFromError(e);
          if(cred)return toUser((await signInWithCredential(auth,cred)).user);
          throw e;
        }
      }
      return toUser((await signInWithPopup(auth,provider)).user);
    },
    async signOut(){await signOut(auth);},

    // ---- leaderboard (public collection leaderboard/{uid}; see firestore.rules)
    async lbSave(uid,row){await setDoc(doc(db,'leaderboard',uid),{...row,updatedAt:serverTimestamp()});},
    async lbTop(view,n){return rows(await getDocs(query(lb(),orderBy(`score.${view}`,'desc'),limit(n))));},
    // 1 + number of players with a higher score (an aggregate count: ~1 read per 1000 rows)
    async lbPlace(view,score){return 1+(await getCount(query(lb(),where(`score.${view}`,'>',score)))).data().count;},
    async lbGet(uids){
      const out=[];
      for(let i=0;i<uids.length;i+=30)out.push(...rows(await getDocs(query(lb(),where(documentId(),'in',uids.slice(i,i+30))))));
      return out;
    },
    async lbFollowers(uid){return rows(await getDocs(query(lb(),where('friends','array-contains',uid),limit(100))));},
    async lbByCode(code){return rows(await getDocs(query(lb(),where('code','==',code),limit(1))))[0]||null;},
  };
}
