import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/e2e/docker/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/e2e/local/**/*', 'node_modules/**/*'],
    testTimeout: 180000, // 3 minutes for Docker operations
    hookTimeout: 60000, // 1 minute for setup/teardown
    teardownTimeout: 60000,
    globalSetup: ['tests/e2e/docker/global-setup.ts'],
    globalTeardown: ['tests/e2e/docker/global-teardown.ts'],
    pool: 'forks', // Use forks for better isolation
    poolOptions: {
      forks: {
        singleFork: true // Sequential execution for stability
      }
    },
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug'
    },
    setupFiles: [],
    reporters: ['verbose'],
    outputFile: {
      junit: './test-results/docker-e2e-results.xml'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  esbuild: {
    target: 'node18'
  }
});