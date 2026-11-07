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

      // HUD buttons must not sit on top of the HUD boxes or the tutorial bubble
      const overlaps = await page.evaluate(() => {
        const box = el => { const r = el.getBoundingClientRect(); return { el: el.id || el.querySelector('span')?.id, l: r.left, r: r.right, t: r.top, b: r.bottom }; };
        const btns = ['pauseBtn', 'soundBtn'].map(id => box(document.getElementById(id)));
        const others = [...document.querySelectorAll('#hud .hbox'), document.getElementById('tut')]
          .filter(el => el.getClientRects().length > 0).map(box); // visible only
        const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
        return btns.flatMap(a => others.filter(b => hit(a, b)).map(b => `${a.el} overlaps ${b.el}`));
      });
      expect(overlaps).toEqual([]);

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
