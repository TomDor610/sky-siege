// Private rooms: two real browsers, the real SDK and rules, the Firebase emulators.
import { test, expect } from '@playwright/test';
import { joinPlayer, createRoom, joinByCode, cutNetwork, seedRoom, readRoom } from './helpers.js';

const msg = p => p.page.locator('#roomMsg');
const status = p => p.page.locator('#roomStatus');
const players = p => p.page.locator('.roomPlayer');
const WAIT = { timeout: 15_000 };
let all = [];
const make = async (browser, info, opts) => { const p = await joinPlayer(browser, info, opts); all.push(p); return p.open(); };
test.afterEach(async () => {
  const errors = all.flatMap(p => p.errors);
  await Promise.all(all.map(p => p.close().catch(() => {})));
  all = [];
  expect(errors).toEqual([]);
});

test('a guest joins with the invite link; both see each other', async ({ browser }, info) => {
  const host = await make(browser, info), guest = await joinPlayer(browser, info);
  all.push(guest);
  const code = await createRoom(host);
  expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
  await expect(status(host)).toHaveText('ממתין לחבר…');
  await expect(players(host)).toHaveCount(1);
  await expect(players(host)).toContainText('אורח (אתה)');
  await expect(host.page.locator('#roomInvite')).toBeVisible();

  await guest.open(`/?room=${code}`);
  await expect(guest.page.locator('#roomLobby')).toBeVisible(WAIT);
  expect(new URL(guest.page.url()).search).toBe('');                  // the code leaves the address bar
  await expect(status(guest)).toHaveText('שני השחקנים בחדר');
  await expect(status(host)).toHaveText('שני השחקנים בחדר', WAIT);
  await expect(players(host)).toHaveCount(2);
  await expect(players(guest)).toHaveCount(2);
  await expect(host.page.locator('#roomInvite')).toBeHidden();        // no one left to invite
});

test('join by typing the code, in lower case; nicknames are shown', async ({ browser }, info) => {
  const host = await joinPlayer(browser, info, { seed: { coins: 300, xp: 40, upg: {}, styles: { classic: true }, unl: {}, wins: {}, duelWins: {}, best: {}, nick: 'טום' } });
  all.push(host); await host.open();
  const guest = await make(browser, info);
  const code = await createRoom(host);
  await joinByCode(guest, code.toLowerCase());
  await expect(status(host)).toHaveText('שני השחקנים בחדר', WAIT);
  await expect(players(guest).first()).toContainText('טום');
  await expect(players(guest).first()).toContainText('מארח');
  await expect(players(guest).nth(1)).toContainText('אורח (אתה)');
});

test('wrong codes and a full room are explained', async ({ browser }, info) => {
  const host = await make(browser, info), guest = await make(browser, info), third = await make(browser, info);
  const code = await createRoom(host);
  await third.page.click('#ttlFriend');
  await third.page.fill('#roomCodeIn', 'AB');
  await third.page.click('#roomJoin');
  await expect(msg(third)).toHaveText('קוד חדר הוא 4 אותיות באנגלית');
  await third.page.fill('#roomCodeIn', 'ZZZZ');
  await third.page.click('#roomJoin');
  await expect(msg(third)).toHaveText('לא נמצא חדר עם הקוד הזה', WAIT);
  await joinByCode(guest, code);
  await expect(status(host)).toHaveText('שני השחקנים בחדר', WAIT);
  await third.page.fill('#roomCodeIn', code);
  await third.page.click('#roomJoin');
  await expect(msg(third)).toHaveText('החדר מלא', WAIT);
});

test('opening your own link says so', async ({ browser }, info) => {
  const host = await make(browser, info);
  const code = await createRoom(host);
  const tab = await host.ctx.newPage();                                // same account, second tab
  await tab.goto(`/?room=${code}`);
  await expect(tab.locator('#roomMsg')).toHaveText('זה החדר שלך. שלח את הקישור לחבר', WAIT);
});

test('when the guest leaves, the seat is free again', async ({ browser }, info) => {
  const host = await make(browser, info), guest = await make(browser, info), next = await make(browser, info);
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(status(host)).toHaveText('שני השחקנים בחדר', WAIT);
  await guest.page.click('#roomLeave');
  await expect(guest.page.locator('#roomMenu')).toBeVisible();
  await expect(status(host)).toHaveText('ממתין לחבר…', WAIT);
  await expect(players(host)).toHaveCount(1);
  await joinByCode(next, code);
  await expect(status(host)).toHaveText('שני השחקנים בחדר', WAIT);
});

test('when the host leaves, the room closes for the guest and is gone', async ({ browser }, info) => {
  const host = await make(browser, info), guest = await make(browser, info), late = await make(browser, info);
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(status(guest)).toHaveText('שני השחקנים בחדר', WAIT);
  await host.page.click('#roomLeave');
  await expect(msg(guest)).toHaveText('המארח עזב את החדר', WAIT);
  expect(await readRoom(code)).toBeNull();
  await joinByCode(late, code);
  await expect(msg(late)).toHaveText('לא נמצא חדר עם הקוד הזה', WAIT);
});

test('host closes the browser: the guest is told', async ({ browser }, info) => {
  const host = await make(browser, info), guest = await make(browser, info);
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(status(guest)).toHaveText('שני השחקנים בחדר', WAIT);
  await host.close();
  await expect(msg(guest)).toHaveText('המארח עזב את החדר', WAIT);
  await expect.poll(() => readRoom(code), WAIT).toBeNull();
});

