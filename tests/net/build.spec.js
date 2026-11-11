// 1v1 stage 2: blind build with two real browsers against the Firebase emulators.
import { test, expect } from '@playwright/test';
import { joinPlayer, createRoom, joinByCode } from './helpers.js';

const WAIT = { timeout: 15_000 };
let all = [];
const make = async (browser, info, opts) => { const p = await joinPlayer(browser, info, opts); all.push(p); return p.open(); };
test.afterEach(async () => {
  const errors = all.flatMap(p => p.errors);
  await Promise.all(all.map(p => p.close().catch(() => {})));
  all = [];
  expect(errors).toEqual([]);
});

// host + guest in one room, building
async function pair(browser, info, opts = {}) {
  const host = await make(browser, info, opts.host || opts), guest = await make(browser, info, opts.guest || opts);
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(host.page.locator('#roomStart')).toBeVisible(WAIT);
  await expect(guest.page.locator('#roomWaitHost')).not.toBeEmpty();
  await expect(guest.page.locator('#roomStart')).toBeHidden();
  await host.page.click('#roomStart');
  for (const p of [host, guest]) await expect(p.page.locator('#vsBar')).toBeVisible(WAIT);
  return { host, guest, code };
}
const seconds = async p => Number((await p.page.locator('#vsTimer').textContent()).replace(/\D/g, ''));
const pickStyle = (p, name) => p.page.locator('#styles .sty', { hasText: name }).click();
const ready = p => p.page.click('#vsReady');
const VETERAN = { coins: 5000, xp: 9000, upg: { frame: 5, wings: 5, props: 5, armor: 5, weapons: 5, workshop: 8, stone: 5, ballista: 5, archers: 5, mangonel: 5 }, styles: { classic: true }, unl: {}, wins: {}, duelWins: {}, best: {} };

test('both build at once: same timer, budget 180, everything open, no upgrades', async ({ browser }, info) => {
  const { host, guest } = await pair(browser, info, { host: { seed: VETERAN } });
  const [a, b] = [await seconds(host), await seconds(guest)];
  expect(a).toBeGreaterThan(55);
  expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
  for (const p of [host, guest]) {
    await expect(p.page.locator('#goldLeft')).toHaveText(/\/ 180$/);
    await expect(p.page.locator('#styles .sty.locked')).toHaveCount(0);           // every style open
    await expect(p.page.locator('#parts')).toContainText('קשתות חוזרות');          // crossbow part open
    await expect(p.page.locator('#bombSeg button[data-b="greek"]')).toBeEnabled();
    await expect(p.page.locator('#slots .slot')).toHaveCount(5);                   // fifth post open
    await expect(p.page.locator('#buildScreen .tabs')).toBeHidden();               // no shop
    await expect(p.page.locator('#launchBtn')).toBeHidden();
    await expect(p.page.locator('#vsOpp')).toHaveText('החבר בונה…');
  }
  // the veteran's upgrades are ignored: same build, same stat bars as the newcomer
  const bars = p => p.page.evaluate(() => ['sSpeed', 'sStab', 'sAgi', 'sHp', 'sFire'].map(id => document.getElementById(id).style.width));
  expect(await bars(host)).toEqual(await bars(guest));
});

test('the guest sees who must start', async ({ browser }, info) => {
  const host = await make(browser, info), guest = await make(browser, info);
  await joinByCode(guest, await createRoom(host));
  await expect(guest.page.locator('#roomWaitHost')).toHaveText('ממתינים שהמארח יתחיל…', WAIT);
});

test('Ready on both sides reveals each other\'s real loadout', async ({ browser }, info) => {
  const { host, guest } = await pair(browser, info);
  await pickStyle(host, 'בז');
  for (let i = 0; i < 3; i++) await host.page.locator('#slots .slot').nth(3).click();   // the wall post: -> mangonel
  await pickStyle(guest, 'עטלף');
  await ready(host);
  await expect(guest.page.locator('#vsOpp')).toHaveText('החבר מוכן ✓', WAIT);
  await expect(host.page.locator('#vsHint')).toHaveText('אתה מוכן. מחכים לחבר…');
  await ready(guest);
  for (const p of [host, guest]) await expect(p.page.locator('#roomReveal')).toBeVisible(WAIT);
  await expect(guest.page.locator('#vsTheirs')).toContainText('בז');
  await expect(guest.page.locator('#vsTheirs')).toContainText("מנג'ניק");
  await expect(host.page.locator('#vsTheirs')).toContainText('עטלף');
  await expect(host.page.locator('#vsMine')).toContainText('בז');
  await expect(host.page.locator('#buildScreen')).toBeHidden();
});

