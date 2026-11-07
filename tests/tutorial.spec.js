import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runBattle } from './helpers/autopilot.js';
import { openGame } from './helpers/page.js';

const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));
const tut = page => page.evaluate(() => window.__sky.tutorial());

// The autopilot plays a fresh player's first battle, so the tutorial is active
// for the whole battle. It must follow along and must not change the outcome.
// did = actions the autopilot actually performs in that battle (duel/hard is lost
// after 22s, before it ever climbs or turns).
const ALL = ['climb', 'descend', 'flip', 'bomb'];
for (const [mode, diff, did] of [['duel', 'easy', ALL], ['duel', 'hard', ['descend', 'bomb']], ['campaign', 'easy', ALL], ['campaign', 'medium', ALL]]) {
  test(`tutorial does not break the autopilot: ${mode} / ${diff}`, async ({ page }) => {
    const errors = await openGame(page);
    const res = await page.evaluate(runBattle, { mode, diff, seed: 1 });

    // identical to the original game (recorded before the tutorial existed)
    expect({ ...res, errors }).toEqual(baseline.find(b => b.mode === mode && b.diff === diff));

    const info = await tut(page);
    expect(info.active).toBe(false);
    expect(info.stored).toBe('done');
    // it recognized what the autopilot did; bubbles for actions already done are skipped
    expect(info.did).toEqual(expect.arrayContaining(did));
    expect(info.seen[0]).toBe('climb');
    await expect(page.locator('#tut')).toBeHidden();
  });
}

test('tutorial bubble reacts to the player, then never shows again', async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => { document.querySelector('#modeSeg button[data-m="duel"]').click(); window.__sky.start(); });
  const bubble = page.locator('#tut');
  await expect(bubble).toBeVisible();
  await expect(page.locator('#tutTxt')).toContainText('לטפס');
  await expect(page.locator('#tutStep')).toHaveText('הדרכה 1/5');
  await expect(page.locator('#tip')).toBeHidden();

  // hold "up" -> moves on to "descend"
  await page.evaluate(() => { const s = window.__sky; s.input.up = true; s.step(30); s.input.up = false; });
  expect((await tut(page)).step).toBe('descend');
  await expect(page.locator('#tutTxt')).toContainText('לרדת');

  await page.evaluate(() => { const s = window.__sky; s.input.down = true; s.step(30); s.input.down = false; });
  expect((await tut(page)).step).toBe('flip');
  await expect(page.locator('#tutTxt')).toContainText('להסתובב');

  await page.evaluate(() => { window.__sky.press('flip'); window.__sky.step(2); });
  expect((await tut(page)).step).toBe('bomb');
  await expect(page.locator('#tutTxt')).toContainText('טירת היריב');

  await page.evaluate(() => { window.__sky.press('bomb'); window.__sky.step(2); });
  expect((await tut(page)).step).toBe('rearm');
  await expect(page.locator('#tutTxt')).toContainText('יפה');

  // finish this battle: the tutorial counts as seen
  await page.evaluate(() => { const s = window.__sky; s.G.foe.hp = 0; s.step(400); });
  await expect(page.locator('#resultScreen')).toBeVisible();
  expect((await tut(page)).stored).toBe('done');

  // second battle, and after a reload: no tutorial
  await page.evaluate(() => window.__sky.start());
  await expect(bubble).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => !!window.__sky);
  await page.evaluate(() => window.__sky.start());
  expect((await tut(page)).active).toBe(false);
  await expect(bubble).toBeHidden();
  expect(errors).toEqual([]);
});

test('skip button hides the tutorial for good', async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => window.__sky.start());
  await expect(page.locator('#tut')).toBeVisible();
  await page.click('#tutSkip');
  await expect(page.locator('#tut')).toBeHidden();
  const info = await tut(page);
  expect(info.active).toBe(false);
  expect(info.stored).toBe('skipped');
  await page.evaluate(() => window.__sky.step(120));
  await expect(page.locator('#tut')).toBeHidden();
  await page.evaluate(() => window.__sky.start());
  await expect(page.locator('#tut')).toBeHidden();
  expect(errors).toEqual([]);
});

test('existing players with progress never see the tutorial', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('skysiege_prog'))
      localStorage.setItem('skysiege_prog', JSON.stringify({ coins: 300, upg: { frame: 1 }, xp: 150, wins: { easy: 2 } }));
  });
  const errors = await openGame(page);
  await page.evaluate(() => window.__sky.start());
  expect((await tut(page)).active).toBe(false);
  await expect(page.locator('#tut')).toBeHidden();
  await expect(page.locator('#tip')).toBeVisible(); // the regular start tip still appears
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test('highlights the matching touch button', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__sky.start());
    await expect(page.locator('.tbtn[data-k="up"]')).toHaveClass(/\btut\b/);
    await expect(page.locator('#tutTxt')).toContainText('▲');
    await page.evaluate(() => { const s = window.__sky; s.input.up = true; s.step(30); s.input.up = false; });
    await expect(page.locator('.tbtn[data-k="up"]')).not.toHaveClass(/\btut\b/);
    await expect(page.locator('.tbtn[data-k="down"]')).toHaveClass(/\btut\b/);
    await page.locator('#tutSkip').tap();
    await expect(page.locator('#tut')).toBeHidden();
    await expect(page.locator('.tbtn.tut')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
