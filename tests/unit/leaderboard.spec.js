// Leaderboard rows (pure functions, runs in Node).
import { test, expect } from '@playwright/test';
import { buildRow, campaignScore, codeOf, hiddenRow, nickProblem, sortRows, visible } from '../../src/leaderboard/rows.js';
import { freshProg } from '../../src/progress.js';

const prog = over => Object.assign(freshProg(), over);

test('a row is built from progress: level beaten, fastest time, duel wins, rank, code', () => {
  const r = buildRow(prog({ nick: '  Tom   Dor ', xp: 400, wins: { easy: 4, medium: 1, hard: 0 }, best: { easy: 21.37, medium: 48.04 }, duelWins: { easy: 3, medium: 2, hard: 1 }, friends: ['x', 'uid123456789', 'y'] }), 'uid123456789');
  expect(r.name).toBe('Tom Dor');
  expect(r.code).toBe('UID12345');
  expect(r.rank).toBe(4);                            // xp 400 -> rank 4
  expect(r.lvl).toEqual({ easy: 4, medium: 1, hard: 0 });
  expect(r.best).toEqual({ easy: 21.4, medium: 48, hard: 0 });
  expect(r.duelWins).toBe(6);
  expect(r.score).toEqual({ easy: campaignScore(4, 21.4), medium: campaignScore(1, 48), hard: 0, duel: 6 });
  expect(r.friends).toEqual(['x', 'y']);              // never lists yourself
});

test('campaign order: more levels first, then the faster time', () => {
  expect(campaignScore(5, 90)).toBeGreaterThan(campaignScore(4, 10));
  expect(campaignScore(4, 10)).toBeGreaterThan(campaignScore(4, 11));
  expect(campaignScore(1, 9999)).toBeGreaterThan(campaignScore(0, 0));
  expect(campaignScore(0, 0)).toBe(0);
});

test('values stay inside the ranges the security rules accept', () => {
  const r = buildRow(prog({ nick: 'Max', xp: 10 ** 9, wins: { easy: 9999, medium: 2, hard: 0 }, best: { easy: 0.5, medium: 0 }, duelWins: { easy: 10 ** 7 } }), 'abc');
  expect(r.rank).toBe(20);
  expect(r.lvl.easy).toBe(500);
  expect(r.best.easy).toBe(3);        // below 3 s is clamped up
  expect(r.best.medium).toBe(10000);  // a win without a recorded time (old saves) counts as the slowest
  expect(r.duelWins).toBe(100000);
});

test('nickname rules', () => {
  expect(nickProblem('T')).toBe('short');
  expect(nickProblem('x'.repeat(17))).toBe('long');
  expect(nickProblem('Tom<script>')).toBe('chars');
  expect(nickProblem('Shit Lord')).toBe('word');
  expect(nickProblem('טום הממציא')).toBe(null);
  expect(nickProblem('  Ace_Pilot-7 ')).toBe(null);
});

test('hidden rows (left the board) sink and are never listed', () => {
  const h = hiddenRow('abcdefghij', ['f1']);
  expect(visible(h)).toBe(false);
  expect(h.code).toBe(codeOf('abcdefghij'));
  const a = { uid: 'a', ...buildRow(prog({ nick: 'Ann', wins: { easy: 2, medium: 0, hard: 0 }, best: { easy: 30 } }), 'a') };
  const b = { uid: 'b', ...buildRow(prog({ nick: 'Bob', wins: { easy: 2, medium: 0, hard: 0 }, best: { easy: 25 }, duelWins: { easy: 9 } }), 'b') };
  expect(sortRows([a, { uid: 'h', ...h }, b], 'easy').map(r => r.name)).toEqual(['Bob', 'Ann']);
  expect(sortRows([a, b], 'duel').map(r => r.name)).toEqual(['Bob', 'Ann']);
});