test('Ready can be taken back', async ({ browser }, info) => {
  const { host, guest } = await pair(browser, info);
  await ready(host);
  await expect(guest.page.locator('#vsOpp')).toHaveText('החבר מוכן ✓', WAIT);
  await expect(host.page.locator('#vsReady')).toHaveText('ביטול מוכן');
  await ready(host);
  await expect(guest.page.locator('#vsOpp')).toHaveText('החבר בונה…', WAIT);
  await expect(host.page.locator('#vsReady')).toHaveText('✓ מוכן');
});

test('time is up: the last build of a player who never pressed Ready is used', async ({ browser }, info) => {
  test.setTimeout(150_000);
  const { host, guest } = await pair(browser, info);
  await ready(host);
  await pickStyle(guest, 'ספינת אוויר');                       // changed, never ready
  for (const p of [host, guest]) await expect(p.page.locator('#roomReveal')).toBeVisible({ timeout: 75_000 });
  await expect(host.page.locator('#vsTheirs')).toContainText('ספינת אוויר');
});

test('after the battle, back in the room a second round starts from the last 1v1 build; your own build is untouched', async ({ browser }, info) => {
  const { host, guest } = await pair(browser, info);
  const ownBefore = await host.page.evaluate(() => localStorage.getItem('skysiege_build2'));
  await pickStyle(host, 'גליון');
  await ready(host); await ready(guest);
  await expect(host.page.locator('#roomReveal')).toBeVisible(WAIT);
  await expect(guest.page.locator('#vsStarting')).toHaveText('הקרב מתחיל עוד רגע…');
  await host.page.waitForFunction(() => window.__sky.net().phase === 'play', null, WAIT);
  await guest.page.evaluate(() => { window.__sky.G.mine.hp = 0; });
  await expect(host.page.locator('#vsExit')).toBeVisible(WAIT);
  await host.page.click('#vsExit');
  await expect(host.page.locator('#roomLobby')).toBeVisible(WAIT);
  expect(await host.page.evaluate(() => localStorage.getItem('skysiege_build2'))).toBe(ownBefore);
  expect(await host.page.evaluate(() => window.__sky.build().style)).toBe('classic');   // the player's own build is back
  await host.page.click('#roomStart');
  await expect(host.page.locator('#vsBar')).toBeVisible(WAIT);
  await expect(host.page.locator('#styles .sty.on')).toContainText('גליון');               // last 1v1 build
});

test('the guest leaves mid-build: the match is cancelled for the host', async ({ browser }, info) => {
  const { host, guest } = await pair(browser, info);
  await guest.page.click('#vsLeave');
  await expect(host.page.locator('#roomLobby')).toBeVisible(WAIT);
  await expect(host.page.locator('#roomLobbyMsg')).toHaveText('החבר יצא, הקרב בוטל');
  await expect(host.page.locator('#buildScreen')).toBeHidden();
  expect(await host.page.evaluate(() => document.body.classList.contains('vs1'))).toBe(false);
});

test('the host closes the browser mid-build: the guest is told', async ({ browser }, info) => {
  const { host, guest } = await pair(browser, info);
  await host.close();
  await expect(guest.page.locator('#roomMsg')).toHaveText('המארח עזב את החדר', WAIT);
  await expect(guest.page.locator('#buildScreen')).toBeHidden();
});

test('works with a 200 ms round trip', async ({ browser }, info) => {
  const { host, guest } = await pair(browser, info, { lag: 100 });
  await pickStyle(guest, 'בז');
  await ready(host); await ready(guest);
  await expect(host.page.locator('#vsTheirs')).toContainText('בז', WAIT);
});

const PHONES = [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]];
for (const [lang, locale] of [['he', 'he-IL'], ['en', 'en-US']]) for (const [phone, viewport] of PHONES) {
  test(`phone ${phone} (${lang}): build bar and reveal`, async ({ browser }, info) => {
    const { host, guest } = await pair(browser, info, { locale, viewport, mobile: true });
    const shot = (p, label) => p.page.screenshot({ path: `tests/screenshots/${info.project.name}-${lang}-${phone}-vs-${label}.png` });
    const bar = await host.page.locator('#vsBar').boundingBox();
    expect(bar.y).toBeGreaterThanOrEqual(0);
    expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height);
    await shot(host, 'build');
    await host.page.locator('#vsReady').tap(); await guest.page.locator('#vsReady').tap();
    await expect(host.page.locator('#roomReveal')).toBeVisible(WAIT);
    await host.page.waitForTimeout(300);
    await shot(host, 'reveal');
    // the "starting" line must be visible without scrolling
    const line = await host.page.locator('#vsStarting').boundingBox();
    expect(line.y + line.height).toBeLessThanOrEqual(viewport.height);
    if (lang === 'en') expect(/[֐-׿]/.test(await host.page.locator('#roomScreen').innerText())).toBe(false);
  });
}
