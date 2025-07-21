/**
 * @fileoverview Test setup for MCP permission tests
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock crypto.randomUUID globally
if (!global.crypto) {
  global.crypto = {} as any;
}
global.crypto.randomUUID = () => 'test-uuid-' + Date.now() + '-' + Math.random();

// Mock database queries (if needed in future)
vi.mock('@/database', () => ({
  db: {
    query: vi.fn().mockResolvedValue({ rows: [] })
  }
}));

// Setup test timeouts
beforeAll(() => {
  vi.setConfig({ testTimeout: 10000 });
});

// Clean up after tests
afterEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for async operations to complete
   */
  async waitForAsync(ms: number = 0): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Create a mock session ID
   */
  createSessionId(role: 'admin' | 'basic' = 'basic'): string {
    return `${role}-test-session-${Date.now()}`;
  },

  /**
   * Assert tool permission error
   */
  expectPermissionError(error: any, role: string, tool: string): void {
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      `Permission denied: ${role} role cannot access ${tool} tool`
    );
  }
};

// Type declarations for global test utilities
declare global {
  var testUtils: {
    waitForAsync(ms?: number): Promise<void>;
    createSessionId(role?: 'admin' | 'basic'): string;
    expectPermissionError(error: any, role: string, tool: string): void;
  };
}