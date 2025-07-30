/**
 * Setup file for integration tests
 * Configures the test environment before running integration tests
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Store original env vars
const originalEnv = { ...process.env };

// Track all active resources for cleanup
const activeResources = {
  bootstraps: new Set<any>(),
  databases: new Set<string>(),
  timers: new Set<NodeJS.Timeout>(),
  intervals: new Set<NodeJS.Timeout>()
};

beforeAll(() => {
  console.log('🔧 Setting up integration test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
  
  // Disable features that might interfere with tests
  process.env.DISABLE_SERVER = 'true';
  process.env.DISABLE_TELEMETRY = 'true';
  
  // Override global timer functions to track them
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  
  global.setTimeout = function(...args: any[]) {
    const timer = originalSetTimeout.apply(this, args);
    activeResources.timers.add(timer);
    return timer;
  };
  
  global.setInterval = function(...args: any[]) {
    const interval = originalSetInterval.apply(this, args);
    activeResources.intervals.add(interval);
    return interval;
  };
});

// Run after each test to clean up resources
afterEach(async () => {
  // DO NOT clear timers here - it breaks waitForEvent() and other test utilities
  // Timer cleanup is handled in afterAll to avoid interfering with test execution
  
  // Force close any open database connections
  try {
    const { DatabaseService } = await import('@/modules/core/database/services/database.service');
    if ((DatabaseService as any).instance) {
      await DatabaseService.reset();
    }
  } catch (error) {
    // Ignore
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Kill any remaining timers
  activeResources.timers.forEach(timer => clearTimeout(timer));
  activeResources.intervals.forEach(interval => clearInterval(interval));
  
  // Clean up all singletons
  const singletonCleanups = [
    async () => {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
      (DatabaseService as any).instance = null;
    },
    async () => {
      const { AgentService } = await import('@/modules/core/agents/services/agent.service');
      await AgentService.reset();
      (AgentService as any).instance = null;
    },
    async () => {
      const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
      LoggerService.resetInstance();
      (LoggerService as any).instance = null;
    },
    async () => {
      const { EventBusService } = await import('@/modules/core/events/services/event-bus.service');
      EventBusService.reset();
      (EventBusService as any).instance = null;
    },
    async () => {
      const { ModuleSetupService } = await import('@/modules/core/modules/services/module-setup.service');
      (ModuleSetupService as any).instance = null;
    },
    async () => {
      const { ModulesModuleService } = await import('@/modules/core/modules/services/modules-module.service');
      ModulesModuleService.reset();
    }
  ];
  
  // Run all cleanups with timeout
  await Promise.all(
    singletonCleanups.map(cleanup => 
      Promise.race([
        cleanup().catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 1000))
      ])
    )
  );
  
  // Clean up test database files
  try {
    const testDbPattern = path.join(__dirname, '**/*.db*');
    const dbFiles = await glob(testDbPattern);
    for (const file of dbFiles) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        // File might be locked, ignore
      }
    }
  } catch (error) {
    // Ignore glob errors
  }
  
  // Clean up .test-integration directory
  try {
    const testIntegrationDir = path.join(process.cwd(), '.test-integration');
    if (fs.existsSync(testIntegrationDir)) {
      fs.rmSync(testIntegrationDir, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore
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
  
  console.log('✅ Integration test environment cleaned up');
});

// Global test utilities
export const waitForEvent = (ms: number = 50): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const createTestId = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};