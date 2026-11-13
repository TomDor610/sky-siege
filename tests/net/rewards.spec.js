// 1v1 stage 5: coins, XP and the record against a friend, with two real browsers.
import { test, expect } from '@playwright/test';
import { joinPlayer, createRoom, joinByCode } from './helpers.js';

const WAIT = { timeout: 15_000 };
const W = 4000;
let all = [];
const make = async (browser, info, opts) => { const p = await joinPlayer(browser, info, opts); all.push(p); return p.open(); };
test.afterEach(async () => {
  const errors = all.flatMap(p => p.errors);
  await Promise.all(all.map(p => p.close().catch(() => {})));
  all = [];
  expect(errors).toEqual([]);
});

async function toBattle(browser, info, opts = {}) {
  const host = await make(browser, info, opts), guest = await make(browser, info, opts);
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(host.page.locator('#roomStart')).toBeVisible(WAIT);
  await host.page.click('#roomStart');
  for (const p of [host, guest]) await expect(p.page.locator('#vsReady')).toBeVisible(WAIT);
  await host.page.click('#vsReady'); await guest.page.click('#vsReady');
  for (const p of [host, guest]) await p.page.waitForFunction(() => window.__sky.net().phase === 'play', null, { timeout: 30_000 });
  return { host, guest };
}
const G = (p, f, a) => p.page.evaluate(f, a);
const prog = p => G(p, () => JSON.parse(JSON.stringify(window.__sky.prog)));
const uidOf = p => G(p, () => window.__sky.room().room.uid);
// both drop a bomb over the other's castle (a real battle needs a bomb from each side)
async function bombEachOther(host, guest) {
  for (const p of [host, guest]) {
    await G(p, x => { const m = window.__sky.G.me; Object.assign(m, { x, y: 600, p: 0, s: 265, vz: 0, flip: 0 }); window.__sky.press('bomb'); }, W - 150 - 220);
  }
  await expect.poll(() => G(host, () => window.__sky.net().oppBombs), WAIT).toBeGreaterThan(0);
  await expect.poll(() => G(guest, () => window.__sky.net().oppBombs), WAIT).toBeGreaterThan(0);
}
const until = (p, secs) => p.page.waitForFunction(s => window.__sky.G && window.__sky.G.t >= s, secs, { timeout: (secs + 20) * 1000 });
const fell = p => G(p, () => { window.__sky.G.mine.hp = 0; });

test('a short battle: no coins, but the record counts on both sides', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  const [h0, g0] = [await prog(host), await prog(guest)];
  const [hu, gu] = [await uidOf(host), await uidOf(guest)];
  await fell(guest);
  for (const p of [host, guest]) await expect(p.page.locator('#earn')).toContainText('קרב קצר מ-45 שניות: בלי פרס', WAIT);
  await expect(host.page.locator('#earn')).toContainText('המאזן מול');
  await expect(host.page.locator('#earn .vsRecord')).toContainText('1–0');
  await expect(guest.page.locator('#earn .vsRecord')).toContainText('0–1');
  const [h1, g1] = [await prog(host), await prog(guest)];
  expect(h1.coins).toBe(h0.coins); expect(g1.coins).toBe(g0.coins);
  expect(h1.xp).toBe(h0.xp);
  expect(h1.vs[gu]).toMatchObject({ w: 1, l: 0, d: 0, s: 1 });
  expect(g1.vs[hu]).toMatchObject({ w: 0, l: 1, d: 0, s: -1 });
  expect(h1.vsDay.f[gu]).toBeUndefined();                     // not one of the 3 full games
  // the records reach the cloud (the Firestore rules accept the new fields)
  await expect.poll(() => G(host, () => window.__sky.cloud().status), WAIT).toBe('saved');
});

test('a real battle (45 s, bombs on both sides): coins and XP for both, the winner more', async ({ browser }, info) => {
  test.setTimeout(150_000);
  const { host, guest } = await toBattle(browser, info);
  const [h0, g0] = [await prog(host), await prog(guest)];
  await bombEachOther(host, guest);
  await until(host, 46);
  await fell(guest);
  for (const p of [host, guest]) await expect(p.page.locator('#resultScreen')).toBeVisible(WAIT);
  const [hr, gr] = [await G(host, () => window.__sky.net().reward), await G(guest, () => window.__sky.net().reward)];
  expect(hr.factor).toBe(1); expect(gr.factor).toBe(1);
  expect(hr.coins).toBeGreaterThan(gr.coins);
  expect(gr.coins).toBeGreaterThan(0);
  const [h1, g1] = [await prog(host), await prog(guest)];
  expect(h1.coins - h0.coins).toBe(hr.coins);
  expect(g1.coins - g0.coins).toBe(gr.coins);
  expect(h1.xp).toBeGreaterThan(h0.xp);
  await expect(host.page.locator('#earn')).toContainText('ניצחון');
  await expect(host.page.locator('#earn')).toContainText(`+${hr.coins} 🪙`);
  await expect(host.page.locator('#earn')).toContainText('מכפיל קרב מול חבר');
  expect(Object.values(h1.vsDay.f)).toEqual([1]);               // the first full game against this friend today
});

test('a draw after 45 s: the draw bonus for both', async ({ browser }, info) => {
  test.setTimeout(150_000);
  const { host, guest } = await toBattle(browser, info);
  await bombEachOther(host, guest);
  await until(host, 46);
  await Promise.all([fell(host), fell(guest)]);
  for (const p of [host, guest]) {
    await expect(p.page.locator('#resTitle')).toHaveText('תיקו!', WAIT);
    await expect(p.page.locator('#earn')).toContainText('תיקו');
    await expect(p.page.locator('#earn .vsRecord')).toContainText('(1 תיקו)');
  }
});

test('add the friend from the result screen', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  const gu = await uidOf(guest);
  await fell(guest);
  await expect(host.page.locator('#vsAddFriend')).toBeVisible(WAIT);
  await host.page.click('#vsAddFriend');
  await expect(host.page.locator('#vsResMsg')).toHaveText('נוסף לחברים ✓');
  await expect(host.page.locator('#vsAddFriend')).toBeHidden();
  expect((await prog(host)).friends).toContain(gu);
});

const PHONES = [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]];
for (const [lang, locale] of [['he', 'he-IL'], ['en', 'en-US']]) for (const [phone, viewport] of PHONES) {
  test(`phone ${phone} (${lang}): the result with rewards and the record`, async ({ browser }, info) => {
    const { host, guest } = await toBattle(browser, info, { locale, viewport, mobile: true });
    await fell(guest);
    await expect(host.page.locator('#earn .vsRecord')).toBeVisible(WAIT);
    await host.page.waitForTimeout(300);
    await host.page.screenshot({ path: `tests/screenshots/${info.project.name}-${lang}-${phone}-vs-reward.png` });
    // everything can be reached: the card scrolls if it is taller than the screen
    for (const id of ['#vsRematch', '#vsExit', '#vsAddFriend']) {
      await host.page.locator(id).scrollIntoViewIfNeeded();
      const b = await host.page.locator(id).boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
    }
    if (lang === 'en') expect(/[֐-׿]/.test(await host.page.locator('#resultScreen').innerText())).toBe(false);
  });
}
