// Opens the game and records page errors / console errors.
// Only the Google Fonts stylesheet is external; failures loading it (offline)
// are not game errors and are ignored.
// Most specs test the workshop and battles, so by default the title screen is skipped;
// pass { title: true } to start on it like a real player.
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com/;

export async function openGame(page, { title = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (EXTERNAL.test(m.location().url || '') || EXTERNAL.test(m.text())) return;
    errors.push('console.error: ' + m.text());
  });
  if (!title) await page.addInitScript(() => { window.__skySkipTitle = true; });
  await page.goto('/');
  await page.waitForFunction(() => !!window.__sky);
  return errors;
}

// The font stylesheet loads without blocking the first paint: wait for it before measuring
// layout or taking screenshots (gives up quietly when offline).
export async function fontsLoaded(page) {
  await page.waitForFunction(() => [...document.styleSheets].some(s => s.href && s.href.includes('fonts.googleapis') && s.media.mediaText !== 'print'), null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
}
