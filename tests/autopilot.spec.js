import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runBattle, MATRIX } from './helpers/autopilot.js';
import { openGame } from './helpers/page.js';

const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));

for (const { mode, diff } of MATRIX) {
  test.describe(`${mode} / ${diff}`, () => {
    for (const seed of [1, 2, 3]) {
      test(`autopilot battle ends cleanly (seed ${seed})`, async ({ page }) => {
        const errors = await openGame(page);
        const res = await page.evaluate(runBattle, { mode, diff, seed });
        expect(errors).toEqual([]);
        expect(res.ended, `battle did not end: ${JSON.stringify(res)}`).toBe(true);
        expect(['wonDone', 'lostDone']).toContain(res.state);
        expect(res.resultVisible).toBe(true);
        if (mode === 'duel') expect(res.t).toBeLessThanOrEqual(150 + 3);
      });
    }

    // Parity with the original single-file game (recorded in tests/baseline.json
    // from commit a8bd6f9). If gameplay/balance changes ON PURPOSE, regenerate:
    //   node tests/tools/make-baseline.mjs http://localhost:5173/
    test('matches baseline (seed 1)', async ({ page }) => {
      const errors = await openGame(page);
      const res = await page.evaluate(runBattle, { mode, diff, seed: 1 });
      const expected = baseline.find(b => b.mode === mode && b.diff === diff);
      expect({ ...res, errors }).toEqual(expected);
    });
  });
}

test('campaign advances to the next castle level after a win', async ({ page }) => {
  const errors = await openGame(page);
  const first = await page.evaluate(runBattle, { mode: 'campaign', diff: 'easy', seed: 1 });
  expect(first.state).toBe('wonDone');
  const lvl = await page.evaluate(() => { window.__sky.start(); return window.__sky.G.foe.lvl; });
  expect(lvl).toBe(2);
  const second = await page.evaluate(runBattle, { mode: 'campaign', diff: 'easy', seed: 2 });
  expect(second.ended).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('skysiege_prog')));
  expect(saved.wins.easy).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});
