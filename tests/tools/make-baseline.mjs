// Records autopilot results for every mode x difficulty into tests/baseline.json.
// Usage: node tests/tools/make-baseline.mjs <url-or-file-path> [--check]
//   --check  compare against the existing baseline instead of overwriting it.
// Regenerate the baseline only when gameplay/balance changes on purpose.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { runBattle, MATRIX } from '../helpers/autopilot.js';

const arg = process.argv[2];
if (!arg) { console.error('usage: make-baseline.mjs <url|file> [--check]'); process.exit(2); }
const url = /^https?:|^file:/.test(arg) ? arg : pathToFileURL(path.resolve(arg)).href;
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'baseline.json');
const check = process.argv.includes('--check');

const browser = await chromium.launch();
const results = [];
for (const { mode, diff } of MATRIX) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => !!window.__sky);
  const res = await page.evaluate(runBattle, { mode, diff, seed: 1 });
  res.errors = errors;
  results.push(res);
  console.log(JSON.stringify(res));
  await page.close();
}
await browser.close();

if (check) {
  const base = JSON.parse(readFileSync(out, 'utf8'));
  const same = JSON.stringify(base) === JSON.stringify(results);
  console.log(same ? 'MATCH: identical to baseline' : 'DIFF: results differ from baseline');
  process.exit(same ? 0 : 1);
} else {
  writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
  console.log('wrote', out);
}
