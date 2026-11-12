// 1v1 stage 3: the battle itself, with two real browsers against the Firebase emulators.
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

// host + guest in one room, through the build and the reveal, until the battle runs
async function toBattle(browser, info, opts = {}) {
  const host = await make(browser, info, opts.host || opts), guest = await make(browser, info, opts.guest || opts);
  await joinByCode(guest, await createRoom(host));
  await expect(host.page.locator('#roomStart')).toBeVisible(WAIT);
  await host.page.click('#roomStart');
  for (const p of [host, guest]) await expect(p.page.locator('#vsReady')).toBeVisible(WAIT);
  if (opts.before) await opts.before(host, guest);
  await host.page.click('#vsReady'); await guest.page.click('#vsReady');
  for (const p of [host, guest]) await p.page.waitForFunction(() => window.__sky.net().phase === 'play', null, { timeout: 30_000 }).catch(async e => {
    const st = p => p.page.evaluate(() => { const r = window.__sky.room().room; return { state: r && r.meta.state, round: r && r.meta.round, battleAt: r && r.meta.battleAt, net: window.__sky.net(), G: !!window.__sky.G }; });
    throw new Error('not in the battle: host ' + JSON.stringify(await st(host)) + ' guest ' + JSON.stringify(await st(guest)) + '; ' + e.message);
  });
  return { host, guest };
}
const net = p => p.page.evaluate(() => window.__sky.net());
const G = (p, f) => p.page.evaluate(f);
// keep a plane in one spot (out of the defenses' reach by default), for steady tests
// (s: speed; a slow plane is not "led" by the defenses, which aim ahead of a moving target)
const park = (p, x = 2000, y = 300, s = 265) => p.page.evaluate(([x, y, s]) => {
  clearInterval(window.__park);
  window.__park = setInterval(() => { const m = window.__sky.G && window.__sky.G.me; if (m && !m.dead) Object.assign(m, { x, y, p: 0, s, vz: 0, flip: 0 }); }, 30);
}, [x, y, s]);
const unpark = p => p.page.evaluate(() => clearInterval(window.__park));
const fell = p => p.page.evaluate(() => { window.__sky.G.mine.hp = 0; });
const title = p => p.page.locator('#resTitle');

test('start: same countdown on both sides, no pause; each player is on the left and sees the friend mirrored', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  for (const p of [host, guest]) {
    expect((await net(p)).counted).toBe(true);                                       // a 3-2-1 was shown
    await expect(p.page.locator('#pauseBtn')).toBeHidden();
    await expect(p.page.locator('#tut')).toBeHidden();
    await expect(p.page.locator('#vsCount')).toBeHidden(WAIT);
  }
  // the battle clocks agree: each follows its own estimate of the server clock, which the
  // emulator gives only roughly (the real server is usually closer); the time-up rule has 1 s to spare
  const [a, b] = await Promise.all([G(host, () => window.__sky.G.t), G(guest, () => window.__sky.G.t)]);
  expect(Math.abs(a - b)).toBeLessThan(1);
  // the host parks on its left; the guest sees it on its right, at the mirrored spot
  await park(host, 700, 400);
  await expect.poll(() => G(guest, () => Math.abs(window.__sky.G.opp.x - (4000 - 700))), WAIT).toBeLessThan(60);
  expect(await G(guest, () => window.__sky.G.me.x)).toBeLessThan(W / 2);             // the guest itself is on the left
  expect(await G(guest, () => window.__sky.G.opp.facing)).toBe(-(await G(host, () => window.__sky.G.me.facing)));
  // the same world decoration from the shared seed
  const deco = p => p.page.evaluate(() => window.__sky.deco());
  expect(await deco(host)).toEqual(await deco(guest));
});

