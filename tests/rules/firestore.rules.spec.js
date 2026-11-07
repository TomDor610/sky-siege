// Security Rules tests against the Firestore emulator.
// Run with: npm run test:rules   (needs Java; starts the emulator via firebase-tools)
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

test.describe.configure({ mode: 'serial' });

let env;
test.beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sky-siege',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
test.afterAll(async () => { await env?.cleanup(); });
test.beforeEach(async () => { await env.clearFirestore(); });

const save = (over = {}) => ({
  v: 1,
  prog: { coins: 300, coinsEarned: 420, coinsSpent: 120, epoch: 0, xp: 150, upg: { frame: 1 }, styles: { classic: true }, unl: { crossbow: true }, wins: { easy: 2 }, duelWins: { easy: 1 }, best: { easy: 21.5 } },
  build: { style: 'classic', wings: 2, props: 2, armor: 1, bombs: 4, crossbows: 0, bombType: 'stone' },
  fort: { slots: ['ballista', null, 'archers', null, null], walls: 0 },
  buildAt: 1730000000000,
  updatedAt: serverTimestamp(),
  ...over,
});
const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

test('a player can create, read and update their own save', async () => {
  const me = db('alice');
  await assertSucceeds(setDoc(doc(me, 'users/alice'), save()));
  const snap = await assertSucceeds(getDoc(doc(me, 'users/alice')));
  expect(snap.data().prog.coins).toBe(300);
  await assertSucceeds(setDoc(doc(me, 'users/alice'), save({ prog: { ...save().prog, coins: 500, coinsEarned: 620 } })));
});

test("a player cannot read or write someone else's save", async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'users/bob'), { ...save(), updatedAt: new Date() }));
  const alice = db('alice');
  await assertFails(getDoc(doc(alice, 'users/bob')));
  await assertFails(setDoc(doc(alice, 'users/bob'), save()));
  await assertFails(setDoc(doc(alice, 'users/carol'), save()));
});

test('signed-out visitors can do nothing', async () => {
  const anon = db(null);
  await assertFails(getDoc(doc(anon, 'users/alice')));
  await assertFails(setDoc(doc(anon, 'users/alice'), save()));
});

test('saves cannot be deleted, even by their owner', async () => {
  const me = db('alice');
  await assertSucceeds(setDoc(doc(me, 'users/alice'), save()));
  await assertFails(deleteDoc(doc(me, 'users/alice')));
});

test('malformed saves are rejected', async () => {
  const me = db('alice'), ref = doc(me, 'users/alice');
  await assertFails(setDoc(ref, { ...save(), isAdmin: true }));                       // unknown top-level field
  await assertFails(setDoc(ref, { ...save(), prog: { ...save().prog, hacked: 1 } })); // unknown progress field
  await assertFails(setDoc(ref, { ...save(), prog: { ...save().prog, coins: 'lots' } }));
  await assertFails(setDoc(ref, { ...save(), v: 'one' }));
  await assertFails(setDoc(ref, { ...save(), updatedAt: new Date(0) }));               // must be the server time
  const { fort, ...noFort } = save();
  await assertFails(setDoc(ref, noFort));                                             // required field missing
  await assertFails(setDoc(ref, { ...save(), fort: { slots: Array(9).fill('ballista'), walls: 0 } }));
});

test('nothing outside users/{uid} is reachable', async () => {
  const me = db('alice');
  await assertFails(setDoc(doc(me, 'leaderboard/alice'), { score: 1 }));
  await assertFails(getDoc(doc(me, 'users/alice/secret/x')));
});

// ---------------------------------------------------------------- leaderboard
const score = (lvl, best) => (lvl === 0 ? 0 : lvl * 100000 + 99999 - Math.round(best * 10));
const row = (uid, over = {}) => {
  const lvl = { easy: 4, medium: 1, hard: 0 }, best = { easy: 21.4, medium: 48, hard: 0 };
  return {
    name: 'Tom', code: uid.toUpperCase().slice(0, 8), rank: 4, lvl, best, duelWins: 6,
    score: { easy: score(4, 21.4), medium: score(1, 48), hard: 0, duel: 6 },
    friends: [], updatedAt: serverTimestamp(), ...over,
  };
};
const hidden = uid => ({ ...row(uid), name: '', score: { easy: -1, medium: -1, hard: -1, duel: -1 }, lvl: { easy: 0, medium: 0, hard: 0 }, best: { easy: 0, medium: 0, hard: 0 }, duelWins: 0 });
const lbRef = (uid, path) => doc(db(uid), 'leaderboard/' + path);

