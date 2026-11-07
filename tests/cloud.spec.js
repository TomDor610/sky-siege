// Cloud save (offline-first) against an in-memory fake of the Firebase backend.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runBattle } from './helpers/autopilot.js';
import { openGame } from './helpers/page.js';
import { installFakeCloud, cloudState, setOnline, cloudStatus } from './helpers/fake-cloud.js';

const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));
const waitStatus = (page, status) => expect.poll(async () => (await cloudStatus(page)).status, { timeout: 10_000 }).toBe(status);
const localProg = page => page.evaluate(() => JSON.parse(localStorage.getItem('skysiege_prog')));

// a returning player whose save predates the cloud (no coin counters yet)
const seedLocal = (page, prog) => page.addInitScript(p => {
  if (!localStorage.getItem('skysiege_prog')) localStorage.setItem('skysiege_prog', JSON.stringify(p));
}, prog);
const VETERAN = { coins: 777, upg: { frame: 2, wings: 1, props: 0, armor: 0, weapons: 0, workshop: 1, stone: 0, ballista: 0, archers: 0, mangonel: 0 }, xp: 300,
  styles: { classic: true, falcon: true }, unl: { crossbow: true, greek: false, slot5: false }, wins: { easy: 3, medium: 1, hard: 0 }, duelWins: { easy: 2, medium: 0, hard: 0 }, best: { easy: 25.5 } };

test('without a Firebase config cloud save is off and hidden', async ({ page }) => {
  const errors = await openGame(page);
  expect((await cloudStatus(page)).status).toBe('off');
  await expect(page.locator('#cloudBox')).toBeHidden();
  await expect(page.locator('#acctBadge')).toBeHidden();
  expect(errors).toEqual([]);
});

test('first launch: the local progress goes up to the cloud without losing anything', async ({ page }) => {
  await seedLocal(page, VETERAN);
  await page.addInitScript(installFakeCloud, {});
  const errors = await openGame(page);
  await waitStatus(page, 'saved');
  const s = await cloudState(page), doc = s.docs['anon-1'];
  expect(doc.prog).toMatchObject({ coins: 777, coinsEarned: 777, coinsSpent: 0, xp: 300, upg: { frame: 2, wings: 1, workshop: 1 }, wins: { easy: 3, medium: 1 }, best: { easy: 25.5 } });
  expect(doc.prog.styles.falcon).toBe(true);
  expect(doc.fort.slots).toHaveLength(5);
  expect((await localProg(page)).coins).toBe(777); // nothing changed locally
  await expect(page.locator('#cloudStatus')).toHaveText('☁ נשמר בענן');
  await expect(page.locator('#googleBtn')).toHaveText('שמור התקדמות בחשבון Google');
  await expect(page.locator('#acctBadge')).toHaveText('אורח');
  expect(errors).toEqual([]);
});

test('an existing cloud save is merged in, always keeping the higher values', async ({ page }) => {
  await seedLocal(page, VETERAN);
  const cloudProg = { ...VETERAN, coins: 1500, coinsEarned: 1800, coinsSpent: 300, xp: 200, upg: { ...VETERAN.upg, frame: 1, props: 4 }, wins: { easy: 1, medium: 4, hard: 2 }, styles: { classic: true, bat: true }, best: { easy: 19.1 }, epoch: 0 };
  await page.addInitScript(installFakeCloud, { user: { uid: 'anon-1', isAnonymous: true, name: '' }, n: 1, docs: { 'anon-1': { v: 1, prog: cloudProg, build: { style: 'bat', wings: 3, props: 2, armor: 0, bombs: 4, crossbows: 0, bombType: 'stone' }, fort: { slots: [null, null, null, null, null], walls: 1 }, buildAt: Date.now() } } });
  const errors = await openGame(page);
  await waitStatus(page, 'saved');
  const p = await localProg(page);
  // local had coins 777 (earned 777, spent 0) -> earned max(777,1800)=1800, spent max(0,300)=300
  expect([p.coins, p.coinsEarned, p.coinsSpent, p.xp]).toEqual([1500, 1800, 300, 300]);
  expect([p.upg.frame, p.upg.props, p.upg.wings]).toEqual([2, 4, 1]);
  expect(p.wins).toEqual({ easy: 3, medium: 4, hard: 2 });
  expect(p.styles).toMatchObject({ classic: true, falcon: true, bat: true });
  expect(p.best.easy).toBe(19.1);
  await expect(page.locator('#coinTxt')).toHaveText('1500');                     // workshop refreshed
  expect(await page.evaluate(() => window.__sky.build().style)).toBe('bat');     // newer cloud build
  expect((await cloudState(page)).docs['anon-1'].prog.xp).toBe(300);              // and written back
  expect(errors).toEqual([]);
});

