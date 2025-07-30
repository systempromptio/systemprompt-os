import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'integration',
    include: [
      'tests/integration/bootstrap/**/*.integration.test.ts',
      'tests/integration/**/*.integration.test.ts', 
      'tests/integration/**/*.spec.ts'
    ],
    testTimeout: 60000,
    hookTimeout: 30000,
    isolate: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
        execArgv: ['--max-old-space-size=8192', '--expose-gc']
      }
    },
    sequence: {
      concurrent: false,
      shuffle: false
    },
    bail: 0,
    environment: 'node',
    setupFiles: ['tests/integration/setup.ts'],
    globals: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'tests/integration/coverage',
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/types/',
        '**/index.ts'
      ]
    },
    reporters: ['default', 'json'],
    outputFile: {
      json: 'test-results/integration-results.json'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  }
});