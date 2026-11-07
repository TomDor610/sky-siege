// In-memory stand-in for the Firebase backend (same interface as src/sync/firebase.js).
// Installed with page.addInitScript(installFakeCloud, init) before the game loads.
// State lives in localStorage['__fakecloud'] so it survives reloads within a test:
//   {docs:{uid:data}, user, online, delay, google:{uid,name}, googleCancel, n, saves, loads}
// Tests flip `online` or read `docs` through the helpers below.
export function installFakeCloud(init) {
  const K = '__fakecloud';
  if (!localStorage.getItem(K)) localStorage.setItem(K, JSON.stringify({ docs: {}, user: null, online: true, delay: 5, n: 0, saves: 0, loads: 0, ...init }));
  const get = () => JSON.parse(localStorage.getItem(K));
  const put = s => localStorage.setItem(K, JSON.stringify(s));
  const wait = () => new Promise(r => setTimeout(r, get().delay));
  const net = async () => { await wait(); if (!get().online) throw Object.assign(new Error('offline'), { code: 'unavailable' }); };
  const copy = v => JSON.parse(JSON.stringify(v));
  window.__skyCloudBackend = {
    async ready() { await wait(); return get().user; },
    async ensureUser() {
      if (get().user) return get().user;
      await net();
      const s = get(); s.n++; s.user = { uid: 'anon-' + s.n, isAnonymous: true, name: '' }; put(s); return s.user;
    },
    async load(uid) { await net(); const s = get(); s.loads++; put(s); return s.docs[uid] ? copy(s.docs[uid]) : null; },
    async save(uid, data) {
      await net();
      const s = get();
      if (!s.user || s.user.uid !== uid) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
      s.docs[uid] = { ...copy(data), updatedAt: Date.now() }; s.saves++; put(s);
    },
    // like linkWithPopup: keep the anonymous uid unless that Google account already has a save
    async signInGoogle() {
      await net();
      if (get().googleCancel) throw Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' });
      const s = get(), g = s.google || { uid: 'google-1', name: 'Test Player' };
      s.user = s.user && s.user.isAnonymous && !s.docs[g.uid] ? { ...s.user, isAnonymous: false, name: g.name } : { uid: g.uid, isAnonymous: false, name: g.name };
      put(s); return s.user;
    },
    async signOut() { const s = get(); s.user = null; put(s); },
  };
}

export const cloudState = page => page.evaluate(() => JSON.parse(localStorage.getItem('__fakecloud')));
export const setOnline = (page, online) => page.evaluate(on => {
  const s = JSON.parse(localStorage.getItem('__fakecloud')); s.online = on; localStorage.setItem('__fakecloud', JSON.stringify(s));
  if (on) dispatchEvent(new Event('online'));
}, online);
export const cloudStatus = page => page.evaluate(() => window.__sky.cloud());
