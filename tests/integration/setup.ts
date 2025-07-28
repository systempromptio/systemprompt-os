/**
 * Setup file for integration tests
 * Configures the test environment before running integration tests
 */

import { beforeAll, afterAll } from 'vitest';

// Store original env vars
const originalEnv = { ...process.env };

beforeAll(() => {
  console.log('🔧 Setting up integration test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
  
  // Disable features that might interfere with tests
  process.env.DISABLE_SERVER = 'true';
  process.env.DISABLE_TELEMETRY = 'true';
});

afterAll(() => {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Restore original environment
  Object.keys(process.env).forEach(key => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  
  Object.assign(process.env, originalEnv);
});

// Global test utilities
export const waitForEvent = (ms: number = 50): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const createTestId = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};