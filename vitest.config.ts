import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentOptions: {},
    // Note: environmentMatchGlobs was removed in vitest 4. Per-file environment
    // is now controlled via the `// @vitest-environment jsdom` docblock at the
    // top of individual .test.tsx files that need the DOM.
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'scripts/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/scrapers/**', 'src/lib/scraper.ts'],
      reporter: ['text', 'html'],
    },
    testTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
