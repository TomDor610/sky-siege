import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runBattle } from './helpers/autopilot.js';
import { openGame } from './helpers/page.js';

const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));
const snd = page => page.evaluate(() => window.__sky.sound());

// A real (trusted) click unlocks the AudioContext, like a player's first tap.
async function unlockAudio(page) {
  await page.click('#musicToggle'); // toggles music off...
  await page.click('#musicToggle'); // ...and back on
  await expect.poll(async () => (await snd(page)).state).toBe('running');
}

for (const [mode, diff] of [['duel', 'medium'], ['campaign', 'easy']]) {
  test(`audio on: autopilot still matches baseline (${mode} / ${diff})`, async ({ page }) => {
    const errors = await openGame(page);
    await unlockAudio(page);
    const res = await page.evaluate(runBattle, { mode, diff, seed: 1 });
    expect({ ...res, errors }).toEqual(baseline.find(b => b.mode === mode && b.diff === diff));
    const s = await snd(page);
    expect(s.played.drop).toBeGreaterThan(0);
    expect(s.played.boom).toBeGreaterThan(0);
    expect(s.voices).toBeLessThanOrEqual(24); // a burst of events cannot pile up voices
    expect(s.music).toBe('menu');             // back to workshop music on the result screen
  });
}

test('music follows the screens; pause ducks it', async ({ page }) => {
  const errors = await openGame(page);
  await unlockAudio(page);
  expect((await snd(page)).music).toBe('menu');
  await page.click('#launchBtn');
  expect((await snd(page)).music).toBe('battle');
  await page.click('#pauseBtn');
  await page.click('#quitBtn');
  await expect(page.locator('#resultScreen')).toBeVisible();
  expect((await snd(page)).music).toBe('menu');
  expect((await snd(page)).played.lose).toBe(1);
  expect(errors).toEqual([]);
});

test('mute button in battle, M key, and the setting survives a reload', async ({ page }) => {
  const errors = await openGame(page);
  await unlockAudio(page);
  await page.click('#launchBtn');
  const btn = page.locator('#soundBtn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('🔊');
  await btn.click();
  await expect(btn).toHaveText('🔇');
  expect((await snd(page)).settings.muted).toBe(true);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('skysiege_sound'))).muted).toBe(true);

  await page.reload();
  await page.waitForFunction(() => !!window.__sky);
  expect((await snd(page)).settings.muted).toBe(true);
  await expect(page.locator('#sfxToggle')).toContainText('כבויים');
  await page.click('#launchBtn');
  await expect(btn).toHaveText('🔇');
  await page.keyboard.press('m');
  await expect(btn).toHaveText('🔊');
  expect((await snd(page)).settings.muted).toBe(false);
  expect(errors).toEqual([]);
});

test('workshop toggles for effects and music', async ({ page }) => {
  const errors = await openGame(page);
  const fx = page.locator('#sfxToggle'), mu = page.locator('#musicToggle');
  await expect(fx).toHaveText('🔊 אפקטים: פועלים');
  await expect(mu).toHaveText('🎵 מוזיקה: פועלת'); // music on by default
  await mu.click();
  await expect(mu).toHaveText('🎵 מוזיקה: כבויה');
  await fx.click();
  await expect(fx).toHaveText('🔊 אפקטים: כבויים');
  await page.reload();
  await page.waitForFunction(() => !!window.__sky);
  expect((await snd(page)).settings).toEqual({ muted: false, sfx: false, music: false });
  await expect(mu).toHaveText('🎵 מוזיקה: כבויה');
  expect(errors).toEqual([]);
});
