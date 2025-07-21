/**
 * @fileoverview Shared test utilities
 * @module tests/unit/test-utils/shared
 */

import { expect, vi } from 'vitest';

/**
 * Common test patterns for module lifecycle
 */
export function testModuleLifecycle(module: any, moduleName: string) {
  expect(module.name).toBe(moduleName);
  expect(module.type).toMatch(/^(core|service|daemon|plugin)$/);
  expect(module.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(module.initialize).toBeDefined();
  expect(module.shutdown).toBeDefined();
  expect(module.healthCheck).toBeDefined();
}

/**
 * Test async lifecycle methods
 */
export async function testAsyncLifecycle(module: any) {
  await expect(module.initialize({})).resolves.toBeUndefined();
  
  if (module.start) {
    await expect(module.start()).resolves.toBeUndefined();
  }
  
  if (module.stop) {
    await expect(module.stop()).resolves.toBeUndefined();
  }
  
  await expect(module.shutdown()).resolves.toBeUndefined();
}

/**
 * Test health check behavior
 */
export async function testHealthCheck(module: any, scenarios: Array<{
  setup: () => void;
  expected: { healthy: boolean; message?: string };
}>) {
  for (const { setup, expected } of scenarios) {
    setup();
    const result = await module.healthCheck();
    expect(result).toEqual(expected);
  }
}

/**
 * Test logging behavior
 */
export function testLogging(logFn: Function, mockConsole: any, scenarios: Array<{
  level: string;
  method: string;
  message: string;
  args?: any[];
  shouldLog: boolean;
}>) {
  scenarios.forEach(({ level, method, message, args = [], shouldLog }) => {
    vi.clearAllMocks();
    logFn(level, message, ...args);
    
    if (shouldLog) {
      expect(mockConsole[method]).toHaveBeenCalledWith(
        expect.stringContaining(message),
        ...args
      );
    } else {
      expect(mockConsole[method]).not.toHaveBeenCalled();
    }
  });
}

/**
 * Test error handling
 */
export function testErrorHandling(fn: Function, scenarios: Array<{
  setup: () => void;
  expectedError?: string | RegExp;
  shouldThrow: boolean;
}>) {
  scenarios.forEach(({ setup, expectedError, shouldThrow }) => {
    setup();
    
    if (shouldThrow) {
      expect(() => fn()).toThrow(expectedError);
    } else {
      expect(() => fn()).not.toThrow();
    }
  });
}

/**
 * Test parameterized scenarios
 */
export function testScenarios<T>(
  name: string,
  scenarios: Array<[string, T, any]>,
  testFn: (input: T, expected: any) => void
) {
  scenarios.forEach(([scenario, input, expected]) => {
    it(`${name} - ${scenario}`, () => {
      testFn(input, expected);
    });
  });
}