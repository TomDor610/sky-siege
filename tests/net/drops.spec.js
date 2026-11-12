// 1v1 stage 4: drops in the middle of a battle, and emoji. Two real browsers against the
// Firebase emulators; a player's connection is cut by closing its WebSocket (lag: 1 puts a
// proxy in the way, see helpers.js).
import { test, expect } from '@playwright/test';
import { joinPlayer, createRoom, joinByCode, cutNetwork, restoreNetwork, readRoom } from './helpers.js';

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
  const host = await make(browser, info, opts.host || {}), guest = await make(browser, info, opts.guest || {});
  if (opts.beforeJoin) await opts.beforeJoin(host, guest);
  const code = await createRoom(host);
  await joinByCode(guest, code);
  await expect(host.page.locator('#roomStart')).toBeVisible(WAIT);
  await host.page.click('#roomStart');
  for (const p of [host, guest]) await expect(p.page.locator('#vsReady')).toBeVisible(WAIT);
  await host.page.click('#vsReady'); await guest.page.click('#vsReady');
  for (const p of [host, guest]) await p.page.waitForFunction(() => window.__sky.net().phase === 'play', null, { timeout: 30_000 });
  return { host, guest, code };
}
const G = (p, f, a) => p.page.evaluate(f, a);
const net = p => G(p, () => window.__sky.net());
const park = (p, x = 2000, y = 300) => p.page.evaluate(([x, y]) => {
  clearInterval(window.__park);
  window.__park = setInterval(() => { const m = window.__sky.G && window.__sky.G.me; if (m && !m.dead) Object.assign(m, { x, y, p: 0, s: 265, vz: 0, flip: 0 }); }, 30);
}, [x, y]);
const title = p => p.page.locator('#resTitle');
const banner = p => p.page.locator('#vsNet');
const hide = (p, hidden) => p.page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);

test('a short drop: both see the countdown, the battle goes on, and shots fired meanwhile still land', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const { host, guest } = await toBattle(browser, info, { guest: { lag: 1 } });
  await park(guest);
  const max = await G(guest, () => window.__sky.G.mine.max);
  await cutNetwork(guest);
  await expect(banner(host)).toContainText('החבר התנתק', WAIT);
  await expect(banner(guest)).toContainText('החיבור אבד', WAIT);
  expect(await G(host, () => window.__sky.G.opp.away)).toBe(true);
  // the host bombs the absent guest's castle: nothing happens yet (its owner is away)
  await park(host, W - 150 - 220 - 20, 600);
  for (let i = 0; i < 4; i++) { await G(host, () => window.__sky.press('bomb')); await host.page.waitForTimeout(300); }
  await host.page.waitForTimeout(1500);
  expect(await G(host, () => window.__sky.G.foe.hp)).toBe(max);
  restoreNetwork(guest);
  for (const p of [host, guest]) await expect(banner(p)).toBeHidden({ timeout: 20_000 });
  // back: the bombs reach the guest's castle, and the host sees it
  await expect.poll(() => G(guest, () => window.__sky.G.mine.hp), WAIT).toBeLessThan(max - 20);
  await expect.poll(() => G(host, () => window.__sky.G.foe.hp), WAIT).toBeLessThan(max - 20);
  for (const p of [host, guest]) expect((await net(p)).result).toBe(null);
  expect(await G(host, () => window.__sky.G.opp.away)).toBe(false);
});

test('a long drop: a technical loss on both screens, even after the line comes back', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const { host, guest } = await toBattle(browser, info, { guest: { lag: 1 } });
  await cutNetwork(guest);
  await expect(banner(host)).toContainText('החבר התנתק', WAIT);
  await expect(title(host)).toHaveText('ניצחון טכני ⚔', { timeout: 40_000 });
  await expect(title(guest)).toHaveText('הפסד טכני', { timeout: 40_000 });
  await expect(guest.page.locator('#resText')).toHaveText('החיבור שלך אבד ליותר מ-20 שניות.');
  restoreNetwork(guest);
  await guest.page.waitForTimeout(5000);
  await expect(title(guest)).toHaveText('הפסד טכני');
  expect((await net(guest)).result).toBe('techLost');
  expect(Object.keys((await net(host)).forfeit)).toHaveLength(1);
});

test('the host never comes back: the guest wins and closes the room on the way out', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const { host, guest, code } = await toBattle(browser, info, { host: { lag: 1 } });
  await cutNetwork(host);
  await expect(banner(guest)).toContainText('החבר התנתק', WAIT);
  await expect(title(guest)).toHaveText('ניצחון טכני ⚔', { timeout: 40_000 });
  expect(await readRoom(code)).not.toBe(null);                          // the room waited for the host
  await guest.page.click('#vsExit');
  await expect(guest.page.locator('#roomMsg')).toHaveText('המארח עזב את החדר', WAIT);
  await expect.poll(() => readRoom(code), WAIT).toBe(null);
});

test('a hidden game counts as away until it is shown again', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await hide(host, true);
  await expect(banner(guest)).toContainText('החבר התנתק', WAIT);
  await hide(host, false);
  await expect(banner(guest)).toBeHidden(WAIT);
  expect((await net(guest)).result).toBe(null);
});

