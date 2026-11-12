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

// ---------------------------------------------------------------- stage 2: blind build
const LOAD = (round, over = {}) => ({ round, build: { style: 'classic', bombType: 'stone', wings: 2, props: 2, armor: 1, bombs: 4, crossbows: 0 }, fort: { s: ['ballista', '-', 'archers', '-', '-'], walls: 0 }, ...over }); // costs 145
const both = (meta = {}) => ({ meta: { v: 1, host: 'hana', guest: 'gil', createdAt: Date.now(), state: 'lobby', ...meta }, players: { hana: { name: 'Hana' }, gil: { name: 'Gil' } } });
const building = (over = {}) => both({ state: 'build', round: 1, buildEndsAt: Date.now() + 60000, ...over });

test('build: only the host starts it, with both players present, the next round and a ~60 s timer', async () => {
  await seed('rooms/ABCD', both());
  const start = (uid, v) => db(uid).ref('rooms/ABCD/meta').update(v);
  await assertFails(start('gil', { state: 'build', round: 1, buildEndsAt: Date.now() + 60000 }));
  await assertFails(start('hana', { state: 'build', round: 2, buildEndsAt: Date.now() + 60000 }));
  await assertFails(start('hana', { state: 'build', round: 1, buildEndsAt: Date.now() + 5 * 60000 }));
  await assertSucceeds(start('hana', { state: 'build', round: 1, buildEndsAt: Date.now() + 60000 }));
  await seed('rooms/EFGH', { meta: { v: 1, host: 'hana', createdAt: Date.now(), state: 'lobby' }, players: { hana: { name: 'H' } } });
  await assertFails(db('hana').ref('rooms/EFGH/meta').update({ state: 'build', round: 1, buildEndsAt: Date.now() + 60000 })); // alone
});

test('build: nobody joins a room in the middle of a match', async () => {
  await seed('rooms/ABCD', { meta: { v: 1, host: 'hana', createdAt: Date.now(), state: 'build', round: 1, buildEndsAt: Date.now() + 60000 }, players: { hana: { name: 'H' } } });
  await assertFails(db('late').ref('rooms/ABCD/meta/guest').set('late'));
});

test('build: each player writes only their own loadout, within the rules and the budget', async () => {
  await seed('rooms/ABCD', building());
  const mine = db('gil').ref('rooms/ABCD/loadouts/gil');
  await assertSucceeds(mine.set(LOAD(1)));
  await assertSucceeds(mine.set(LOAD(1, { fort: { s: ['mangonel', '-', 'archers', '-', '-'], walls: 0 } })));   // 155
  await assertFails(mine.set(LOAD(1, { fort: { s: ['ballista', '-', 'archers', '-', '-'], walls: 3 } })));    // 190 > 180
  await assertFails(mine.set(LOAD(1, { build: { ...LOAD(1).build, wings: 5 } })));
  await assertFails(mine.set(LOAD(1, { build: { ...LOAD(1).build, style: 'dragon' } })));
  await assertFails(mine.set(LOAD(1, { build: { ...LOAD(1).build, bombs: 2.5 } })));
  await assertFails(mine.set(LOAD(1, { build: { ...LOAD(1).build, admin: 1 } })));
  await assertFails(mine.set(LOAD(1, { fort: { s: ['cannon', '-', '-', '-', '-'], walls: 0 } })));
  await assertFails(mine.set(LOAD(1, { fort: { s: ['-', '-', '-', '-'], walls: 0 } })));
  await assertFails(mine.set(LOAD(2)));                                                                     // wrong round
  await assertFails(db('gil').ref('rooms/ABCD/loadouts/hana').set(LOAD(1)));
  await assertFails(db('outsider').ref('rooms/ABCD/loadouts/outsider').set(LOAD(1)));
});

test('blind: the opponent\'s loadout cannot be read before the reveal', async () => {
  await seed('rooms/ABCD', { ...building(), loadouts: { hana: LOAD(1), gil: LOAD(1) } });
  await assertSucceeds(db('gil').ref('rooms/ABCD/loadouts/gil').get());
  await assertFails(db('gil').ref('rooms/ABCD/loadouts/hana').get());
  await assertFails(db('gil').ref('rooms/ABCD/loadouts').get());
  await assertFails(db('outsider').ref('rooms/ABCD/loadouts/hana').get());
});

