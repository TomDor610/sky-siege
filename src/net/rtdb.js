// Firebase Realtime Database access for private rooms (loaded only when entering a room).
// The connection is opened on entering a room and closed on leaving: the free plan allows
// 100 simultaneous connections, so players on other screens must not hold one.
//
// rooms/{CODE}/meta     {v, host, guest?, createdAt, state}  readable by anyone with the code
// rooms/{CODE}/players  {uid: {name}}                        participants only; the presence list
// rooms/{CODE}/ready    {uid: round}                         participants only (0 = not ready)
// rooms/{CODE}/loadouts {uid: {round, build, fort}}          owner only until the reveal
// rooms/{CODE}/battle   plane/ev/castle/fall/final/rematch/away/emoji, each {uid: ...}, written by its
//                       owner; forfeit/{uid} written by the other player
import {getApp,getApps,initializeApp} from 'firebase/app';
import {connectDatabaseEmulator,get,getDatabase,goOffline,goOnline,onChildAdded,onDisconnect,onValue,push,ref,remove,runTransaction,serverTimestamp,set,update} from 'firebase/database';

const TAKEN_MS=6*3600*1000;

export function createRtdb(config,emu){
  const app=getApps().length?getApp():initializeApp(config),db=getDatabase(app);
  if(emu)connectDatabaseEmulator(db,emu.database[0],emu.database[1]);
  let offset=0;
  const stopOffset=onValue(ref(db,'.info/serverTimeOffset'),s=>{offset=s.val()||0;});
  const R=(code,tail='')=>ref(db,`rooms/${code}${tail}`);
  return {
    now:()=>Date.now()+offset,
    online:()=>goOnline(db),
    offline:()=>goOffline(db),
    stop:()=>stopOffset(),
    onConnected:f=>onValue(ref(db,'.info/connected'),s=>f(!!s.val())),

    // Claim a free code. false = the code is taken by a live room.
    async createRoom(code,uid,name,ttl){
      const limit=Date.now()+offset-ttl;
      const r=await runTransaction(R(code,'/meta'),cur=>{
        // taken: a live room, or an old one somebody joined (until 6 h; same as the rules)
        if(cur&&(cur.createdAt>=limit||(cur.guest&&cur.createdAt>=Date.now()+offset-TAKEN_MS)))return undefined;
        return {v:1,host:uid,createdAt:serverTimestamp(),state:'lobby'};
      },{applyLocally:false});
      if(!r.committed)return false;
      await set(R(code,'/players'),{[uid]:{name}});
      await onDisconnect(R(code)).remove();
      return true;
    },
    async readMeta(code){return (await get(R(code,'/meta'))).val();},
    // Take the guest seat. false = someone else got there first.
    async takeGuestSeat(code,uid,name){
      const r=await runTransaction(R(code,'/meta/guest'),cur=>(cur&&cur!==uid?undefined:uid),{applyLocally:false});
      if(!r.committed)return false;
      await set(R(code,`/players/${uid}`),{name});
      await onDisconnect(R(code,`/players/${uid}`)).remove();
      await onDisconnect(R(code,'/meta/guest')).remove();
      return true;
    },
    watchMeta:(code,f)=>onValue(R(code,'/meta'),s=>f(s.val()),()=>f(null)),
    watchPlayers:(code,f)=>onValue(R(code,'/players'),s=>f(s.val()||{}),()=>{}),
    async closeRoom(code){await onDisconnect(R(code)).cancel();await remove(R(code));},
    // ---- blind build (stage 2)
    startBuild:(code,round,endsAt,seed)=>update(R(code,'/meta'),{state:'build',round,buildEndsAt:endsAt,seed}),
    setState:(code,state)=>set(R(code,'/meta/state'),state),
    saveLoadout:(code,uid,l)=>set(R(code,`/loadouts/${uid}`),l),
    setReady:(code,uid,round)=>set(R(code,`/ready/${uid}`),round),
    watchReady:(code,f)=>onValue(R(code,'/ready'),s=>f(s.val()||{}),()=>{}),
    async readLoadout(code,uid){return (await get(R(code,`/loadouts/${uid}`))).val();},
    // ---- battle (stage 3)
    clearBattle:code=>remove(R(code,'/battle')),
    startBattle:code=>update(R(code,'/meta'),{state:'battle',battleAt:serverTimestamp()}),
    setPlane:(code,uid,s)=>set(R(code,`/battle/plane/${uid}`),s),
    pushEvent:(code,uid,e)=>push(R(code,`/battle/ev/${uid}`),e),
    setCastle:(code,uid,c)=>set(R(code,`/battle/castle/${uid}`),c),
    setFall:(code,uid)=>set(R(code,`/battle/fall/${uid}`),serverTimestamp()),
    setFinal:(code,uid,pct)=>set(R(code,`/battle/final/${uid}`),pct),
    setRematch:(code,uid,round)=>set(R(code,`/battle/rematch/${uid}`),round),
    watchPlane:(code,uid,f)=>onValue(R(code,`/battle/plane/${uid}`),s=>f(s.val()),()=>{}),
    watchEvents:(code,uid,f)=>onChildAdded(R(code,`/battle/ev/${uid}`),s=>f(s.key,s.val()),()=>{}),
    watchCastle:(code,uid,f)=>onValue(R(code,`/battle/castle/${uid}`),s=>f(s.val()),()=>{}),
    watchNode:(code,name,f)=>onValue(R(code,`/battle/${name}`),s=>f(s.val()||{}),()=>{}),
    // ---- disconnects (stage 4): during a battle a drop marks the player away instead of closing
    // the room (host) or freeing the seat (guest), so the friend can wait 20 s for them
    async presenceBattle(code,uid,role){
      if(role==='host')await onDisconnect(R(code)).cancel();
      else{await onDisconnect(R(code,`/players/${uid}`)).cancel();await onDisconnect(R(code,'/meta/guest')).cancel();}
      await onDisconnect(R(code,`/battle/away/${uid}`)).set(serverTimestamp());
    },
    async presenceRoom(code,uid,role){
      await onDisconnect(R(code,`/battle/away/${uid}`)).cancel();
      await remove(R(code,`/battle/away/${uid}`));
      if(role==='host')await onDisconnect(R(code)).remove();
      else{await onDisconnect(R(code,`/players/${uid}`)).remove();await onDisconnect(R(code,'/meta/guest')).remove();}
    },
    markAway:(code,uid)=>set(R(code,`/battle/away/${uid}`),serverTimestamp()),
    // back after a drop: the server has already run the old onDisconnect, so it is set again
    async markBack(code,uid){await remove(R(code,`/battle/away/${uid}`));await onDisconnect(R(code,`/battle/away/${uid}`)).set(serverTimestamp());},
    setForfeit:(code,uid)=>set(R(code,`/battle/forfeit/${uid}`),serverTimestamp()),
    sendEmoji:(code,uid,e)=>set(R(code,`/battle/emoji/${uid}`),{e,t:serverTimestamp()}),
    watchEmoji:(code,uid,f)=>onValue(R(code,`/battle/emoji/${uid}`),s=>f(s.val()),()=>{}),
    // the host frees the seat of a guest who never came back
    async evict(code,uid){await remove(R(code,`/players/${uid}`));await remove(R(code,'/meta/guest'));},
    async leaveSeat(code,uid){
      await onDisconnect(R(code,`/players/${uid}`)).cancel();
      await onDisconnect(R(code,'/meta/guest')).cancel();
      await remove(R(code,`/players/${uid}`));
      await remove(R(code,'/meta/guest'));
    },
  };
}
