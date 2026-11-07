import { defineConfig } from '@playwright/test';

// Every spec runs twice: against the Vite dev server (src/ modules) and against
// the built single file (dist/index.html served by `vite preview`).
export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list']],
  // Hebrew by default (the language is picked from the browser for new players);
  // English tests opt in with test.use({ locale: 'en-US' }).
  use: { viewport: { width: 1280, height: 720 }, locale: 'he-IL' },
  projects: [
    { name: 'dev', use: { baseURL: 'http://localhost:5173/' } },
    { name: 'dist', use: { baseURL: 'http://localhost:4173/' } },
  ],
  webServer: [
    { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173/', reuseExistingServer: true },
    { command: 'npx vite build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: false, timeout: 120_000 },
  ],
});
