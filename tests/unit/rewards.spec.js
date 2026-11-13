// 1v1 rewards and records (stage 5): the formula, the limits, the record, merging two devices.
import { test, expect } from '@playwright/test';
import { addToRecord, battleLines, dayKey, DAILY_CAP, mergeDay, mergeRecords, vsReward, VS_MULT } from '../../src/net/rewards.js';
import { mergeProg } from '../../src/sync/merge.js';

const WIN = { result: 'won', secs: 90, myBombs: 6, oppBombs: 4, dmgPct: 100, keptPct: 60, defs: 2, downs: 1 };
const LOSS = { result: 'lost', secs: 90, myBombs: 3, oppBombs: 6, dmgPct: 40, keptPct: 0, defs: 1, downs: 0 };
const TODAY = '2026-11-13';

test('the formula is the duel\'s, ×1.5: a win and a loss', () => {
  const w = battleLines(WIN);
  expect(w.lines.map(l => l.key)).toEqual(['res.dmgFoe', 'res.defs', 'vs.res.downs', 'res.victory', 'res.kept']);
  expect(w.lines.map(l => l.coins)).toEqual([80, 30, 25, 100, 24]);
  expect(w.coins).toBe(Math.round(259 * VS_MULT));
  expect(w.xp).toBe(Math.round(20 + 50 + 40 + 10 + 8));
  const l = battleLines(LOSS);
  expect(l.lines.map(x => x.key)).toEqual(['res.dmgFoe', 'res.defs']);              // no victory, no kept
  expect(l.coins).toBe(Math.round((32 + 15) * VS_MULT));
  expect(battleLines({ ...LOSS, result: 'draw' }).lines.map(x => x.key)).toContain('vs.res.drawBonus');
  expect(battleLines({ ...WIN, result: 'techWon' }).coins).toBe(w.coins);           // a technical win is a win
});

test('no reward for a short battle or one without bombs on both sides', () => {
  expect(vsReward({ ...WIN, secs: 44 }, null, 'f', TODAY)).toMatchObject({ coins: 0, xp: 0, reason: 'short' });
  expect(vsReward({ ...WIN, oppBombs: 0 }, null, 'f', TODAY)).toMatchObject({ coins: 0, xp: 0, reason: 'noBombs' });
  expect(vsReward({ ...WIN, myBombs: 0 }, null, 'f', TODAY)).toMatchObject({ coins: 0, reason: 'noBombs' });
  expect(vsReward({ ...WIN, result: 'left' }, null, 'f', TODAY)).toMatchObject({ coins: 0, reason: 'none' });
  // such battles do not use up the friend's 3 full games
  expect(vsReward({ ...WIN, secs: 10 }, null, 'f', TODAY).day.f).toEqual({});
});

test('the same friend on the same day: 3 full, 3 half, then nothing; a new day starts over', () => {
  let day, got = [];
  for (let i = 0; i < 8; i++) { const r = vsReward(LOSS, day, 'dani', TODAY); got.push(r.factor); day = r.day; }
  expect(got).toEqual([1, 1, 1, 0.5, 0.5, 0.5, 0, 0]);
  expect(vsReward(LOSS, day, 'dani', TODAY).reason).toBe('limit');
  expect(vsReward(LOSS, day, 'gil', TODAY).factor).toBe(1);                        // another friend: full
  expect(vsReward(LOSS, day, 'dani', '2026-11-14')).toMatchObject({ factor: 1, game: 1 });
});

test('at most 1500 coins a day from all friends; XP still comes', () => {
  let day, total = 0;
  for (const f of ['a', 'b', 'c', 'd', 'e', 'g']) { const r = vsReward(WIN, day, f, TODAY); total += r.coins; day = r.day; }
  expect(total).toBe(DAILY_CAP);
  const after = vsReward(WIN, day, 'h', TODAY);
  expect(after).toMatchObject({ coins: 0, reason: 'cap', capLeft: 0 });
  expect(after.xp).toBeGreaterThan(0);
});

test('the record: wins, losses, draws, streaks, name', () => {
  let r;
  for (const x of ['won', 'techWon', 'won', 'lost', 'draw', 'lost', 'techLost']) r = addToRecord(r, x, 'Dani', 5);
  expect(r).toEqual({ n: 'Dani', w: 3, l: 3, d: 1, s: -2, b: 3, t: 5 });
  expect(addToRecord(r, 'left', '', 6)).toMatchObject({ w: 3, l: 3, d: 1, n: 'Dani' });   // no result: nothing counted
  expect(addToRecord(null, 'won', 'x'.repeat(40), 1).n).toHaveLength(16);
});

test('two devices: counters take the max, the name and streak come from the last game', () => {
  const a = { dani: { n: 'Dani', w: 3, l: 1, d: 0, s: 2, b: 3, t: 100 } }, b = { dani: { n: 'Danny', w: 2, l: 2, d: 1, s: -1, b: 1, t: 200 }, gil: { n: 'Gil', w: 1, l: 0, d: 0, s: 1, b: 1, t: 50 } };
  expect(mergeRecords(a, b)).toEqual({ dani: { n: 'Danny', w: 3, l: 2, d: 1, s: -1, b: 3, t: 200 }, gil: b.gil });
  expect(mergeRecords(b, a)).toEqual(mergeRecords(a, b));
  expect(mergeDay({ d: TODAY, c: 300, f: { a: 2 } }, { d: TODAY, c: 500, f: { a: 1, b: 3 } })).toEqual({ d: TODAY, c: 500, f: { a: 2, b: 3 } });
  expect(mergeDay({ d: '2026-11-12', c: 900, f: {} }, { d: TODAY, c: 100, f: {} })).toEqual({ d: TODAY, c: 100, f: {} });
});

test('saves without 1v1 data stay without it (the cloud\'s older rules would refuse new fields)', () => {
  const base = { coins: 10, coinsEarned: 10, coinsSpent: 0, epoch: 0, xp: 0, upg: {}, styles: {}, unl: {}, wins: {}, duelWins: {}, best: {} };
  const m = mergeProg(base, base);
  expect('vs' in m).toBe(false);
  expect('vsDay' in m).toBe(false);
  const withVs = mergeProg({ ...base, vs: { dani: { n: 'D', w: 1, l: 0, d: 0, s: 1, b: 1, t: 1 } }, vsDay: { d: TODAY, c: 10, f: {} } }, base);
  expect(withVs.vs.dani.w).toBe(1);
  expect(withVs.vsDay.c).toBe(10);
});

test('the day key is the player\'s local date', () => {
  expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
});
