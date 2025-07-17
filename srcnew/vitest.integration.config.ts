import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts',
      'modules/**/tests/integration/**/*.test.ts'
    ],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    resolve: {
      alias: {
        '@modelcontextprotocol/sdk': '@modelcontextprotocol/sdk'
      }
    }
  },
});