test('battle results and purchases reach the cloud; the game result is unchanged', async ({ page }) => {
  await page.addInitScript(installFakeCloud, {});
  const errors = await openGame(page);
  await waitStatus(page, 'saved');
  const res = await page.evaluate(runBattle, { mode: 'campaign', diff: 'easy', seed: 1 });
  expect({ ...res, errors }).toEqual(baseline.find(b => b.mode === 'campaign' && b.diff === 'easy'));
  await expect.poll(async () => (await cloudState(page)).docs['anon-1'].prog.coins, { timeout: 10_000 }).toBe(res.coins);
  // buy the first machine upgrade
  await page.click('#rebuildBtn');
  await page.click('.tabs button[data-tab="shop"]');
  const before = (await localProg(page)).coins;
  await page.locator('#shop button.buy').first().click();
  const after = await localProg(page);
  expect(after.coins).toBeLessThan(before);
  await expect.poll(async () => (await cloudState(page)).docs['anon-1'].prog, { timeout: 10_000 })
    .toMatchObject({ coins: after.coins, coinsSpent: after.coinsSpent, upg: { frame: 1 } });
  expect(errors).toEqual([]);
});

test('offline: the game works, saves locally and uploads once back online', async ({ page }) => {
  await page.addInitScript(installFakeCloud, { online: false });
  const errors = await openGame(page);
  await waitStatus(page, 'offline');
  await expect(page.locator('#cloudStatus')).toHaveText('☁ לא מחובר: נשמר במכשיר');
  const res = await page.evaluate(runBattle, { mode: 'duel', diff: 'easy', seed: 1 });
  expect({ ...res, errors }).toEqual(baseline.find(b => b.mode === 'duel' && b.diff === 'easy'));
  expect((await localProg(page)).coins).toBe(res.coins);
  expect(Object.keys((await cloudState(page)).docs)).toEqual([]);
  await setOnline(page, true);
  await waitStatus(page, 'saved');
  const doc = Object.values((await cloudState(page)).docs)[0];
  expect(doc.prog.coins).toBe(res.coins);
  expect(doc.prog.duelWins.easy).toBe(1);
});

test('"Save progress to your Google account" links the guest account and keeps the progress', async ({ page }) => {
  await seedLocal(page, VETERAN);
  await page.addInitScript(installFakeCloud, {});
  const errors = await openGame(page);
  await waitStatus(page, 'saved');
  const badge = page.locator('#acctBadge');
  await expect(badge).toHaveText('אורח');
  await expect(badge).toHaveClass(/guest/);
  await expect(page.locator('#googleBtn')).toHaveText('שמור התקדמות בחשבון Google');
  await page.click('#googleBtn');
  await expect(badge).toHaveText('שמור בענן ✓');
  await expect(badge).toHaveClass(/cloud/);
  await expect(badge).toHaveAttribute('title', /Test Player/);
  await expect(page.locator('#cloudStatus')).toHaveText('☁ נשמר בענן · Test Player');
  const c = await cloudStatus(page);
  expect([c.uid, c.isAnonymous]).toEqual(['anon-1', false]);
  await expect(page.locator('#googleBtn')).toHaveText('התנתק');
  expect((await localProg(page)).coins).toBe(777);
  // same uid -> the cloud copy is the same document, still holding everything
  expect((await cloudState(page)).docs['anon-1'].prog).toMatchObject({ coins: 777, xp: 300, upg: { frame: 2 } });
  // the badge survives a reload (the Google session is remembered)
  await page.reload();
  await page.waitForFunction(() => !!window.__sky);
  await expect(badge).toHaveText('שמור בענן ✓');
  expect(errors).toEqual([]);
});

