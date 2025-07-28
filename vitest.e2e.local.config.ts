import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'local-e2e',
    include: ['tests/e2e/local/**/*.local.e2e.test.{js,ts}'],
    exclude: ['tests/e2e/docker/**/*', 'tests/e2e/local/shared/**/*', 'node_modules/**/*'],
    testTimeout: 120000, // 2 minutes for local CLI tests (increased for database operations)
    hookTimeout: 60000, // 1 minute for setup/teardown
    teardownTimeout: 60000,
    globalSetup: ['tests/e2e/local/shared/global-setup.ts'],
    globalTeardown: ['tests/e2e/local/shared/global-teardown.ts'],
    
    // Sequential execution configuration for database isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Force sequential execution
        isolate: true, // Isolate each test file
        execArgv: ['--max-old-space-size=4096'] // Increase memory for CLI processes
      }
    },
    
    // Prevent parallel execution at all levels
    fileParallelism: false,
    maxConcurrency: 1,
    
    // Test environment configuration
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      VITEST: 'true',
      CI: process.env.CI || 'false'
    },
    
    // No setup files to avoid conflicts with global setup
    setupFiles: [],
    
    // Enhanced reporting for better debugging
    reporters: ['verbose', 'json'],
    outputFile: {
      junit: './test-results/local-e2e-results.xml',
      json: './test-results/local-e2e-results.json'
    },
    
    // Run all tests to see complete status
    bail: false,
    
    // No retries for e2e tests - they should be deterministic
    retry: 0,
    
    // Clean up mocks between tests
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    
    // Disable coverage for e2e tests
    coverage: {
      enabled: false
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test-helpers': path.resolve(__dirname, './tests/helpers'),
      '@test-fixtures': path.resolve(__dirname, './tests/fixtures'),
      '@test-mocks': path.resolve(__dirname, './tests/mocks')
    }
  },
  esbuild: {
    target: 'node18',
    sourcemap: true
  }
});