test('ready: only yourself, only for this round', async () => {
  await seed('rooms/ABCD', building());
  await assertSucceeds(db('gil').ref('rooms/ABCD/ready/gil').set(1));
  await assertSucceeds(db('gil').ref('rooms/ABCD/ready/gil').set(0));
  await assertFails(db('gil').ref('rooms/ABCD/ready/gil').set(2));
  await assertFails(db('gil').ref('rooms/ABCD/ready/hana').set(1));
  await assertSucceeds(db('hana').ref('rooms/ABCD/ready').get());
});

test('reveal: when both are ready (not before); then both loadouts are readable and locked', async () => {
  await seed('rooms/ABCD', { ...building(), loadouts: { hana: LOAD(1), gil: LOAD(1) }, ready: { hana: 1 } });
  await assertFails(db('gil').ref('rooms/ABCD/meta/state').set('reveal'));
  await assertSucceeds(db('gil').ref('rooms/ABCD/ready/gil').set(1));
  await assertSucceeds(db('gil').ref('rooms/ABCD/meta/state').set('reveal'));
  await assertSucceeds(db('gil').ref('rooms/ABCD/loadouts/hana').get());
  await assertSucceeds(db('hana').ref('rooms/ABCD/loadouts/gil').get());
  await assertFails(db('outsider').ref('rooms/ABCD/loadouts/gil').get());
  await assertFails(db('gil').ref('rooms/ABCD/loadouts/gil').set(LOAD(1, { fort: { s: ['mangonel', '-', '-', '-', '-'], walls: 0 } })));
  await assertFails(db('gil').ref('rooms/ABCD/ready/gil').set(0));
});

test('reveal: when the time is up, even if someone is not ready; late changes are refused', async () => {
  await seed('rooms/ABCD', { ...building({ buildEndsAt: Date.now() - 5000 }), loadouts: { hana: LOAD(1), gil: LOAD(1) } });
  await assertFails(db('gil').ref('rooms/ABCD/loadouts/gil').set(LOAD(1, { build: { ...LOAD(1).build, style: 'bat' } })));
  await assertSucceeds(db('hana').ref('rooms/ABCD/meta/state').set('reveal'));
});

test('back to the lobby: the host only', async () => {
  await seed('rooms/ABCD', building({ state: 'reveal' }));
  await assertFails(db('gil').ref('rooms/ABCD/meta/state').set('lobby'));
  await assertFails(db('gil').ref('rooms/ABCD/meta/state').set('build'));
  await assertSucceeds(db('hana').ref('rooms/ABCD/meta/state').set('lobby'));
});

// ---------------------------------------------------------------- stage 3: the battle
const fighting = (over = {}) => ({ ...building({ state: 'battle', battleAt: Date.now() - 1000, ...over }), loadouts: { hana: LOAD(1), gil: LOAD(1) } });
const PLANE_AT = t => ({ t, x: 500, y: 300, p: 0.2, f: 1, s: 260, hp: 80, vz: 0, dd: 0 });
// plane states carry the server time (within 10 s), so each use takes the time anew
const planeNow = () => PLANE_AT(Date.now());
const CASTLE = { hp: 200, h: '55337773355', d: '101', a: '0,3.14,1', f: 0 };

test('battle: only the host starts it, from the reveal, at the server\'s time; the host may clear the old battle', async () => {
  await seed('rooms/ABCD', { ...building({ state: 'reveal' }), battle: { rematch: { hana: 1 } } });
  const go = (uid, at) => db(uid).ref('rooms/ABCD/meta').update({ state: 'battle', battleAt: at });
  await assertFails(db('gil').ref('rooms/ABCD/battle').remove());
  await assertSucceeds(db('hana').ref('rooms/ABCD/battle').remove());
  await assertFails(go('gil', TS));
  await assertFails(go('hana', Date.now() + 3000));                                  // its own clock: no
  await assertFails(db('hana').ref('rooms/ABCD/meta/state').set('battle'));          // needs the start time
  await assertSucceeds(go('hana', TS));
  await assertFails(db('hana').ref('rooms/ABCD/battle').remove());                   // not once it started
  await seed('rooms/EFGH', building());
  await assertFails(db('hana').ref('rooms/EFGH/meta').update({ state: 'battle', battleAt: TS }));   // not from the build
});

