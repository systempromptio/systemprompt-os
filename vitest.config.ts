import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/test-env.ts'],
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'build', 'tests/manual/**'],
    testTimeout: 10000,
    pool: 'forks',
    reporters: ['default'],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules',
        'tests/**',
        'src/**/*.d.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts'
      ]
    }
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