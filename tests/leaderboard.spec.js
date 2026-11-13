// Leaderboard screen against the in-memory fake backend.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers/page.js';
import { installFakeCloud, cloudState, setOnline, cloudStatus } from './helpers/fake-cloud.js';
import { buildRow } from '../src/leaderboard/rows.js';
import { freshProg } from '../src/progress.js';

const player = (uid, over) => buildRow(Object.assign(freshProg(), over), uid);
const OTHERS = {
  ADA111111: player('ADA111111', { nick: 'Ada', xp: 2000, wins: { easy: 6, medium: 2, hard: 1 }, best: { easy: 18.2, medium: 40.5, hard: 70 }, duelWins: { easy: 1, medium: 0, hard: 0 } }),
  BEN222222: player('BEN222222', { nick: 'Ben', xp: 100, wins: { easy: 6, medium: 0, hard: 0 }, best: { easy: 25.0 }, duelWins: { easy: 9, medium: 3, hard: 0 } }),
  CAL333333: player('CAL333333', { nick: 'Cal', xp: 50, wins: { easy: 1, medium: 0, hard: 0 }, best: { easy: 60 } }),
  // Dan added me as a friend (follower), I did not add him
  DAN444444: player('DAN444444', { nick: 'Dan', xp: 30, wins: { easy: 2, medium: 0, hard: 0 }, best: { easy: 44 }, friends: ['anon-1'] }),
};
const ME = { coins: 300, xp: 400, upg: {}, styles: { classic: true }, unl: {}, wins: { easy: 3, medium: 0, hard: 0 }, duelWins: { easy: 2, medium: 0, hard: 0 }, best: { easy: 30.4 } };
const seedLocal = (page, prog) => page.addInitScript(p => { if (!localStorage.getItem('skysiege_prog')) localStorage.setItem('skysiege_prog', JSON.stringify(p)); }, prog);
const ready = page => expect.poll(async () => (await cloudStatus(page)).status, { timeout: 10_000 }).toBe('saved');
const names = page => page.locator('#lbBody td.nm').allTextContents();
const openLb = async page => { await page.click('#lbBtn'); await expect(page.locator('#lbScreen')).toBeVisible(); };

test('no leaderboard button when cloud save is off', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('#lbBtn')).toBeHidden();
});

test('join with a nickname: validation, row published, shown in Everyone', async ({ page }) => {
  await seedLocal(page, ME);
  await page.addInitScript(installFakeCloud, { lb: OTHERS });
  const errors = await openGame(page);
  await ready(page);
  await openLb(page);
  await expect(page.locator('#lbMe')).toContainText('בחר כינוי כדי להופיע בטבלה');
  await expect(page.locator('#lbCode')).toHaveText('הצטרף לטבלה כדי שחברים יוכלו להוסיף אותך');
  // typing "m" in the box must not mute the game
  await page.fill('#lbNick', 'T');
  await page.press('#lbNick', 'm');
  expect((await page.evaluate(() => window.__sky.sound())).settings.muted).toBe(false);
  await page.fill('#lbNick', 'T');
  await page.click('#lbNickSave');
  await expect(page.locator('#lbNickMsg')).toHaveText('הכינוי קצר מדי (לפחות 2 תווים)');
  await page.fill('#lbNick', 'טום הממציא');
  await page.click('#lbNickSave');
  await expect(page.locator('#lbMe')).toContainText('מופיע בטבלה בתור: טום הממציא');
  await expect(page.locator('#lbCode')).toContainText('ANON1');
  await expect.poll(async () => (await cloudState(page)).lb?.['anon-1']?.name, { timeout: 10_000 }).toBe('טום הממציא');
  const mine = (await cloudState(page)).lb['anon-1'];
  expect(mine).toMatchObject({ code: 'ANON1', rank: 4, lvl: { easy: 3, medium: 0, hard: 0 }, best: { easy: 30.4, medium: 0, hard: 0 }, duelWins: 2 });
  await expect.poll(async () => (await cloudState(page)).docs['anon-1'].prog.nick, { timeout: 10_000 }).toBe('טום הממציא'); // saved with the progress too

  await page.click('#lbTabs button[data-lbtab="all"]');
  await expect.poll(() => names(page)).toEqual(['Ada', 'Ben', 'טום הממציא', 'Dan', 'Cal']); // easy: levels, then time
  await expect(page.locator('#lbBody tr.me td.nm')).toHaveText('טום הממציא');
  await expect(page.locator('#lbColA')).toHaveText('רמה');
  await page.click('#lbViews button[data-view="duel"]');
  await expect.poll(() => names(page)).toEqual(['Ben', 'טום הממציא', 'Ada', 'Cal', 'Dan']);
  await expect(page.locator('#lbColA')).toHaveText('ניצחונות');
  await page.click('#lbViews button[data-view="hard"]');
  await expect(page.locator('#lbBody tr').first()).toContainText('Ada');
  expect(errors).toEqual([]);
});

