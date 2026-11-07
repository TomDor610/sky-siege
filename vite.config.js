import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> dist/index.html: one self-contained file (JS + CSS inlined),
// so it can still be published as a claude.ai artifact.
export default defineConfig({
  base: './', // works at any path, e.g. <user>.github.io/sky-siege/
  plugins: [viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000 },
});
