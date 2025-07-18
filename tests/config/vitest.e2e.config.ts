import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/e2e/setup.ts'],
    include: ['tests/e2e/**/*.e2e.test.ts'],
    exclude: ['tests/e2e/utils/**', 'node_modules', 'tests/unit/**', 'tests/integration/**'],
    coverage: {
      enabled: false // E2E tests typically don't need coverage
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Run E2E tests sequentially to avoid conflicts
      }
    },
    testTimeout: 180000, // 3 minutes for Docker operations
    hookTimeout: 60000,  // 1 minute for setup/teardown
    fileParallelism: false,
    maxConcurrency: 1,
    sequence: {
      concurrent: false
    },
    reporters: ['verbose', './tests/helpers/e2e-json-reporter.ts'],
    bail: 1, // Stop on first test failure
    retry: 0, // No retries for e2e tests
    mockReset: true,
    restoreMocks: true,
    clearMocks: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@test-helpers': path.resolve(__dirname, '../helpers'),
      '@test-fixtures': path.resolve(__dirname, '../fixtures'),
      '@test-mocks': path.resolve(__dirname, '../mocks')
    },
  },
  esbuild: {
    target: 'node18'
  }
});