/**
 * @fileoverview Vitest configuration for MCP permission tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'mcp-permissions',
    include: [
      'tests/unit/server/mcp/core/**/*.spec.ts',
      'tests/e2e/mcp-tool-permissions.spec.ts'
    ],
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/mcp-test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/server/mcp/core/handlers/tool-handlers.ts',
        'src/server/mcp/core/handlers/tools/check-status.ts',
        'src/server/mcp/core/types/permissions.ts',
        'src/server/mcp/core/constants/tool/check-status.ts'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@modelcontextprotocol/sdk/types.js': path.resolve(
        __dirname,
        '../node_modules/@modelcontextprotocol/sdk/dist/types/index.d.ts'
      )
    }
  }
});