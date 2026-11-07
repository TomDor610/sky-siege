// Cloud-save merge rules (pure functions, runs in Node).
import { test, expect } from '@playwright/test';
import { mergeProg, mergeSave, normalizeProg, sameSave } from '../../src/sync/merge.js';

const prog = (over = {}) => ({
  coins: 120, coinsEarned: 120, coinsSpent: 0, epoch: 0, xp: 0, nick: '', friends: [],
  upg: { frame: 0, wings: 0, props: 0, armor: 0, weapons: 0, workshop: 0, stone: 0, ballista: 0, archers: 0, mangonel: 0 },
  styles: { classic: true }, unl: { crossbow: false, greek: false, slot5: false },
  wins: { easy: 0, medium: 0, hard: 0 }, duelWins: { easy: 0, medium: 0, hard: 0 }, best: {},
  ...over,
});
const B = { style: 'classic', wings: 2, props: 2, armor: 1, bombs: 4, crossbows: 0, bombType: 'stone' };
const F = { slots: ['ballista', null, 'archers', null, null], walls: 0 };

test('first upload: no cloud copy -> the local save goes up unchanged', () => {
  const local = { prog: prog({ coins: 640, coinsEarned: 900, coinsSpent: 260, xp: 333 }), build: B, fort: F, buildAt: 5 };
  expect(mergeSave(local, null)).toEqual(local);
});

test('a purchase on one device is not refunded by the other device', () => {
  const cloud = prog({ coins: 500, coinsEarned: 500 });
  const phone = prog({ coins: 200, coinsEarned: 500, coinsSpent: 300, upg: { ...prog().upg, frame: 2 } }); // bought an upgrade
  const m = mergeProg(phone, cloud);
  expect(m.coins).toBe(200);
  expect(m.upg.frame).toBe(2);
  expect(mergeProg(cloud, phone)).toEqual(m);
});

test('every counter takes the higher value; unlocks are kept from both sides', () => {
  const a = prog({ coinsEarned: 900, coinsSpent: 100, coins: 800, xp: 400, upg: { ...prog().upg, frame: 3, wings: 1 }, wins: { easy: 5, medium: 0, hard: 0 }, styles: { classic: true, falcon: true }, unl: { crossbow: true, greek: false, slot5: false } });
  const b = prog({ coinsEarned: 700, coinsSpent: 250, coins: 450, xp: 650, upg: { ...prog().upg, frame: 1, wings: 4 }, wins: { easy: 2, medium: 3, hard: 0 }, duelWins: { easy: 0, medium: 0, hard: 1 }, styles: { classic: true, bat: true }, unl: { crossbow: false, greek: true, slot5: false } });
  const m = mergeProg(a, b);
  expect([m.coinsEarned, m.coinsSpent, m.coins, m.xp]).toEqual([900, 250, 650, 650]);
  expect([m.upg.frame, m.upg.wings]).toEqual([3, 4]);
  expect(m.wins).toEqual({ easy: 5, medium: 3, hard: 0 });
  expect(m.duelWins.hard).toBe(1);
  expect(m.styles).toEqual({ classic: true, falcon: true, bat: true });
  expect(m.unl).toEqual({ crossbow: true, greek: true, slot5: false });
});

test('campaign records keep the FASTER time', () => {
  const m = mergeProg(prog({ best: { easy: 30.2, medium: 50 } }), prog({ best: { easy: 21.7, hard: 44.1 } }));
  expect(m.best).toEqual({ easy: 21.7, medium: 50, hard: 44.1 });
});

test('"reset progress" (higher epoch) wins over an older save, and an old save cannot undo it', () => {
  const old = prog({ coins: 5000, coinsEarned: 5000, xp: 9000, upg: { ...prog().upg, frame: 5 } });
  const reset = prog({ epoch: 1 });
  expect(mergeProg(reset, old)).toEqual(normalizeProg(reset));
  expect(mergeProg(old, reset)).toEqual(normalizeProg(reset));
  const afterReset = prog({ epoch: 1, coins: 300, coinsEarned: 300, xp: 50 });
  expect(mergeProg(afterReset, reset).coins).toBe(300);
});

