// Realtime Database rules for private rooms, against the emulator.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

test.describe.configure({ mode: 'serial' });

let env;
test.beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sky-siege',
    database: { rules: readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});
test.afterAll(async () => { await env?.cleanup(); });
test.beforeEach(async () => { await env.clearDatabase(); });

const TS = { '.sv': 'timestamp' };
const newMeta = (uid, over = {}) => ({ v: 1, host: uid, createdAt: TS, state: 'lobby', ...over });
const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();
const seed = (path, value) => env.withSecurityRulesDisabled(c => c.database().ref(path).set(value));
const room = (over = {}) => ({ meta: { v: 1, host: 'hana', createdAt: Date.now(), state: 'lobby', ...over }, players: { hana: { name: 'Hana' } } });
const oldTime = () => Date.now() - 11 * 60 * 1000;

test('a signed-in player can open a room; a signed-out visitor cannot', async () => {
  await assertSucceeds(db('hana').ref('rooms/ABCD/meta').set(newMeta('hana')));
  await assertFails(db(null).ref('rooms/EFGH/meta').set(newMeta('x')));
});

test('a room cannot be opened in someone else\'s name, or with a bad code or shape', async () => {
  const me = db('hana');
  await assertFails(me.ref('rooms/ABCD/meta').set(newMeta('other')));
  for (const code of ['abcd', 'ABC', 'ABCDE', 'ABCI', 'AB1D']) await assertFails(me.ref(`rooms/${code}/meta`).set(newMeta('hana')));
  await assertFails(me.ref('rooms/ABCD/meta').set(newMeta('hana', { createdAt: 12345 })));   // must be server time
  await assertFails(me.ref('rooms/ABCD/meta').set(newMeta('hana', { state: 'won' })));
  await assertFails(me.ref('rooms/ABCD/meta').set(newMeta('hana', { extra: 1 })));
  await assertFails(me.ref('rooms/ABCD/meta').set({ v: 1, host: 'hana' }));
  await assertFails(me.ref('rooms/ABCD/other').set(1));
});

test('a live room cannot be taken over; an expired one can', async () => {
  await seed('rooms/ABCD', room());
  await assertFails(db('mallory').ref('rooms/ABCD/meta').set(newMeta('mallory')));
  await seed('rooms/EFGH', room({ createdAt: oldTime() }));
  await assertSucceeds(db('newhost').ref('rooms/EFGH/meta').set(newMeta('newhost')));
});

test('the guest seat: free, only for yourself, never your own room, never twice', async () => {
  await seed('rooms/ABCD', room());
  await assertFails(db('gil').ref('rooms/ABCD/meta/guest').set('someone-else'));
  await assertFails(db('hana').ref('rooms/ABCD/meta/guest').set('hana'));
  await assertFails(db(null).ref('rooms/ABCD/meta/guest').set('gil'));
  await assertSucceeds(db('gil').ref('rooms/ABCD/meta/guest').set('gil'));
  await assertSucceeds(db('gil').ref('rooms/ABCD/meta/guest').set('gil'));               // retrying is harmless
  await assertFails(db('third').ref('rooms/ABCD/meta/guest').set('third'));
  await assertFails(db('third').ref('rooms/ABCD/meta/guest').remove());                  // cannot evict the guest
  await assertSucceeds(db('gil').ref('rooms/ABCD/meta/guest').remove());
});

test('an expired room has no free seat', async () => {
  await seed('rooms/ABCD', room({ createdAt: oldTime() }));
  await assertFails(db('gil').ref('rooms/ABCD/meta/guest').set('gil'));
});

test('reading: the room\'s basics with the code, the players only for participants, no listing', async () => {
  await seed('rooms/ABCD', room({ guest: 'gil' }));
  await assertSucceeds(db('outsider').ref('rooms/ABCD/meta').get());
  await assertFails(db(null).ref('rooms/ABCD/meta').get());
  await assertFails(db('outsider').ref('rooms/ABCD/players').get());
  await assertSucceeds(db('hana').ref('rooms/ABCD/players').get());
  await assertSucceeds(db('gil').ref('rooms/ABCD/players').get());
  await assertFails(db('hana').ref('rooms').get());
  await assertFails(db('outsider').ref('rooms/ABCD').get());
});

test('players: only participants, only their own entry, plausible names', async () => {
  await seed('rooms/ABCD', room({ guest: 'gil' }));
  const gil = db('gil').ref('rooms/ABCD/players/gil');
  await assertSucceeds(gil.set({ name: 'טום הממציא' }));
  await assertSucceeds(gil.set({ name: '' }));                                             // a guest with no nickname
  await assertFails(gil.set({ name: 'x'.repeat(17) }));
  await assertFails(gil.set({ name: '<b>x</b>' }));
  await assertFails(gil.set({ name: 'ok', admin: true }));
  await assertFails(db('gil').ref('rooms/ABCD/players/hana').set({ name: 'Hacked' }));
  await assertFails(db('outsider').ref('rooms/ABCD/players/outsider').set({ name: 'Spy' }));
  await assertSucceeds(gil.remove());
});

test('closing: only the host can delete the room', async () => {
  await seed('rooms/ABCD', room({ guest: 'gil' }));
  await assertFails(db('gil').ref('rooms/ABCD').remove());
  await assertFails(db('outsider').ref('rooms/ABCD').remove());
  await assertFails(db('hana').ref('rooms/ABCD').set({ meta: newMeta('hana') }));          // replacing is not deleting
  await assertSucceeds(db('hana').ref('rooms/ABCD').remove());
});

test('nothing outside rooms/ is reachable', async () => {
  await assertFails(db('hana').ref('other/x').set(1));
  await assertFails(db('hana').ref('other/x').get());
  expect(true).toBe(true);
});
