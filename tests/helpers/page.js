// Opens the game and records page errors / console errors.
// Only the Google Fonts stylesheet is external; failures loading it (offline)
// are not game errors and are ignored.
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com/;

export async function openGame(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (EXTERNAL.test(m.location().url || '') || EXTERNAL.test(m.text())) return;
    errors.push('console.error: ' + m.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window.__sky);
  return errors;
}
