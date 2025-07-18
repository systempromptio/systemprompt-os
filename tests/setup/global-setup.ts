import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Global test setup
export function setupGlobalTestEnvironment() {
  // Store original values
  const originalEnv = { ...process.env };
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.PORT = '0'; // Use random port for tests
    
    // Suppress console output in tests unless debugging
    if (!process.env.DEBUG_TESTS) {
      console.error = () => {};
      console.warn = () => {};
    }
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  beforeEach(() => {
    // Reset modules to ensure clean state
    vi.resetModules();
    
    // Clear all timers
    vi.clearAllTimers();
    
    // Use fake timers by default
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Restore all mocks
    vi.restoreAllMocks();
  });
}

// Performance monitoring for tests
export function setupPerformanceMonitoring() {
  const testDurations: Map<string, number> = new Map();
  
  beforeEach(({ task }) => {
    if (task) {
      testDurations.set(task.name, performance.now());
    }
  });

  afterEach(({ task }) => {
    if (task && testDurations.has(task.name)) {
      const duration = performance.now() - testDurations.get(task.name)!;
      if (duration > 1000) {
        console.warn(`Slow test detected: ${task.name} took ${duration.toFixed(2)}ms`);
      }
      testDurations.delete(task.name);
    }
  });
}

// Memory leak detection
export function setupMemoryLeakDetection() {
  let initialMemory: number;
  
  beforeAll(() => {
    if (global.gc) {
      global.gc();
      initialMemory = process.memoryUsage().heapUsed;
    }
  });

  afterAll(() => {
    if (global.gc) {
      global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Warn if memory increased by more than 50MB
      if (memoryIncrease > 50 * 1024 * 1024) {
        console.warn(
          `Potential memory leak detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`
        );
      }
    }
  });
}