test('Friends: people I added by code plus people who added me, and me', async ({ page }) => {
  await seedLocal(page, { ...ME, nick: 'Tom' });
  await page.addInitScript(installFakeCloud, { lb: OTHERS });
  const errors = await openGame(page);
  await ready(page);
  await openLb(page);
  await expect.poll(() => names(page)).toEqual(['Tom', 'Dan']);            // Dan follows me
  await page.fill('#lbCodeIn', 'zzzz9999');
  await page.click('#lbAddBtn');
  await expect(page.locator('#lbFriendMsg')).toHaveText('לא נמצא שחקן עם הקוד הזה');
  await page.fill('#lbCodeIn', 'anon1');
  await page.click('#lbAddBtn');
  await expect(page.locator('#lbFriendMsg')).toHaveText('זה הקוד שלך 🙂');
  await page.fill('#lbCodeIn', 'ada11111');                                 // case-insensitive
  await page.click('#lbAddBtn');
  await expect(page.locator('#lbFriendMsg')).toHaveText('Ada נוסף לחברים');
  await expect.poll(() => names(page)).toEqual(['Ada', 'Tom', 'Dan']);
  await page.fill('#lbCodeIn', 'ADA11111');
  await page.click('#lbAddBtn');
  await expect(page.locator('#lbFriendMsg')).toHaveText('Ada כבר ברשימת החברים');
  await expect.poll(async () => (await cloudState(page)).docs['anon-1']?.prog.friends).toEqual(['ADA111111']);
  expect(errors).toEqual([]);
});

test('invite link: copying it, and opening one asks before adding', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(installFakeCloud, { lb: OTHERS });
  const errors = await openGame(page);
  await page.goto('/?friend=BEN22222');
  await page.waitForFunction(() => !!window.__sky);
  await expect(page.locator('#lbScreen')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#lbInviteTxt')).toHaveText('להוסיף את Ben לחברים?');
  expect(new URL(page.url()).search).toBe('');                              // the code is removed from the address
  await page.click('#lbInviteYes');
  await expect(page.locator('#lbFriendMsg')).toHaveText('Ben נוסף לחברים');
  await expect.poll(() => names(page)).toContain('Ben');
  // my own invite link (after joining)
  await page.fill('#lbNick', 'Tom');
  await page.click('#lbNickSave');
  await page.click('#lbInviteBtn');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/\?friend=ANON1$/);
  expect(text).toContain('Sky Siege');
  expect(errors).toEqual([]);
});

test('leaving the board hides my row', async ({ page }) => {
  await seedLocal(page, { ...ME, nick: 'Tom' });
  await page.addInitScript(installFakeCloud, { lb: OTHERS });
  await openGame(page);
  await ready(page);
  await expect.poll(async () => (await cloudState(page)).lb?.['anon-1']?.name, { timeout: 10_000 }).toBe('Tom');
  await openLb(page);
  // rules allow one write per 20 s: pretend the last one was long ago
  await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('skysiege_lb')); m.at = 0; localStorage.setItem('skysiege_lb', JSON.stringify(m)); });
  await page.reload(); await page.waitForFunction(() => !!window.__sky); await ready(page); await openLb(page);
  await page.click('#lbLeave');
  await expect(page.locator('#lbMe')).toContainText('בחר כינוי כדי להופיע בטבלה');
  await expect.poll(async () => (await cloudState(page)).lb['anon-1'].name, { timeout: 10_000 }).toBe('');
  expect((await cloudState(page)).lb['anon-1'].score.easy).toBe(-1);
  await page.click('#lbTabs button[data-lbtab="all"]');
  await expect.poll(() => names(page)).not.toContain('Tom');
});

test('offline: shows the last loaded results with a note', async ({ page }) => {
  await seedLocal(page, { ...ME, nick: 'Tom' });
  await page.addInitScript(installFakeCloud, { lb: OTHERS });
  await openGame(page);
  await ready(page);
  await openLb(page);
  await page.click('#lbTabs button[data-lbtab="all"]');
  await expect.poll(() => names(page)).toContain('Ada');
  await page.click('#lbClose');
  await setOnline(page, false);
  await page.reload(); await page.waitForFunction(() => !!window.__sky);
  await expect(page.locator('#lbBtn')).toBeVisible();
  await openLb(page);
  await page.click('#lbTabs button[data-lbtab="all"]');
  await expect(page.locator('#lbMsg')).toHaveText('לא מחובר: מוצגות התוצאות האחרונות שנטענו');
  await expect.poll(() => names(page)).toContain('Ada');
});

test.describe('in English', () => {
  test.use({ locale: 'en-US' });
  test('screen is translated', async ({ page }) => {
    await seedLocal(page, { ...ME, nick: 'Tom' });
    await page.addInitScript(() => localStorage.setItem('skysiege_lang', 'en')); // a returning player who chose English
    await page.addInitScript(installFakeCloud, { lb: OTHERS });
    await openGame(page);
    await ready(page);
    await expect(page.locator('#lbBtn')).toHaveText('🏆 Leaderboard');
    await openLb(page);
    await expect(page.locator('#lbTabs')).toContainText('Friends');
    await expect(page.locator('#lbColB')).toHaveText('Time');
    await expect(page.locator('#lbMe')).toContainText('On the board as: Tom');
    const hebrew = await page.locator('#lbScreen').innerText();
    expect(/[֐-׿]/.test(hebrew)).toBe(false);
  });
});

test('Friends: the 1v1 record against a friend is shown next to the name (stage 5)', async ({ page }) => {
  await seedLocal(page, { ...ME, nick: 'Tom', vs: { DAN444444: { n: 'Dan', w: 4, l: 2, d: 0, s: 1, b: 2, t: 1 } } });
  await page.addInitScript(installFakeCloud, { lb: OTHERS });
  const errors = await openGame(page);
  await ready(page);
  await openLb(page);
  await expect(page.locator('#lbBody tr[data-uid="DAN444444"] td.nm')).toHaveText('Dan מאזן 4–2');
  await expect(page.locator('#lbBody tr.me td.nm')).toHaveText('Tom');                     // no record against myself
  await page.click('#lbTabs button[data-lbtab="all"]');
  await expect(page.locator('#lbBody tr[data-uid="DAN444444"] td.nm')).toHaveText('Dan');   // only on the friends tab
  expect(errors).toEqual([]);
});
