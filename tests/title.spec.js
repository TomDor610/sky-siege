// Title screen, as a real player meets it (phone landscape/portrait, Hebrew/English).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runBattle } from './helpers/autopilot.js';
import { openGame, fontsLoaded } from './helpers/page.js';
import { installFakeCloud, cloudStatus } from './helpers/fake-cloud.js';

const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));
const open = page => openGame(page, { title: true });
const saved = page => expect.poll(async () => (await cloudStatus(page)).status, { timeout: 10_000 }).toBe('saved');
const events = page => page.evaluate(() => window.__skyAnalytics.map(e => e.params.target || e.name));
const recordAnalytics = page => page.addInitScript(() => { window.__skyAnalytics = []; });
const RETURNING = { coins: 300, xp: 400, upg: {}, styles: { classic: true }, unl: {}, wins: { easy: 3, medium: 0, hard: 0 }, duelWins: { easy: 2, medium: 0, hard: 0 }, best: { easy: 30.4 } };
const seed = (page, prog, extra = {}) => page.addInitScript(([p, x]) => {
  if (localStorage.getItem('skysiege_prog')) return;
  localStorage.setItem('skysiege_prog', JSON.stringify(p));
  for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
}, [prog, extra]);

test('the game opens on the title screen', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#buildScreen')).toBeHidden();
  await expect(page.locator('#ttlPlay')).toHaveText('שחק');
  await expect(page.locator('#ttlContinue')).toBeHidden();            // nothing saved yet
  await page.waitForTimeout(300);                                     // the live background is drawing
  expect(errors).toEqual([]);
});

test('new player: Play goes straight to the tutorial battle, on campaign easy', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#ttlModes button[data-tm="campaign"]')).toHaveClass(/on/);
  await page.click('#ttlPlay');
  const s = await page.evaluate(() => ({ duel: window.__sky.G.duel, diff: window.__sky.G.diff, lvl: window.__sky.G.foe.lvl, state: window.__sky.G.state, tut: window.__sky.tutorial() }));
  expect(s).toMatchObject({ duel: false, diff: 'easy', lvl: 1, state: 'play', tut: { active: true, step: 'climb' } });
  await expect(page.locator('#tut')).toBeVisible();
  await expect(page.locator('#titleScreen')).toBeHidden();
  expect(errors).toEqual([]);
});

test('new player who picks a mode gets that mode, still on easy', async ({ page }) => {
  await open(page);
  await page.click('#ttlModes button[data-tm="duel"]');
  await expect(page.locator('#ttlModes button[data-tm="duel"]')).toHaveClass(/on/);
  await expect(page.locator('#ttlModes button[data-tm="campaign"]')).not.toHaveClass(/on/);
  await page.click('#ttlPlay');
  expect(await page.evaluate(() => [window.__sky.G.duel, window.__sky.G.diff])).toEqual([true, 'easy']);
});

test('returning player: Play uses the last choice; Continue shows progress and opens the workshop', async ({ page }) => {
  await seed(page, RETURNING, { skysiege_mode: 'campaign', skysiege_diff: 'hard' });
  const errors = await open(page);
  await expect(page.locator('#ttlContinue')).toBeVisible();
  await expect(page.locator('#ttlContinue')).toContainText('המשך');
  await expect(page.locator('#ttlContinueSub')).toHaveText('דרגה 4 · אומן · 🪙 300');
  await page.click('#ttlContinue');
  await expect(page.locator('#buildScreen')).toBeVisible();
  await page.click('#homeBtn');
  await expect(page.locator('#titleScreen')).toBeVisible();
  await page.click('#ttlPlay');
  const s = await page.evaluate(() => ({ duel: window.__sky.G.duel, diff: window.__sky.G.diff, tut: window.__sky.tutorial().active }));
  expect(s).toEqual({ duel: false, diff: 'hard', tut: false });
  expect(errors).toEqual([]);
});

test('Ghost Race is "coming soon" and does nothing', async ({ page }) => {
  await open(page);
  await expect(page.locator('#ttlGhost')).toContainText('מרוץ רוחות');
  await expect(page.locator('#ttlGhost')).toContainText('בקרוב');
  await page.click('#ttlGhost', { force: true }); // aria-disabled, but a real tap still lands
  await expect(page.locator('#titleScreen')).toBeVisible();
  expect(await page.evaluate(() => window.__sky.G)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('skysiege_mode'))).toBeNull();
  await expect(page.locator('#ttlGhost')).not.toHaveClass(/(^| )on( |$)/);
});

