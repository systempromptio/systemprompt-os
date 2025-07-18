import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();
  
  while (!(await condition())) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

export function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: T
): MockedFunction<T> {
  return vi.fn(implementation) as MockedFunction<T>;
}

export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };

  const mocks = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {})
  };

  return {
    mocks,
    restore: () => {
      Object.entries(originalConsole).forEach(([key, value]) => {
        console[key as keyof typeof console] = value;
      });
    }
  };
}

export function expectToThrowAsync(
  asyncFn: () => Promise<any>,
  errorType?: new (...args: any[]) => Error,
  errorMessage?: string | RegExp
) {
  return expect(asyncFn()).rejects.toThrow(
    errorType ? new errorType(errorMessage as string) : errorMessage
  );
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createTimeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => {
      throw new Error(timeoutError);
    })
  ]);
}

export function setupTestEnvironment() {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  return {
    setEnv: (key: string, value: string) => {
      process.env[key] = value;
    },
    clearEnv: (key: string) => {
      delete process.env[key];
    }
  };
}

export async function measureExecutionTime<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

export function createTestContext<T extends Record<string, any>>(
  initialContext: T
): T & { reset: () => void } {
  const original = { ...initialContext };
  const context = { ...initialContext } as T & { reset: () => void };
  
  context.reset = () => {
    Object.keys(original).forEach(key => {
      (context as any)[key] = original[key];
    });
  };
  
  return context;
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}