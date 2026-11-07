import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import he from '../src/i18n/he.js';
import en from '../src/i18n/en.js';
import * as D from '../src/data.js';
import { runBattle } from './helpers/autopilot.js';
import { openGame } from './helpers/page.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const baseline = JSON.parse(readFileSync(path.join(ROOT, 'tests/baseline.json'), 'utf8'));
const HEBREW = /[֐-׿]/;

// ---------------------------------------------------------------- static checks
const placeholders = v => new Set((typeof v === 'object' ? Object.values(v).join(' ') : v).match(/\{\w+\}/g) || []);
const walk = d => readdirSync(d).flatMap(f => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test.describe('translation files', () => {
  test('he and en have exactly the same keys', () => {
    const hk = Object.keys(he).sort(), ek = Object.keys(en).sort();
    expect(ek.filter(k => !he[k]), 'in en.js but missing in he.js').toEqual([]);
    expect(hk.filter(k => !en[k]), 'in he.js but missing in en.js').toEqual([]);
  });

  test('same placeholders in both languages, plurals have an "other" form', () => {
    const bad = [];
    for (const k of Object.keys(he)) {
      const a = [...placeholders(he[k])].sort().join(), b = [...placeholders(en[k] ?? '')].sort().join();
      if (a !== b) bad.push(`${k}: he {${a}} vs en {${b}}`);
      for (const [lang, v] of [['he', he[k]], ['en', en[k]]]) {
        if (typeof v === 'object' && typeof v.other !== 'string') bad.push(`${k} (${lang}): plural without "other"`);
        if (typeof v === 'object' && !placeholders(v).has('{n}') && Object.keys(v).length === 1) bad.push(`${k} (${lang}): plural never uses {n}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('English texts contain no Hebrew (the Italian notes are not translatable texts)', () => {
    const bad = Object.entries(en).filter(([k, v]) => k !== 'lang.other' && HEBREW.test(typeof v === 'object' ? Object.values(v).join() : v));
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  test('every key the code uses exists, and every key is used', () => {
    const src = walk(path.join(ROOT, 'src')).filter(f => f.endsWith('.js') && !f.includes(`${path.sep}i18n${path.sep}`));
    const code = src.map(f => readFileSync(f, 'utf8')).join('\n');
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const used = new Set(), prefixes = new Set();
    // literal keys: t('a.b') / tr('a.b'); prefixes: t('a.b.'+x) and t(`a.${x}.b`)
    for (const m of code.matchAll(/\bt(?:r)?\('([\w.]+)'\s*[,)]/g)) used.add(m[1]);
    for (const m of code.matchAll(/'([a-z]\w*(?:\.\w+)*\.)'\s*\+/g)) prefixes.add(m[1]);
    for (const m of code.matchAll(/`([a-z]\w*\.)\$\{/g)) prefixes.add(m[1]);
    for (const m of code.matchAll(/'(reason\.\w+)'/g)) used.add(m[1]); // reasons are stored as keys and translated on the result screen
    for (const k of Object.keys(he)) if (code.includes(`'${k}'`)) used.add(k); // any literal mention, e.g. t(on ? 'a' : 'b')
    for (const m of html.matchAll(/data-i18n(?:-title)?="([\w.]+)"/g)) used.add(m[1]);
    // keys built from game data
    const data = { style: [D.STYLES, ['name', 'tag', 'desc']], part: [D.PARTS, ['name', 'desc']], bomb: [D.BOMBTYPE, ['name', 'plural']],
      upg: [{ ...D.UPG, ...D.UPG_CASTLE }, ['name', 'eff']], unlock: [D.UNLOCKS, ['name', 'desc']], def: [D.DEF, ['name', 'short', 'count']],
      diff: [D.DIFF, ['name', 'inline', 'desc']], bot: [D.BOT, ['desc']] };
    for (const [p, [obj, fields]] of Object.entries(data)) for (const k of Object.keys(obj)) for (const f of fields) used.add(`${p}.${k}.${f}`);
    for (const [, id] of D.RANKS) used.add(`rank.${id}`);
    for (let i = 0; i < 5; i++) used.add(`slot.${i}`);
    used.add('title'); // document.title, set in src/i18n/index.js

    const missing = [...used].filter(k => !(k in he));
    expect(missing, 'used in code but missing from the translation files').toEqual([]);
    const unused = Object.keys(he).filter(k => !used.has(k) && ![...prefixes].some(p => k.startsWith(p)));
    expect(unused, 'keys nobody uses').toEqual([]);
  });
});

// ---------------------------------------------------------------- in the browser
async function visibleHebrew(page) {
  return page.evaluate(re => {
    const R = new RegExp(re);
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const el = n.parentElement;
      if (!el || el.closest('script') || el.id === 'langBtn') continue;
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      if (R.test(n.textContent)) out.push(`${el.id || el.tagName}: ${n.textContent.trim()}`);
    }
    for (const el of document.querySelectorAll('[title]')) if (R.test(el.title)) out.push(`title of ${el.id || el.tagName}: ${el.title}`);
    if (R.test(document.title)) out.push('document.title');
    return out;
  }, HEBREW.source);
}

test.describe('English', () => {
  test.use({ locale: 'en-US' });

  for (const [mode, diff] of [['duel', 'easy'], ['duel', 'medium'], ['campaign', 'easy'], ['campaign', 'hard']]) {
    test(`battle in English: ${mode} / ${diff} — same result, no Hebrew anywhere`, async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const errors = await openGame(page);
      expect(await page.evaluate(() => [window.__sky.lang(), document.documentElement.lang, document.documentElement.dir])).toEqual(['en', 'en', 'ltr']);
      await page.click(`#modeSeg button[data-m="${mode}"]`);
      await page.click(`#diffSeg button[data-d="${diff}"]`);
      expect(await visibleHebrew(page), 'workshop').toEqual([]);
      await page.click('.tabs button[data-tab="shop"]');
      expect(await visibleHebrew(page), 'shop').toEqual([]);
      await page.click('.tabs button[data-tab="machine"]');

      // mid-battle HUD, start tip and tutorial bubble
      await page.evaluate(() => { window.__sky.start(); window.__sky.step(60); });
      expect(await visibleHebrew(page), 'battle HUD').toEqual([]);

      const res = await page.evaluate(runBattle, { mode, diff, seed: 1, collect: true });
      const { texts, ...result } = res;
      expect({ ...result, errors }).toEqual(baseline.find(b => b.mode === mode && b.diff === diff)); // language never changes the game
      expect(texts.length).toBeGreaterThan(0);
      expect(texts.filter(s => HEBREW.test(s)), 'floating texts / castle labels').toEqual([]);
      expect(await visibleHebrew(page), 'result screen').toEqual([]);

      await page.click('#copyBtn');
      const share = await page.evaluate(() => navigator.clipboard.readText());
      expect(share).toContain('Sky Siege');
      expect(HEBREW.test(share), `share text: ${share}`).toBe(false);
    });
  }

  test('quit and pause screens are in English too', async ({ page }) => {
    const errors = await openGame(page);
    await page.click('#launchBtn');
    await page.click('#pauseBtn');
    expect(await visibleHebrew(page)).toEqual([]);
    await page.click('#quitBtn');
    await expect(page.locator('#resultScreen')).toBeVisible();
    await expect(page.locator('#resTitle')).toHaveText('You left the battle');
    expect(await visibleHebrew(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('HUD follows reading order, the world does not mirror', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => { document.querySelector('#modeSeg button[data-m="duel"]').click(); window.__sky.start(); });
    const own = await page.locator('#ownBox').boundingBox(), foe = await page.locator('#castleTxt').boundingBox();
    expect(own.x).toBeLessThan(foe.x); // your castle's bar on the left, the enemy's on the right
    const world = await page.evaluate(() => { const G = window.__sky.G; return { me: G.me.x, mine: G.mine.x0, foe: G.foe.x0 }; });
    expect(world.mine).toBeLessThan(world.foe); // player's castle still on the left
    expect(world.me).toBeLessThan(world.foe);
    expect(errors).toEqual([]);
  });
});

test.describe('choosing the language', () => {
  test('Hebrew browser starts in Hebrew; the button switches and is remembered', async ({ page }) => {
    const errors = await openGame(page); // he-IL (config default)
    expect(await page.evaluate(() => [window.__sky.lang(), document.documentElement.dir])).toEqual(['he', 'rtl']);
    await expect(page.locator('#langBtn')).toHaveText('English');
    await page.click('#langBtn');
    expect(await page.evaluate(() => [window.__sky.lang(), document.documentElement.lang, document.documentElement.dir, document.title]))
      .toEqual(['en', 'en', 'ltr', "Sky Siege – The Inventors' Duel"]);
    await expect(page.locator('#langBtn')).toHaveText('עברית');
    await expect(page.locator('#launchBtn')).toHaveText('To battle! ⚔');
    expect(await visibleHebrew(page)).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('skysiege_lang'))).toBe('en');
    await page.reload();
    await page.waitForFunction(() => !!window.__sky);
    expect(await page.evaluate(() => window.__sky.lang())).toBe('en');
    await page.click('#langBtn');
    await expect(page.locator('#launchBtn')).toHaveText('לקרב! ⚔');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    expect(errors).toEqual([]);
  });

  test.describe('English browser', () => {
    test.use({ locale: 'en-US' });
    test('a new player gets English', async ({ page }) => {
      await openGame(page);
      expect(await page.evaluate(() => window.__sky.lang())).toBe('en');
    });
    test('a returning player who has been playing in Hebrew stays in Hebrew', async ({ page }) => {
      await page.addInitScript(() => {
        if (!localStorage.getItem('skysiege_prog')) localStorage.setItem('skysiege_prog', JSON.stringify({ coins: 300, upg: {}, xp: 40 }));
      });
      await openGame(page);
      expect(await page.evaluate(() => window.__sky.lang())).toBe('he');
    });
  });
});
