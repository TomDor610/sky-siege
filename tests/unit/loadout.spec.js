// 1v1 loadouts: encoding and the same limits the database rules enforce.
import { test, expect } from '@playwright/test';
import { decodeLoadout, encodeLoadout, loadoutCost, validLoadout } from '../../src/net/loadout.js';
import { defaultBuild, defaultFort, fortCost, spent } from '../../src/progress.js';
import { VS_POOL } from '../../src/data.js';

test('encode/decode round trip; empty slots travel as "-" (the database drops nulls)', () => {
  const b = defaultBuild(), f = { slots: ['ballista', null, null, 'mangonel', null], walls: 2 };
  const l = encodeLoadout(b, f);
  expect(l.fort.s).toEqual(['ballista', '-', '-', 'mangonel', '-']);
  expect(decodeLoadout(l)).toEqual({ build: b, fort: f });
});

test('cost is the same as the workshop\'s, and the budget is 180', () => {
  expect(VS_POOL).toBe(180);
  for (const [b, f] of [[defaultBuild(), defaultFort()], [{ ...defaultBuild(), bombType: 'greek', bombs: 6, crossbows: 2 }, { slots: ['mangonel', 'archers', null, null, 'ballista'], walls: 1 }]])
    expect(loadoutCost(encodeLoadout(b, f))).toBe(spent(b) + fortCost(f));
});

test('validation mirrors the rules', () => {
  const ok = encodeLoadout(defaultBuild(), defaultFort());
  expect(validLoadout(ok)).toBe(true);
  expect(validLoadout({ ...ok, fort: { ...ok.fort, walls: 3 } })).toBe(false);                 // 190
  expect(validLoadout({ ...ok, build: { ...ok.build, wings: 5 } })).toBe(false);
  expect(validLoadout({ ...ok, build: { ...ok.build, style: 'dragon' } })).toBe(false);
  expect(validLoadout({ ...ok, fort: { s: ['cannon', '-', '-', '-', '-'], walls: 0 } })).toBe(false);
  expect(validLoadout({ ...ok, fort: { s: ['-', '-', '-', '-'], walls: 0 } })).toBe(false);
});
