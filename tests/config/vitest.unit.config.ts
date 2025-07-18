import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/unit/**/*.spec.ts'],
      coverage: {
        enabled: true,
        provider: 'v8',
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90
        }
      },
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false
        }
      },
      testTimeout: 5000
    }
  })
);