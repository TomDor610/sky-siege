import { test, expect } from '@playwright/test';
import { runBattle } from './helpers/autopilot.js';
import { openGame } from './helpers/page.js';

// Phone screenshots, landscape and portrait. Saved to tests/screenshots/
// (git-ignored) and attached to the test report.
const PHONES = [
  { name: 'landscape', viewport: { width: 844, height: 390 } },
  { name: 'portrait', viewport: { width: 390, height: 844 } },
];

for (const phone of PHONES) {
  test.describe(`phone ${phone.name}`, () => {
    test.use({ viewport: phone.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

    test('screenshots: workshop, battle, result', async ({ page }, info) => {
      const errors = await openGame(page);
      await page.evaluate(() => document.fonts.ready);
      const shot = async label => {
        const file = `tests/screenshots/${info.project.name}-${phone.name}-${label}.png`;
        await page.screenshot({ path: file });
        await info.attach(`${phone.name}-${label}`, { path: file, contentType: 'image/png' });
      };
      const frames = n => page.evaluate(n => new Promise(r => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);

      await frames(3);
      await shot('workshop');
      await expect(page.locator('#buildScreen')).toBeVisible();

      // duel, a few seconds in
      await page.evaluate(() => {
        document.querySelector('#modeSeg button[data-m="duel"]').click();
        window.__sky.start();
        window.__sky.step(240);
      });
      await frames(3);
      await expect(page.locator('#hud')).toBeVisible();
      await expect(page.locator('#touch')).toBeVisible(); // touch controls on a phone
      await shot('duel');

      // campaign, then the result screen
      const res = await page.evaluate(runBattle, { mode: 'campaign', diff: 'easy', seed: 1 });
      expect(res.ended).toBe(true);
      await frames(3);
      await expect(page.locator('#resultScreen')).toBeVisible();
      await shot('result');

      expect(errors).toEqual([]);
    });
  });
}
