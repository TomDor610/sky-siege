import { defineConfig } from '@playwright/test';

// npm test:
//   dev / dist - every browser spec runs twice: against the Vite dev server (src/ modules)
//                and against the built single file (dist/index.html via `vite preview`).
//   unit       - pure logic in Node (tests/unit).
// npm run test:net (inside `firebase emulators:exec`, which sets FIRESTORE_EMULATOR_HOST). Needs Java.
//   rules      - Firestore and Realtime Database Security Rules (tests/rules).
//   net-dev / net-dist - two browsers in the same room (tests/net).
const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;
const NODE_ONLY = /[\\/](unit|rules|net)[\\/]/;
const NET = /[\\/]net[\\/].*\.spec\.js/;

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: true,
  // the 1v1 tests run two real-time browsers each (real clocks, real network timing):
  // too many at once on one machine starves them, so the emulated run is capped
  ...(emulated ? { workers: 2 } : {}),
  reporter: [['list']],
  // Hebrew by default (the language is picked from the browser for new players);
  // English tests opt in with test.use({ locale: 'en-US' }).
  use: { viewport: { width: 1280, height: 720 }, locale: 'he-IL' },
  projects: emulated
    ? [
        { name: 'rules', testMatch: /rules[\\/].*\.spec\.js/ },
        { name: 'net-dev', testMatch: NET, use: { baseURL: 'http://localhost:5173/' } },
        { name: 'net-dist', testMatch: NET, use: { baseURL: 'http://localhost:4173/' } },
      ]
    : [
        { name: 'dev', testIgnore: NODE_ONLY, use: { baseURL: 'http://localhost:5173/' } },
        { name: 'dist', testIgnore: NODE_ONLY, use: { baseURL: 'http://localhost:4173/' } },
        { name: 'unit', testMatch: /unit[\\/].*\.spec\.js/ },
      ],
  webServer: [
    { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173/', reuseExistingServer: true },
    { command: 'npx vite build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: false, timeout: 120_000 },
  ],
});
