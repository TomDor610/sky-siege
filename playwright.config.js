import { defineConfig } from '@playwright/test';

// npm test:
//   dev / dist - every browser spec runs twice: against the Vite dev server (src/ modules)
//                and against the built single file (dist/index.html via `vite preview`).
//   unit       - pure logic in Node (tests/unit).
// npm run test:rules (inside `firebase emulators:exec`, which sets FIRESTORE_EMULATOR_HOST):
//   rules      - Firestore Security Rules against the emulator (tests/rules). Needs Java.
const rulesRun = !!process.env.FIRESTORE_EMULATOR_HOST;
const NODE_ONLY = /[\\/](unit|rules)[\\/]/;

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list']],
  // Hebrew by default (the language is picked from the browser for new players);
  // English tests opt in with test.use({ locale: 'en-US' }).
  use: { viewport: { width: 1280, height: 720 }, locale: 'he-IL' },
  projects: rulesRun
    ? [{ name: 'rules', testMatch: /rules[\\/].*\.spec\.js/ }]
    : [
        { name: 'dev', testIgnore: NODE_ONLY, use: { baseURL: 'http://localhost:5173/' } },
        { name: 'dist', testIgnore: NODE_ONLY, use: { baseURL: 'http://localhost:4173/' } },
        { name: 'unit', testMatch: /unit[\\/].*\.spec\.js/ },
      ],
  webServer: rulesRun ? [] : [
    { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173/', reuseExistingServer: true },
    { command: 'npx vite build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: false, timeout: 120_000 },
  ],
});
