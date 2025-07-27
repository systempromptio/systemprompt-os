import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/test-env.ts'],
    globalSetup: ['./tests/e2e/global-setup.ts'],
    globalTeardown: ['./tests/e2e/global-teardown.ts'],
    include: ['tests/e2e/**/*.spec.ts', 'tests/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'build', 'tests/manual/**'],
    testTimeout: 180000, // 3 minutes for Docker operations
    pool: 'forks',
    reporters: ['verbose'],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './src/server'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@tools': path.resolve(__dirname, './src/tools'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@test-helpers': path.resolve(__dirname, './tests/helpers'),
      '@test-fixtures': path.resolve(__dirname, './tests/fixtures'),
      '@test-mocks': path.resolve(__dirname, './tests/mocks')
    },
  },
  esbuild: {
    target: 'node18'
  }
});