test('the friend\'s plane moves smoothly and follows the real one ~110 ms behind', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await park(guest);
  // the host flies freely; both record (server time, x) every frame for 3 s
  const rec = (p, who) => p.page.evaluate(who => new Promise(res => {
    const out = [], end = performance.now() + 3000;
    const f = () => { const n = window.__sky.net(), pl = window.__sky.G[who]; out.push([Date.now(), pl.x, pl.y, pl.dead, n.delay]); if (performance.now() < end) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }), who);
  const [real, seen] = await Promise.all([rec(host, 'me'), rec(guest, 'opp')]);
  const alive = seen.filter(s => !s[3]);
  expect(alive.length).toBeGreaterThan(60);
  // smooth: between frames it never moves faster than a plane can (no teleporting, no stutter)
  const speeds = [];
  for (let i = 1; i < alive.length; i++) { const dt = (alive[i][0] - alive[i - 1][0]) / 1000; if (dt > 0) speeds.push(Math.hypot(alive[i][1] - alive[i - 1][1], alive[i][2] - alive[i - 1][2]) / dt); }
  speeds.sort((x, y) => x - y);
  expect(speeds[Math.floor(speeds.length * 0.95)]).toBeLessThan(900);
  // accurate: the guest's view at T matches the host's real position at T-delay (mirrored; delay is 110 ms on a good line;
  // both pages run on this machine, so Date.now is one clock for both)
  const at = t => { let best = real[0]; for (const r of real) if (Math.abs(r[0] - t) < Math.abs(best[0] - t)) best = r; return best; };
  const errs = alive.slice(10).filter(s => s[0] - s[4] > real[0][0]).map(s => { const r = at(s[0] - s[4]); return r[3] ? 0 : Math.hypot(W - r[1] - s[1], r[2] - s[2]); });
  errs.sort((x, y) => x - y);
  expect(errs[Math.floor(errs.length * 0.9)]).toBeLessThan(45);
});

test('a bomb on the friend\'s castle: the owner applies it, both see the same strength', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await park(guest);
  const max = await G(guest, () => window.__sky.G.mine.max);
  // the host hovers above the guest's castle (on the host's right) and drops its bombs
  await park(host, W - 150 - 220 - 20, 600);
  for (let i = 0; i < 4; i++) { await G(host, () => window.__sky.press('bomb')); await host.page.waitForTimeout(300); }
  await expect.poll(() => G(guest, () => window.__sky.G.mine.hp), WAIT).toBeLessThan(max - 20);
  await unpark(host);
  await host.page.waitForTimeout(1500);
  const own = await G(guest, () => window.__sky.G.mine.hp);
  await expect.poll(() => G(host, () => window.__sky.G.foe.hp), WAIT).toBeCloseTo(own, -1);
  // heights are mirrored: the guest's column i is the host's column 10-i
  const [hg, hh] = await Promise.all([G(guest, () => window.__sky.G.mine.heights), G(host, () => window.__sky.G.foe.heights)]);
  expect(hh).toEqual([...hg].reverse());
});

test('a defense hit on my plane is decided by me; the friend sees my machine\'s damage', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await park(guest);
  // in reach of the guest's ballista and archers (default fort)
  await park(host, W - 700, 650, 40);
  await expect.poll(() => net(host).then(n => n.hits), { timeout: 30_000 }).toBeGreaterThan(0);
  const hp = await G(host, () => window.__sky.G.me.hp), max = await G(host, () => window.__sky.G.me.st.hp);
  expect(hp).toBeLessThan(max);
  await unpark(host);
  await expect.poll(() => G(guest, () => window.__sky.G.opp.hp), WAIT).toBeLessThan(max);
  expect((await net(guest)).hits).toBe(0);
});

test('a downed plane falls on both screens and comes back 4 s later', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await park(guest);
  await G(host, () => { clearInterval(window.__park); Object.assign(window.__sky.G.me, { x: 2000, y: 980, p: -0.5 }); });
  await expect.poll(() => G(guest, () => window.__sky.G.opp.dead), WAIT).toBe(true);
  await expect.poll(() => G(guest, () => window.__sky.G.opp.dead), WAIT).toBe(false);
  expect(await G(guest, () => window.__sky.G.opp.x)).toBeGreaterThan(W / 2);    // back above the host's castle, on the right
});