test('battle: the seed is set by the host when the build starts', async () => {
  await seed('rooms/ABCD', both());
  await assertFails(db('hana').ref('rooms/ABCD/meta').update({ state: 'build', round: 1, buildEndsAt: Date.now() + 60000, seed: 'x' }));
  await assertSucceeds(db('hana').ref('rooms/ABCD/meta').update({ state: 'build', round: 1, buildEndsAt: Date.now() + 60000, seed: 12345 }));
  await assertFails(db('hana').ref('rooms/ABCD/meta/seed').set(7));                   // not in the middle of a build
});

test('battle: each player writes only their own plane, castle and events, and only during the battle', async () => {
  await seed('rooms/ABCD', fighting());
  const g = db('gil');
  await assertSucceeds(g.ref('rooms/ABCD/battle/plane/gil').set(planeNow()));
  await assertFails(g.ref('rooms/ABCD/battle/plane/hana').set(planeNow()));
  await assertFails(g.ref('rooms/ABCD/battle/plane/gil').set({ ...planeNow(), x: 'far' }));
  await assertFails(g.ref('rooms/ABCD/battle/plane/gil').set({ x: 1, y: 2 }));
  await assertSucceeds(g.ref('rooms/ABCD/battle/castle/gil').set(CASTLE));
  await assertFails(g.ref('rooms/ABCD/battle/castle/hana').set(CASTLE));
  await assertFails(g.ref('rooms/ABCD/battle/castle/gil').set({ ...CASTLE, hp: 5000 }));
  await assertFails(g.ref('rooms/ABCD/battle/castle/gil').set({ ...CASTLE, h: 'zz' }));
  await assertFails(g.ref('rooms/ABCD/battle/castle/gil').set({ ...CASTLE, d: '1111111' }));
  await assertFails(g.ref('rooms/ABCD/battle/castle/gil').set({ ...CASTLE, god: 1 }));
  const ev = g.ref('rooms/ABCD/battle/ev/gil').push();
  await assertSucceeds(ev.set({ k: 'b', t: 1, x: 1, y: 2, vx: 3, vy: 4 }));
  await assertFails(ev.set({ k: 'b', t: 1, x: 9, y: 9 }));                            // events are written once
  await assertFails(g.ref('rooms/ABCD/battle/ev/gil').push().set({ k: 'nuke', t: 1, x: 1, y: 2 }));
  await assertFails(g.ref('rooms/ABCD/battle/ev/gil').push().set({ k: 'b', t: 1, x: 1, y: 2, vx: 'fast' }));
  await assertFails(g.ref('rooms/ABCD/battle/ev/hana').push().set({ k: 'b', t: 1, x: 1, y: 2 }));
  await assertFails(db('outsider').ref('rooms/ABCD/battle/plane/outsider').set(planeNow()));
  await assertFails(db('outsider').ref('rooms/ABCD/battle').get());
  await assertSucceeds(db('hana').ref('rooms/ABCD/battle').get());
  await seed('rooms/EFGH', building({ state: 'reveal' }));
  await assertFails(db('gil').ref('rooms/EFGH/battle/plane/gil').set(planeNow()));
});

test('battle: a fall carries the server time and is written once; the final % only at the end', async () => {
  await seed('rooms/ABCD', fighting());
  await assertFails(db('gil').ref('rooms/ABCD/battle/fall/gil').set(12345));
  await assertFails(db('gil').ref('rooms/ABCD/battle/fall/hana').set(TS));
  await assertSucceeds(db('gil').ref('rooms/ABCD/battle/fall/gil').set(TS));
  await assertFails(db('gil').ref('rooms/ABCD/battle/fall/gil').set(TS));
  await assertFails(db('gil').ref('rooms/ABCD/battle/final/gil').set(50));            // 1 s into the battle
  await seed('rooms/EFGH', fighting({ battleAt: Date.now() - 154000 }));   // said go 154 s ago = 151 s of battle
  await assertFails(db('gil').ref('rooms/EFGH/battle/final/gil').set(120));
  await assertFails(db('gil').ref('rooms/EFGH/battle/final/hana').set(50));
  await assertSucceeds(db('gil').ref('rooms/EFGH/battle/final/gil').set(42.5));
  await assertFails(db('gil').ref('rooms/EFGH/battle/final/gil').set(99));
});