test('closing the Google window changes nothing and shows no error', async ({ page }) => {
  await page.addInitScript(installFakeCloud, { googleCancel: true });
  const errors = await openGame(page);
  await waitStatus(page, 'saved');
  await page.click('#googleBtn');
  await waitStatus(page, 'saved');
  await expect(page.locator('#cloudStatus')).toHaveText('☁ נשמר בענן');
  await expect(page.locator('#acctBadge')).toHaveText('אורח');
  expect((await cloudStatus(page)).isAnonymous).toBe(true);
  expect(errors).toEqual([]);
});

test('Google sign-in on a second device merges with the progress saved on that account', async ({ page }) => {
  await seedLocal(page, { ...VETERAN, coins: 200, xp: 50, upg: { ...VETERAN.upg, armor: 3 } });
  const account = { ...VETERAN, coins: 900, coinsEarned: 1000, coinsSpent: 100, xp: 800, epoch: 0 };
  await page.addInitScript(installFakeCloud, { google: { uid: 'google-1', name: 'Tom' }, docs: { 'google-1': { v: 1, prog: account, build: { style: 'classic', wings: 2, props: 2, armor: 1, bombs: 4, crossbows: 0, bombType: 'stone' }, fort: { slots: ['ballista', null, null, null, null], walls: 0 }, buildAt: 1 } } });
  const errors = await openGame(page);
  await waitStatus(page, 'saved');
  await page.click('#googleBtn');
  await expect(page.locator('#cloudStatus')).toHaveText('☁ נשמר בענן · Tom');
  expect((await cloudStatus(page)).uid).toBe('google-1');
  await expect(page.locator('#acctBadge')).toHaveText('שמור בענן ✓');
  const p = await localProg(page);
  expect([p.coinsEarned, p.coinsSpent, p.coins, p.xp, p.upg.armor]).toEqual([1000, 100, 900, 800, 3]);
  expect((await cloudState(page)).docs['google-1'].prog.upg.armor).toBe(3);
  expect(errors).toEqual([]);
});

test('a cloud merge that arrives mid-battle waits until the battle is over', async ({ page }) => {
  const richer = { ...VETERAN, coins: 5000, coinsEarned: 5000, coinsSpent: 0, xp: 300, epoch: 0 };
  await page.addInitScript(installFakeCloud, { delay: 400, user: { uid: 'anon-1', isAnonymous: true, name: '' }, n: 1, docs: { 'anon-1': { v: 1, prog: richer, build: { style: 'classic', wings: 2, props: 2, armor: 1, bombs: 4, crossbows: 0, bombType: 'stone' }, fort: { slots: [null, null, null, null, null], walls: 0 }, buildAt: 1 } } });
  const errors = await openGame(page);
  await page.evaluate(() => window.__sky.start()); // battle starts before the slow cloud answers
  await waitStatus(page, 'saved');
  expect(await page.evaluate(() => [window.__sky.prog.coins, window.__sky.G.state])).toEqual([120, 'play']);
  await page.click('#pauseBtn');
  await page.click('#quitBtn');      // result screen: not a battle any more
  await page.click('#rebuildBtn');
  // applied only now. "Take the higher value": earned = max(5000, 120 + this battle) = 5000
  await expect(page.locator('#coinTxt')).toHaveText('5000');
  expect(errors).toEqual([]);
});

test.describe('in English', () => {
  test.use({ locale: 'en-US' });
  test('status line and button are translated', async ({ page }) => {
    await page.addInitScript(installFakeCloud, {});
    await openGame(page);
    await waitStatus(page, 'saved');
    await expect(page.locator('#cloudStatus')).toHaveText('☁ Saved to the cloud');
    await expect(page.locator('#googleBtn')).toHaveText('Save progress to your Google account');
    await expect(page.locator('#acctBadge')).toHaveText('Guest');
  });
});