test('a castle falls: the friend wins on both screens, no coins; then both ask for another battle', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  const coins = await G(host, () => window.__sky.prog.coins);
  await fell(guest);
  await expect(title(host)).toHaveText('ניצחת! ⚔', WAIT);
  await expect(title(guest)).toHaveText('הפסדת', WAIT);
  await expect(host.page.locator('#resText')).toContainText('נפלה');
  for (const p of [host, guest]) {
    await expect(p.page.locator('#againBtn')).toBeHidden();
    await expect(p.page.locator('#earn')).toBeHidden();
  }
  expect(await G(host, () => window.__sky.prog.coins)).toBe(coins);
  await host.page.click('#vsRematch');
  await expect(host.page.locator('#vsRematch')).toHaveText('ממתינים לחבר…');
  await expect(guest.page.locator('#vsResMsg')).toHaveText('החבר רוצה עוד קרב!', WAIT);
  await guest.page.click('#vsRematch');
  for (const p of [host, guest]) await expect(p.page.locator('#vsBar')).toBeVisible(WAIT);
  expect(await G(host, () => window.__sky.room().room.meta.round)).toBe(2);
  expect(await G(guest, () => window.__sky.G)).toBe(null);
});

test('both castles fall at once: a draw on both screens', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await Promise.all([fell(host), fell(guest)]);
  for (const p of [host, guest]) await expect(title(p)).toHaveText('תיקו!', WAIT);
});

test('time is up after 2:30: the stronger castle wins by points, the same on both screens', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const { host, guest } = await toBattle(browser, info);
  await Promise.all([park(host), park(guest)]);
  await G(host, () => { const c = window.__sky.G.mine; c.hp = c.max * 0.5; });
  await G(guest, () => { const c = window.__sky.G.mine; c.hp = c.max * 0.8; });
  await expect(host.page.locator('#timeTxt')).toHaveText(/^2:[0-2]\d$/);
  for (const p of [host, guest]) await expect(p.page.locator('#resultScreen')).toBeVisible({ timeout: 170_000 });
  await expect(title(guest)).toHaveText('ניצחת! ⚔');
  await expect(title(host)).toHaveText('הפסדת');
  await expect(host.page.locator('#resText')).toHaveText(/נגמר הזמן: לטירה שלך נשארו 50% .* 80%/);
  await expect(guest.page.locator('#resText')).toHaveText(/נגמר הזמן: לטירה שלך נשארו 80% .* 50%/);
  const t = await G(host, () => window.__sky.G.winTime);
  expect(t).toBeGreaterThanOrEqual(150);
});

test('the friend closes the game in the middle: a 20 s wait, then a technical win; the seat is freed', async ({ browser }, info) => {
  test.setTimeout(150_000);
  const { host, guest } = await toBattle(browser, info);
  await guest.close();
  await expect(host.page.locator('#vsNet')).toContainText('החבר התנתק', WAIT);
  await expect(title(host)).toHaveText('ניצחון טכני ⚔', { timeout: 40_000 });
  await expect(host.page.locator('#resText')).toContainText('יותר מ-20 שניות');
  await expect(host.page.locator('#vsRematch')).toBeDisabled();
  await expect(host.page.locator('#vsResMsg')).toHaveText('החבר יצא מהחדר');
  await host.page.click('#vsExit');
  await expect(host.page.locator('#roomLobby')).toBeVisible(WAIT);
  await expect(host.page.locator('#roomStart')).toBeHidden();
  await expect.poll(() => G(host, () => window.__sky.room().room.meta.guest || null), WAIT).toBe(null);   // the seat is free again
});

test('works with a 200 ms round trip: hits, falls and the result', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info, { lag: 100 });
  await park(guest);
  const max = await G(guest, () => window.__sky.G.mine.max);
  await park(host, W - 150 - 220 - 20, 600);
  for (let i = 0; i < 4; i++) { await G(host, () => window.__sky.press('bomb')); await host.page.waitForTimeout(300); }
  await expect.poll(() => G(host, () => window.__sky.G.foe.hp), WAIT).toBeLessThan(max - 20);
  await fell(host);
  await expect(title(guest)).toHaveText('ניצחת! ⚔', WAIT);
  await expect(title(host)).toHaveText('הפסדת', WAIT);
});

