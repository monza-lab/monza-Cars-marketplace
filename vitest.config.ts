import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
      ['tests/**/*.test.tsx', 'jsdom'],
    ],
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