test('guest closes the browser: the host goes back to waiting', async ({ browser }, info) => {
  const host = await make(browser, info), guest = await make(browser, info);
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(status(host)).toHaveText('שני השחקנים בחדר', WAIT);
  await guest.close();
  await expect(status(host)).toHaveText('ממתין לחבר…', WAIT);
  await expect(players(host)).toHaveCount(1);
});

test('works with a 200 ms round trip', async ({ browser }, info) => {
  const host = await make(browser, info, { lag: 100 }), guest = await make(browser, info, { lag: 100 });
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(status(guest)).toHaveText('שני השחקנים בחדר', WAIT);
  await expect(status(host)).toHaveText('שני השחקנים בחדר', WAIT);
  await guest.page.click('#roomLeave');
  await expect(status(host)).toHaveText('ממתין לחבר…', WAIT);
});

test('losing the network: the host is told, and so is the guest', async ({ browser }, info) => {
  const host = await make(browser, info, { lag: 1 }), guest = await make(browser, info, { lag: 1 });
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(status(guest)).toHaveText('שני השחקנים בחדר', WAIT);
  await cutNetwork(host);
  await expect(msg(host)).toHaveText('החיבור אבד והחדר נסגר', WAIT);
  await expect(msg(guest)).toHaveText('המארח עזב את החדר', WAIT);
});

test('an expired room cannot be joined', async ({ browser }, info) => {
  const guest = await make(browser, info);
  await seedRoom('QQQQ', { meta: { v: 1, host: 'someone', createdAt: Date.now() - 11 * 60 * 1000, state: 'lobby' }, players: { someone: { name: 'x' } } });
  await joinByCode(guest, 'QQQQ');
  await expect(msg(guest)).toHaveText('פג תוקף החדר', WAIT);
});

test('no server: a clear message, and the game still works', async ({ browser }, info) => {
  const p = await make(browser, info, { emu: { database: ['127.0.0.1', 1] } });
  await p.page.click('#ttlFriend');
  await p.page.click('#roomCreate');
  await expect(p.page.locator('#roomMsg')).toHaveText('מתחבר…');
  await expect(msg(p)).toHaveText('אין חיבור לשרת. בדוק את הרשת ונסה שוב', { timeout: 20_000 });
  await p.page.click('#roomBack');
  await p.page.click('#ttlPlay');
  expect(await p.page.evaluate(() => window.__sky.G.state)).toBe('play');
});

test('the realtime connection exists only while in a room', async ({ browser }, info) => {
  const p = await make(browser, info);
  await p.page.waitForTimeout(1500);
  expect(p.sockets).toHaveLength(0);                                  // title screen: nothing open
  await createRoom(p);
  expect(p.sockets.length).toBeGreaterThan(0);
  await p.page.click('#roomLeave');
  await expect.poll(() => p.sockets.every(s => s.isClosed()), WAIT).toBe(true);
});

test('invite uses Web Share when the device has it', async ({ browser }, info) => {
  const p = await make(browser, info, { share: 'stub' });
  const code = await createRoom(p);
  await p.page.click('#roomInvite');
  const [shared] = await p.page.evaluate(() => window.__shared);
  expect(shared.text).toContain(code);
  expect(shared.url).toMatch(new RegExp(`\\?room=${code}$`));
});

test('invite falls back to copying the link', async ({ browser }, info) => {
  const p = await make(browser, info);
  const code = await createRoom(p);
  await p.page.click('#roomInvite');
  await expect(p.page.locator('#roomInviteMsg')).toHaveText('הקישור הועתק! שלח אותו לחבר');
  const text = await p.page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(new RegExp(`\\?room=${code}$`));
  expect(text).toContain('Sky Siege');
});

// ---------------------------------------------------------------- phones, both languages
const PHONES = [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]];
for (const [lang, locale] of [['he', 'he-IL'], ['en', 'en-US']]) for (const [phone, viewport] of PHONES) {
  test(`phone ${phone} (${lang}): menu and full lobby fit`, async ({ browser }, info) => {
    const host = await make(browser, info, { locale, viewport, mobile: true }), guest = await make(browser, info, { locale, viewport, mobile: true });
    const check = async (p, label) => {
      const file = `tests/screenshots/${info.project.name}-${lang}-${phone}-room-${label}.png`;
      await p.page.screenshot({ path: file });
      const r = await p.page.evaluate(() => { const c = document.querySelector('#roomScreen .card'); const b = c.getBoundingClientRect(); return { scrolls: c.scrollHeight > c.clientHeight + 1, inside: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight }; });
      expect(r).toEqual({ scrolls: false, inside: true });
      if (lang === 'en') expect(/[֐-׿]/.test(await p.page.locator('#roomScreen').innerText())).toBe(false);
    };
    await host.page.locator('#ttlFriend').tap();
    await check(host, 'menu');
    await host.page.locator('#roomCreate').tap();
    await host.page.locator('#roomLobby').waitFor();
    await check(host, 'waiting');
    await joinByCode(guest, await host.code());
    await expect(guest.page.locator('#roomLobby')).toBeVisible(WAIT);
    await expect(status(host)).toBeVisible();
    await expect.poll(() => players(host).count(), WAIT).toBe(2);
    await check(host, 'lobby');
  });
}
