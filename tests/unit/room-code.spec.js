// Room codes (pure functions).
import { test, expect } from '@playwright/test';
import { ALPHABET, cleanCode, randomCode, validCode } from '../../src/net/code.js';

test('codes are 4 letters without I or O', () => {
  expect(ALPHABET).not.toMatch(/[IO]/);
  for (let i = 0; i < 2000; i++) {
    const c = randomCode();
    expect(c).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(validCode(c)).toBe(true);
  }
});

test('typed codes are cleaned up', () => {
  expect(cleanCode(' ab-cd ')).toBe('ABCD');
  expect(cleanCode('abcdef')).toBe('ABCD');
  expect(cleanCode(null)).toBe('');
});

test('invalid codes are refused', () => {
  for (const c of ['', 'ABC', 'ABCDE', 'ABCI', 'OBCD', 'AB1D', 'abcd']) expect(validCode(c)).toBe(false);
});