test('account line: guest sees Google, signed-in player sees nickname and rank', async ({ page }) => {
  await seed(page, { ...RETURNING, nick: 'Tom' });
  await page.addInitScript(installFakeCloud, {});
  const errors = await open(page);
  await saved(page);
  await expect(page.locator('#ttlGoogle')).toHaveText('התחברות עם Google');
  await expect(page.locator('#ttlAcctTxt')).toBeHidden();
  await page.click('#ttlGoogle');
  await expect(page.locator('#ttlAcctTxt')).toHaveText('מחובר: Tom · דרגה 4');
  await expect(page.locator('#ttlGoogle')).toBeHidden();
  expect(errors).toEqual([]);
});

test('account line falls back to the account name when there is no nickname', async ({ page }) => {
  await seed(page, RETURNING);
  await page.addInitScript(installFakeCloud, {});
  await open(page);
  await saved(page);
  await page.click('#ttlGoogle');
  await expect(page.locator('#ttlAcctTxt')).toHaveText('מחובר: Test Player · דרגה 4');
});

test('without a cloud config: no account line and no leaderboard, Play still works', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#ttlAcct')).toBeHidden();
  await expect(page.locator('#ttlLb')).toBeHidden();
  await page.click('#ttlPlay');
  expect(await page.evaluate(() => window.__sky.G.state)).toBe('play');
  expect(errors).toEqual([]);
});

test('fast start: the screen and Play work while Firebase is stuck', async ({ page }) => {
  await page.addInitScript(installFakeCloud, { delay: 60_000 });
  const errors = await open(page);
  await expect(page.locator('#ttlPlay')).toBeVisible();
  await expect(page.locator('#ttlLb')).toBeVisible();                 // known without waiting for Firebase
  await expect(page.locator('#ttlGoogle')).toBeDisabled();            // not ready yet, never a dead click
  await page.click('#ttlPlay');
  expect(await page.evaluate(() => window.__sky.G.state)).toBe('play');
  expect(errors).toEqual([]);
});

test('offline: the title screen still works and the leaderboard says so', async ({ page }) => {
  await page.addInitScript(installFakeCloud, { online: false });
  const errors = await open(page);
  await expect.poll(async () => (await cloudStatus(page)).status, { timeout: 10_000 }).toBe('offline');
  await page.click('#ttlLb');
  await expect(page.locator('#lbMsg')).toHaveText('לא מחובר: אין עדיין תוצאות להצגה');
  await page.click('#lbClose');
  await expect(page.locator('#titleScreen')).toBeVisible();
  await page.click('#ttlPlay');
  expect(await page.evaluate(() => window.__sky.G.state)).toBe('play');
  expect(errors).toEqual([]);
});

test('Leaderboard returns to the screen it was opened from', async ({ page }) => {
  await page.addInitScript(installFakeCloud, {});
  await open(page);
  await saved(page);
  await page.click('#ttlLb');
  await expect(page.locator('#lbScreen')).toBeVisible();
  await expect(page.locator('#titleScreen')).toBeHidden();
  await page.click('#lbClose');
  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#buildScreen')).toBeHidden();
});

test('Settings: sound, language and usage data', async ({ page }) => {
  await open(page);
  await page.click('#ttlSettings');
  await expect(page.locator('#settingsScreen')).toBeVisible();
  await expect(page.locator('#setSfx')).toHaveText('🔊 אפקטים: פועלים');
  await page.click('#setMusic');
  await expect(page.locator('#setMusic')).toHaveText('🎵 מוזיקה: כבויה');
  expect((await page.evaluate(() => window.__sky.sound())).settings.music).toBe(false);
  await page.click('#setLang');
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(['en', 'ltr']);
  await expect(page.locator('#setMusic')).toHaveText('🎵 Music: off');
  await page.click('#setClose');
  await expect(page.locator('#settingsScreen')).toBeHidden();
  await expect(page.locator('#ttlPlay')).toHaveText('Play');
  await page.click('#ttlLang');
  await expect(page.locator('#ttlPlay')).toHaveText('שחק');
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
});