test('saves from before the counters existed keep their coins', () => {
  const legacy = { coins: 777, upg: { frame: 2 }, xp: 120, styles: { classic: true }, unl: {}, wins: {}, duelWins: {}, best: {} };
  const n = normalizeProg(legacy);
  expect([n.coins, n.coinsEarned, n.coinsSpent, n.epoch]).toEqual([777, 777, 0, 0]);
  expect(mergeProg(legacy, prog()).coins).toBe(777);
});

test('nickname is never lost and friends from both devices are kept', () => {
  const m = mergeProg(prog({ nick: '', friends: ['a', 'b'] }), prog({ nick: 'Tom', friends: ['b', 'c'] }));
  expect(m.nick).toBe('Tom');
  expect(m.friends.sort()).toEqual(['a', 'b', 'c']);
  expect(mergeProg(prog({ nick: 'Dana' }), prog({ nick: 'Tom' })).nick).toBe('Dana'); // this device wins
  expect(normalizeProg({ coins: 5 }).friends).toEqual([]);
});

test('the most recently edited build and defenses win', () => {
  const older = { prog: prog(), build: { ...B, wings: 4 }, fort: { slots: [null, null, null, null, null], walls: 3 }, buildAt: 100 };
  const newer = { prog: prog(), build: { ...B, style: 'falcon' }, fort: F, buildAt: 200 };
  const m = mergeSave(older, newer);
  expect([m.build.style, m.fort.walls, m.buildAt]).toEqual(['falcon', 0, 200]);
  expect(mergeSave(newer, older).build.style).toBe('falcon');
});

test('property check: merging never lowers any progress value, and is order-independent', () => {
  let s = 7; const r = n => { s = (s * 16807) % 2147483647; return s % n; };
  const rnd = () => {
    const spent = r(3000), earned = spent + r(5000);
    const p = prog({ coinsEarned: earned, coinsSpent: spent, coins: earned - spent, xp: r(20000), epoch: r(2) });
    for (const k of Object.keys(p.upg)) p.upg[k] = r(6);
    for (const k of ['easy', 'medium', 'hard']) { p.wins[k] = r(20); p.duelWins[k] = r(20); if (r(2)) p.best[k] = 10 + r(80); }
    for (const k of ['falcon', 'galleon', 'bat', 'airship']) if (r(2)) p.styles[k] = true;
    for (const k of ['crossbow', 'greek', 'slot5']) p.unl[k] = !!r(2);
    return p;
  };
  for (let i = 0; i < 500; i++) {
    const a = rnd(), b = rnd(), m = mergeProg(a, b);
    expect(sameSave(m, mergeProg(b, a))).toBe(true);
    expect(sameSave(mergeProg(m, m), m)).toBe(true);
    for (const side of a.epoch === b.epoch ? [a, b] : [a.epoch > b.epoch ? a : b]) {
      expect(m.coinsEarned).toBeGreaterThanOrEqual(side.coinsEarned);
      expect(m.coinsSpent).toBeGreaterThanOrEqual(side.coinsSpent);
      expect(m.xp).toBeGreaterThanOrEqual(side.xp);
      expect(m.coins).toBe(m.coinsEarned - m.coinsSpent);
      for (const k of Object.keys(side.upg)) expect(m.upg[k]).toBeGreaterThanOrEqual(side.upg[k]);
      for (const k of ['easy', 'medium', 'hard']) expect(m.wins[k]).toBeGreaterThanOrEqual(side.wins[k]);
      for (const k of Object.keys(side.styles)) if (side.styles[k]) expect(m.styles[k]).toBe(true);
      for (const k of Object.keys(side.best)) expect(m.best[k]).toBeLessThanOrEqual(side.best[k]);
    }
  }
});