test('battle: another battle is asked for this round only; the loadouts stay readable and locked', async () => {
  await seed('rooms/ABCD', fighting());
  await assertFails(db('gil').ref('rooms/ABCD/battle/rematch/gil').set(2));
  await assertFails(db('gil').ref('rooms/ABCD/battle/rematch/hana').set(1));
  await assertSucceeds(db('gil').ref('rooms/ABCD/battle/rematch/gil').set(1));
  await assertSucceeds(db('gil').ref('rooms/ABCD/loadouts/hana').get());
  await assertFails(db('gil').ref('rooms/ABCD/loadouts/gil').set(LOAD(1)));
  await assertFails(db('gil').ref('rooms/ABCD/meta/state').set('lobby'));
  await assertSucceeds(db('hana').ref('rooms/ABCD/meta').update({ state: 'build', round: 2, buildEndsAt: Date.now() + 60000, seed: 9 }));   // the next build
});

test('battle: plane states must carry the current time', async () => {
  await seed('rooms/ABCD', fighting());
  await assertFails(db('gil').ref('rooms/ABCD/battle/plane/gil').set(PLANE_AT(1)));
  await assertFails(db('gil').ref('rooms/ABCD/battle/plane/gil').set(PLANE_AT(Date.now() + 60000)));
  await assertSucceeds(db('gil').ref('rooms/ABCD/battle/plane/gil').set(PLANE_AT(Date.now())));
});

// ---------------------------------------------------------------- stage 4: drops and emoji
const ago = s => Date.now() - s * 1000;

test('away: only yourself, with the server time, only in a battle; you can always clear it', async () => {
  await seed('rooms/ABCD', fighting());
  await assertFails(db('gil').ref('rooms/ABCD/battle/away/hana').set(TS));
  await assertFails(db('gil').ref('rooms/ABCD/battle/away/gil').set(12345));
  await assertSucceeds(db('gil').ref('rooms/ABCD/battle/away/gil').set(TS));
  await assertSucceeds(db('gil').ref('rooms/ABCD/battle/away/gil').remove());
  await seed('rooms/EFGH', { ...building(), battle: { away: { gil: ago(5) } } });
  await assertFails(db('gil').ref('rooms/EFGH/battle/away/gil').set(TS));          // not in a build
  await assertSucceeds(db('gil').ref('rooms/EFGH/battle/away/gil').remove());
});

test('technical loss: only after 20 s away, or 25 s without a word; never for yourself; once', async () => {
  const forfeit = (code, by, who) => db(by).ref(`rooms/${code}/battle/forfeit/${who}`).set(TS);
  await seed('rooms/ABCD', { ...fighting(), battle: { away: { gil: ago(10) }, plane: { gil: PLANE_AT(ago(10)) } } });
  await assertFails(forfeit('ABCD', 'hana', 'gil'));                                    // only 10 s
  await seed('rooms/EFGH', { ...fighting(), battle: { away: { gil: ago(21) }, plane: { gil: PLANE_AT(ago(21)) } } });
  await assertFails(forfeit('EFGH', 'gil', 'gil'));                                     // not yourself
  await assertFails(forfeit('EFGH', 'outsider', 'gil'));
  await assertFails(db('hana').ref('rooms/EFGH/battle/forfeit/gil').set(12345));       // server time only
  await assertSucceeds(forfeit('EFGH', 'hana', 'gil'));
  await assertFails(forfeit('EFGH', 'hana', 'gil'));                                    // once
  // silent: no away mark, but no plane state for 26 s
  await seed('rooms/IJKL', { ...fighting(), battle: { plane: { gil: PLANE_AT(ago(26)) } } });
  await assertSucceeds(forfeit('IJKL', 'hana', 'gil'));
  await seed('rooms/MNPQ', { ...fighting(), battle: { plane: { gil: PLANE_AT(ago(5)) } } });
  await assertFails(forfeit('MNPQ', 'hana', 'gil'));
  // never sent anything, 26 s after the start
  await seed('rooms/RSTU', fighting({ battleAt: ago(29) }));                          // 26 s into the battle
  await assertSucceeds(forfeit('RSTU', 'gil', 'hana'));
});

