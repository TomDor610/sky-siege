import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runBattle } from './helpers/autopilot.js';
import { openGame } from './helpers/page.js';

// The 2.5D art pass: the Classic machine is drawn from sprites when beta is on (?beta=1).
// Drawing must never change the simulation, and every part count must draw without errors.
const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));
const beta = page => page.addInitScript(() => localStorage.setItem('skysiege_beta', '1'));
const frames = (page, n) => page.evaluate(n => new Promise(r => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);

test('beta sprites: autopilot still matches baseline', async ({ page }) => {
  await beta(page);
  const errors = await openGame(page);
  await frames(page, 5);
  const res = await page.evaluate(runBattle, { mode: 'duel', diff: 'medium', seed: 1 });
  expect({ ...res, errors }).toEqual(baseline.find(b => b.mode === 'duel' && b.diff === 'medium'));
});

for (const parts of [{ wings: 1, props: 1, bombs: 3 }, { wings: 2, props: 2, bombs: 12 }, { wings: 4, props: 4, bombs: 6, armor: 3 }]) {
  test(`beta sprites: classic draws in battle (${JSON.stringify(parts)})`, async ({ page }) => {
    await beta(page);
    await page.addInitScript(p => localStorage.setItem('skysiege_build2', JSON.stringify({ style: 'classic', bombType: 'stone', armor: 0, crossbows: 0, ...p })), parts);
    const errors = await openGame(page);
    await frames(page, 5);
    await page.click('#launchBtn');
    await frames(page, 90);
    await page.evaluate(() => window.__sky.step(120));
    await frames(page, 30);
    expect(errors).toEqual([]);
  });
}

test('beta sprites: falcon draws in the workshop preview', async ({ page }) => {
  await beta(page);
  await page.addInitScript(() => localStorage.setItem('skysiege_build2', JSON.stringify({ style: 'classic', bombType: 'stone', wings: 2, props: 2, armor: 1, bombs: 6, crossbows: 0 })));
  const errors = await openGame(page);
  await page.click('#styles button:nth-child(2)'); // falcon (locked styles can still be previewed)
  await frames(page, 30);
  expect(errors).toEqual([]);
});