test('a frozen game (nothing sent) is noticed, and after 25 s it is a technical loss', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const { host, guest, code } = await toBattle(browser, info);
  await G(host, () => { window.requestAnimationFrame = () => 0; });     // the game loop stops, the line stays
  await expect(banner(guest)).toContainText('החבר לא מגיב', WAIT);
  await expect(title(guest)).toHaveText('ניצחון טכני ⚔', { timeout: 40_000 });
  await expect(guest.page.locator('#vsRematch')).toBeDisabled();
  // the host's line is still up (no away mark): its forfeit is enough to close the room on the way out
  await guest.page.click('#vsExit');
  await expect(guest.page.locator('#roomMsg')).toHaveText('המארח עזב את החדר', WAIT);
  await expect.poll(() => readRoom(code), WAIT).toBe(null);
});

test('a short drop with a 200 ms round trip', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const { host, guest } = await toBattle(browser, info, { host: { lag: 100 }, guest: { lag: 100 } });
  await cutNetwork(guest);
  await expect(banner(host)).toContainText('החבר התנתק', WAIT);
  await guest.page.waitForTimeout(3000);
  restoreNetwork(guest);
  for (const p of [host, guest]) await expect(banner(p)).toBeHidden({ timeout: 20_000 });
  for (const p of [host, guest]) expect((await net(p)).result).toBe(null);
});

test('emoji: a bubble on both screens, one every 3 s, by button or key', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await host.page.click('#emojiBtn');
  await expect(host.page.locator('#emojiBar')).toBeVisible();
  await host.page.locator('#emojiBar .emo').nth(1).click();                       // 👍
  await expect(host.page.locator('#emojiBar')).toBeHidden();
  await expect.poll(() => G(guest, () => (window.__sky.G.bubbles || []).map(b => b.side + b.e).join()), WAIT).toBe('R👍');
  expect(await G(host, () => window.__sky.G.bubbles.map(b => b.side + b.e).join())).toBe('L👍');
  // too soon: refused
  await host.page.keyboard.press('3');
  await guest.page.waitForTimeout(800);
  expect((await net(guest)).emojiGot).toBe(1);
  await expect(host.page.locator('#emojiBar .emo').first()).toBeDisabled();
  await host.page.waitForTimeout(2600);
  await host.page.keyboard.press('3');                                            // 😂
  await expect.poll(() => net(guest).then(n => n.emojiGot), WAIT).toBe(2);
  expect(await G(guest, () => window.__sky.G.bubbles.map(b => b.e).join())).toBe('😂');
  // and on the result screen
  await G(guest, () => { window.__sky.G.mine.hp = 0; });
  await expect(host.page.locator('#vsEmojiRow')).toBeVisible(WAIT);
  await host.page.waitForTimeout(3100);
  await host.page.locator('#vsEmojiRow .emo').first().click();                    // 👋
  await expect(guest.page.locator('#vsToast')).toContainText('👋', WAIT);
});

test('emoji from the friend can be turned off in the settings', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info, {
    beforeJoin: async (h, g) => {
      await g.page.click('#ttlSettings');
      await expect(g.page.locator('#setEmoji')).toHaveText("😀 אימוג'י מהחבר: פועל");
      await g.page.click('#setEmoji');
      await expect(g.page.locator('#setEmoji')).toHaveText("😀 אימוג'י מהחבר: כבוי");
      await g.page.click('#setClose');
    },
  });
  await host.page.click('#emojiBtn');
  await host.page.locator('#emojiBar .emo').first().click();
  await guest.page.waitForTimeout(1500);
  expect((await net(guest)).emojiGot).toBe(0);
  expect(await G(guest, () => window.__sky.G.bubbles.length)).toBe(0);
  expect(await G(guest, () => localStorage.getItem('skysiege_emoji'))).toBe('0');
});

const PHONES = [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]];
for (const [lang, locale] of [['he', 'he-IL'], ['en', 'en-US']]) for (const [phone, viewport] of PHONES) {
  test(`phone ${phone} (${lang}): the drop banner and the emoji row fit`, async ({ browser }, info) => {
    test.setTimeout(120_000);
    const o = { locale, viewport, mobile: true };
    const { host, guest } = await toBattle(browser, info, { host: o, guest: { ...o, lag: 1 } });
    const shot = label => host.page.screenshot({ path: `tests/screenshots/${info.project.name}-${lang}-${phone}-vs-${label}.png` });
    const inside = async sel => {
      const b = await host.page.locator(sel).boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
    };
    await host.page.locator('#emojiBtn').tap();
    await expect(host.page.locator('#emojiBar')).toBeVisible();
    await inside('#emojiBar');
    await shot('emoji');
    await host.page.locator('#emojiBar .emo').nth(6).tap();
    await cutNetwork(guest);
    await expect(banner(host)).toBeVisible(WAIT);
    await inside('#vsNet');
    await host.page.waitForTimeout(400);
    await shot('drop');
    if (lang === 'en') expect(/[֐-׿]/.test(await banner(host).innerText())).toBe(false);
    restoreNetwork(guest);
  });
}