test('emoji: your own, one of 8, server time, at most one every 3 s', async () => {
  await seed('rooms/ABCD', fighting());
  const e = (uid, v) => db(uid).ref(`rooms/ABCD/battle/emoji/${uid}`).set(v);
  await assertFails(db('gil').ref('rooms/ABCD/battle/emoji/hana').set({ e: 1, t: TS }));
  await assertFails(e('gil', { e: 8, t: TS }));
  await assertFails(e('gil', { e: 1.5, t: TS }));
  await assertFails(e('gil', { e: 1, t: 12345 }));
  await assertFails(e('gil', { e: 1, t: TS, text: 'hi' }));
  await assertSucceeds(e('gil', { e: 1, t: TS }));
  await assertFails(e('gil', { e: 2, t: TS }));                                         // too soon
  await seed('rooms/ABCD/battle/emoji/gil', { e: 1, t: ago(4) });
  await assertSucceeds(e('gil', { e: 2, t: TS }));
  await seed('rooms/EFGH', building());
  await assertFails(db('gil').ref('rooms/EFGH/battle/emoji/gil').set({ e: 1, t: TS }));  // battles only
});

test('a host who never came back: the guest may close the room; the host may free a gone guest\'s seat', async () => {
  await seed('rooms/ABCD', { ...fighting(), battle: { away: { hana: ago(10) } } });
  await assertFails(db('gil').ref('rooms/ABCD').remove());                              // only 10 s
  await seed('rooms/ABCD/battle/away/hana', ago(21));
  await assertFails(db('outsider').ref('rooms/ABCD').remove());
  await assertSucceeds(db('gil').ref('rooms/ABCD').remove());
  await seed('rooms/EFGH', { ...fighting(), battle: { away: { gil: ago(10) } } });
  await assertFails(db('hana').ref('rooms/EFGH/players/gil').remove());
  await assertFails(db('hana').ref('rooms/EFGH/meta/guest').remove());
  await seed('rooms/EFGH/battle/away/gil', ago(21));
  await assertSucceeds(db('hana').ref('rooms/EFGH/players/gil').remove());
  await assertSucceeds(db('hana').ref('rooms/EFGH/meta/guest').remove());
});

test('a room in use (a guest joined) is not taken over when it gets old', async () => {
  await seed('rooms/ABCD', both({ createdAt: ago(11 * 60) }));
  await assertFails(db('mallory').ref('rooms/ABCD/meta').set(newMeta('mallory')));
});

test('an old room nobody joined can be taken over', async () => {
  await seed('rooms/EFGH', room({ createdAt: ago(11 * 60) }));
  await assertSucceeds(db('mallory').ref('rooms/EFGH/meta').set(newMeta('mallory')));
});

test('any room can be taken over after 6 hours (a forgotten room does not block its code forever)', async () => {
  await seed('rooms/HJKL', both({ createdAt: ago(6 * 3600 + 60) }));
  await assertSucceeds(db('mallory').ref('rooms/HJKL/meta').set(newMeta('mallory')));
});

test('the host cannot drop a guest who is still here from the players list', async () => {
  await seed('rooms/ABCD', fighting());
  await assertFails(db('hana').ref('rooms/ABCD/players').set({ hana: { name: 'Hana' } }));
  await assertSucceeds(db('hana').ref('rooms/ABCD/players').set({ hana: { name: 'Hana' }, gil: { name: 'Gil' } }));
});

test('a player who already lost by forfeit counts as gone: the seat can be freed, the room closed', async () => {
  // silent for 25 s (no away mark yet: the server may notice a lost Wi-Fi only after a minute)
  await seed('rooms/ABCD', { ...fighting(), battle: { forfeit: { gil: ago(2) } } });
  await assertSucceeds(db('hana').ref('rooms/ABCD/players/gil').remove());
  await assertSucceeds(db('hana').ref('rooms/ABCD/meta/guest').remove());
  await seed('rooms/EFGH', { ...fighting(), battle: { forfeit: { hana: ago(2) } } });
  await assertSucceeds(db('gil').ref('rooms/EFGH').remove());
  await seed('rooms/HJKL', fighting());                                                  // nobody lost: no
  await assertFails(db('hana').ref('rooms/HJKL/meta/guest').remove());
  await assertFails(db('gil').ref('rooms/HJKL').remove());
});