test('bandwidth: one battle stays small', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  // a busy battle: the host flies near the guest's defenses, the guest drops bombs on the host
  await park(host, W - 700, 650);
  await park(guest, W - 150 - 220 - 20, 600);
  const b0 = [host, guest].map(p => ({ ...p.bytes }));
  const SECS = 20;
  for (let i = 0; i < SECS; i++) { await G(guest, () => window.__sky.press('bomb')); await guest.page.waitForTimeout(1000); }
  const per = [host, guest].map((p, i) => ({ in: (p.bytes.in - b0[i].in) / SECS, out: (p.bytes.out - b0[i].out) / SECS }));
  const battleKB = Math.round(per.reduce((a, r) => a + r.in, 0) * 150 / 1024);
  info.annotations.push({ type: 'bandwidth', description: `per second: host in ${Math.round(per[0].in)} B / out ${Math.round(per[0].out)} B, guest in ${Math.round(per[1].in)} B / out ${Math.round(per[1].out)} B; download for a 2:30 battle (both players) ≈ ${battleKB} KB` });
  console.log('[bandwidth]', JSON.stringify(per), 'battle download KB', battleKB);
  expect(per[0].in).toBeGreaterThan(500);                 // it really measured the traffic
  expect(battleKB).toBeLessThan(2048);                    // < 2 MB download per battle, both players together
});

const PHONES = [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]];
for (const [lang, locale] of [['he', 'he-IL'], ['en', 'en-US']]) for (const [phone, viewport] of PHONES) {
  test(`phone ${phone} (${lang}): countdown, battle and result`, async ({ browser }, info) => {
    const shot = (p, label) => p.page.screenshot({ path: `tests/screenshots/${info.project.name}-${lang}-${phone}-vs-${label}.png` });
    const host = await make(browser, info, { locale, viewport, mobile: true }), guest = await make(browser, info, { locale, viewport, mobile: true });
    await joinByCode(guest, await createRoom(host));
    await expect(host.page.locator('#roomStart')).toBeVisible(WAIT);
    await host.page.locator('#roomStart').tap();
    for (const p of [host, guest]) await expect(p.page.locator('#vsReady')).toBeVisible(WAIT);
    await host.page.locator('#vsReady').tap(); await guest.page.locator('#vsReady').tap();
    await expect(host.page.locator('#vsStarting')).toBeVisible(WAIT);
    await host.page.waitForFunction(() => window.__sky.net().active, null, WAIT);
    await shot(host, 'countdown');
    for (const p of [host, guest]) await p.page.waitForFunction(() => window.__sky.net().phase === 'play', null, { timeout: 30_000 });
    expect((await net(host)).counted).toBe(true);
    await host.page.waitForTimeout(1500);
    await expect(host.page.locator('#touch')).toBeVisible();
    await shot(host, 'battle');
    await fell(guest);
    await expect(host.page.locator('#resultScreen')).toBeVisible(WAIT);
    await host.page.waitForTimeout(300);
    await shot(host, 'result');
    for (const id of ['#vsRematch', '#vsExit']) {
      const b = await host.page.locator(id).boundingBox();
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
    }
    if (lang === 'en') expect(/[֐-׿]/.test(await host.page.locator('#resultScreen').innerText())).toBe(false);
  });
}

test('after "another battle", the host leaves during the new build: the guest is told, nothing hangs', async ({ browser }, info) => {
  const { host, guest } = await toBattle(browser, info);
  await fell(guest);
  await expect(host.page.locator('#vsRematch')).toBeVisible(WAIT);
  await host.page.click('#vsRematch'); await guest.page.click('#vsRematch');
  for (const p of [host, guest]) await expect(p.page.locator('#vsBar')).toBeVisible(WAIT);
  await host.page.click('#vsLeave');
  await expect(guest.page.locator('#roomMsg')).toHaveText('המארח עזב את החדר', WAIT);
  await expect(host.page.locator('#roomMenu')).toBeVisible(WAIT);
  // both pages still respond
  for (const p of [host, guest]) expect(await p.page.evaluate(() => 1 + 1)).toBe(2);
});