test('leaderboard: everyone (even signed out) can read; a player writes only their own row', async () => {
  await assertSucceeds(setDoc(lbRef('alice', 'alice'), row('alice')));
  await assertSucceeds(getDoc(doc(db(null), 'leaderboard/alice')));
  await assertSucceeds(getDoc(doc(db('bob'), 'leaderboard/alice')));
  await assertFails(setDoc(lbRef('bob', 'alice'), row('alice')));
  await assertFails(setDoc(lbRef(null, 'alice'), row('alice')));
  await assertFails(deleteDoc(lbRef('alice', 'alice')));
});

test('leaderboard: implausible values are rejected', async () => {
  const ref = lbRef('alice', 'alice'), r = row('alice');
  const bad = {
    'negative time': { best: { ...r.best, easy: -5 } },
    'impossibly fast time': { best: { ...r.best, easy: 1 }, score: { ...r.score, easy: score(4, 1) } },
    'rank above the maximum': { rank: 21 },
    'rank zero': { rank: 0 },
    'level out of range': { lvl: { ...r.lvl, easy: 501 }, score: { ...r.score, easy: score(501, 21.4) } },
    'level beaten but no time': { best: { ...r.best, easy: 0 }, score: { ...r.score, easy: score(4, 0) } },
    'time without a level': { best: { ...r.best, hard: 30 } },
    'score that does not match': { score: { ...r.score, easy: 9999999 } },
    'duel score that does not match': { score: { ...r.score, duel: 99 } },
    'negative duel wins': { duelWins: -1, score: { ...r.score, duel: -1 } },
    'name too long': { name: 'x'.repeat(17) },
    'name too short': { name: 'x' },
    'name with markup': { name: '<b>Tom</b>' },
    "someone else's friend code": { code: 'BOBXXXXX' },
    'too many friends': { friends: Array.from({ length: 201 }, (_, i) => 'f' + i) },
    'extra field': { admin: true },
    'client-side timestamp': { updatedAt: new Date() },
  };
  for (const [what, over] of Object.entries(bad)) {
    await assertFails(setDoc(ref, { ...r, ...over })).catch(() => { throw new Error('accepted: ' + what); });
  }
  await assertSucceeds(setDoc(ref, { ...r, name: 'טום הממציא' }));
});

test('leaderboard: leaving the board writes a hidden row; scores must then be -1', async () => {
  await assertSucceeds(setDoc(lbRef('carol', 'carol'), hidden('carol')));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'leaderboard/dave'), { ...row('dave'), updatedAt: new Date(Date.now() - 60000) }));
  await assertFails(setDoc(lbRef('dave', 'dave'), { ...hidden('dave'), score: { easy: 5, medium: -1, hard: -1, duel: -1 } }));
});

test('leaderboard: at most one write every 20 seconds', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'leaderboard/erin'), { ...row('erin'), updatedAt: new Date(Date.now() - 60000) }));
  await assertSucceeds(setDoc(lbRef('erin', 'erin'), row('erin', { duelWins: 7, score: { ...row('erin').score, duel: 7 } })));
  await assertFails(setDoc(lbRef('erin', 'erin'), row('erin', { duelWins: 8, score: { ...row('erin').score, duel: 8 } })));
});

test('users/{uid} still accepts the nickname and friends list', async () => {
  const me = db('alice');
  await assertSucceeds(setDoc(doc(me, 'users/alice'), save({ prog: { ...save().prog, nick: 'Tom', friends: ['bob'] } })));
  await assertFails(setDoc(doc(me, 'users/alice'), save({ prog: { ...save().prog, nick: 'x'.repeat(40) } })));
});
