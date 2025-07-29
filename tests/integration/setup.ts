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

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Clean up singletons
  try {
    const { DatabaseService } = await import('@/modules/core/database/services/database.service');
    await DatabaseService.reset();
  } catch (error) {
    // Service might not be loaded
  }

  try {
    const { AgentService } = await import('@/modules/core/agents/services/agent.service');
    await AgentService.reset();
  } catch (error) {
    // Service might not be loaded
  }

  try {
    const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
    LoggerService.resetInstance();
  } catch (error) {
    // Service might not be loaded
  }

  try {
    const { EventBusService } = await import('@/modules/core/events/services/event-bus.service');
    EventBusService.reset();
  } catch (error) {
    // Service might not be loaded
  }
  
  // Restore original environment
  Object.keys(process.env).forEach(key => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  
  Object.assign(process.env, originalEnv);

  // Force garbage collection if available
  if (typeof global.gc === 'function') {
    global.gc();
  }
});

// Global test utilities
export const waitForEvent = (ms: number = 50): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const createTestId = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};