test('analytics: one event per press, and none once turned off', async ({ page }) => {
  await recordAnalytics(page);
  await page.addInitScript(installFakeCloud, {});
  await open(page);
  await saved(page);
  await page.click('#ttlModes button[data-tm="duel"]');
  await page.click('#ttlGhost', { force: true }); // aria-disabled, but a real tap still lands
  await page.click('#ttlLang');
  await page.click('#ttlSettings');
  await page.click('#setClose');
  await page.click('#ttlLb');
  await page.click('#lbClose');
  await page.click('#ttlGoogle');
  await page.click('#ttlPlay');
  expect(await events(page)).toEqual(['title_view', 'mode_duel', 'mode_ghost_soon', 'lang', 'settings', 'settings_close', 'leaderboard', 'google', 'play']);
  expect((await page.evaluate(() => window.__skyAnalytics[0])).params).toEqual({ new_player: true, lang: 'he' });
});

test('analytics can be turned off, and it stays off', async ({ page }) => {
  await recordAnalytics(page);
  await open(page);
  await page.click('#ttlSettings');
  await page.click('#setAnalytics');
  await expect(page.locator('#setAnalytics')).toHaveText('📊 נתוני שימוש: כבוי');
  const before = (await events(page)).length;
  await page.click('#setClose');
  await page.click('#ttlGhost', { force: true }); // aria-disabled, but a real tap still lands
  await page.click('#ttlPlay');
  expect((await events(page)).length).toBe(before);
  await page.reload();
  await page.waitForFunction(() => !!window.__sky);
  expect(await events(page)).toEqual([]);                             // not even the page view
});

test('starting from the title screen does not change the game', async ({ page }) => {
  const errors = await open(page);
  const res = await page.evaluate(runBattle, { mode: 'campaign', diff: 'easy', seed: 1 });
  expect({ ...res, errors }).toEqual(baseline.find(b => b.mode === 'campaign' && b.diff === 'easy'));
});

// ---------------------------------------------------------------- phones, both languages
const PHONES = [{ name: 'landscape', viewport: { width: 844, height: 390 } }, { name: 'portrait', viewport: { width: 390, height: 844 } }];
const LANGS = [{ lang: 'he', locale: 'he-IL' }, { lang: 'en', locale: 'en-US' }];

for (const { lang, locale } of LANGS) for (const phone of PHONES) {
  test.describe(`phone ${phone.name} (${lang})`, () => {
    test.use({ viewport: phone.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale });

    // everything on screen at once: Continue, guest line, every small button
    test('fits without scrolling or overlaps', async ({ page }, info) => {
      await seed(page, RETURNING, { skysiege_lang: lang });
      await page.addInitScript(installFakeCloud, {});
      const errors = await open(page);
      await saved(page);
      await fontsLoaded(page);
      await page.waitForTimeout(200);
      const file = `tests/screenshots/${info.project.name}-${lang}-${phone.name}-title.png`;
      await page.screenshot({ path: file });
      await info.attach(`${lang}-${phone.name}-title`, { path: file, contentType: 'image/png' });

      const layout = await page.evaluate(() => {
        const s = document.getElementById('titleScreen');
        const els = [...s.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.dataset.tm, l: r.left, r: r.right, t: r.top, b: r.bottom }; });
        const hit = (a, b) => a.l < b.r - .5 && b.l < a.r - .5 && a.t < b.b - .5 && b.t < a.b - .5;
        return {
          scrolls: s.scrollHeight > s.clientHeight + 1,
          count: els.length,
          outside: els.filter(e => e.l < 0 || e.t < 0 || e.r > innerWidth || e.b > innerHeight).map(e => e.id),
          overlaps: els.flatMap((a, i) => els.slice(i + 1).filter(b => hit(a, b)).map(b => `${a.id} / ${b.id}`)),
        };
      });
      expect(layout).toEqual({ scrolls: false, count: 9, outside: [], overlaps: [] }); // play, continue, 3 modes, google, 3 small
      if (lang === 'en') {
        const visible = await page.evaluate(() => [...document.querySelectorAll('#titleScreen *')].filter(e => e.id !== 'ttlLang' && !e.children.length && e.getClientRects().length).map(e => e.textContent));
        expect(visible.filter(s => /[֐-׿]/.test(s))).toEqual([]);
      }
      expect(errors).toEqual([]);
    });

    test('a new player reaches the tutorial battle in one tap', async ({ page }) => {
      await page.addInitScript(l => localStorage.setItem('skysiege_lang', l), lang);
      const errors = await open(page);
      await page.locator('#ttlPlay').tap();
      expect(await page.evaluate(() => [window.__sky.G.state, window.__sky.tutorial().active])).toEqual(['play', true]);
      expect(errors).toEqual([]);
    });
  });
}
