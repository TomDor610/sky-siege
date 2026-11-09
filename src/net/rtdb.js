// Firebase Realtime Database access for private rooms (loaded only when entering a room).
// The connection is opened on entering a room and closed on leaving: the free plan allows
// 100 simultaneous connections, so players on other screens must not hold one.
//
// rooms/{CODE}/meta     {v, host, guest?, createdAt, state}  readable by anyone with the code
// rooms/{CODE}/players  {uid: {name}}                        participants only; the presence list
import {getApp,getApps,initializeApp} from 'firebase/app';
import {connectDatabaseEmulator,get,getDatabase,goOffline,goOnline,onDisconnect,onValue,ref,remove,runTransaction,serverTimestamp,set} from 'firebase/database';

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
        if(cur&&cur.createdAt>=limit)return undefined;
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
    async leaveSeat(code,uid){
      await onDisconnect(R(code,`/players/${uid}`)).cancel();
      await onDisconnect(R(code,'/meta/guest')).cancel();
      await remove(R(code,`/players/${uid}`));
      await remove(R(code,'/meta/guest'));
    },
  };
}
