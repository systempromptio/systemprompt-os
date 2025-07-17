import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/e2e/**/*.test.ts',
      'modules/**/tests/e2e/**/*.test.ts'
    ],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 180000,
    hookTimeout: 180000,
    teardownTimeout: 10000,
  },
});