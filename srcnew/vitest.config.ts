import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'modules/**/tests/unit/**/*.test.ts'
    ],
    exclude: ['node_modules/**', 'dist/**'],
  },
});