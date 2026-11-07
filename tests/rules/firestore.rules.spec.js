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
