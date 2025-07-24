/**
 * @fileoverview Unit tests for Logger utility
 * @module tests/unit/utils/logger
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import type { ModuleRegistry } from '../../../src/modules/registry.js';
import type { Logger } from '../../../src/modules/core/logger/index.js';

describe('Logger', () => {
  let logger: any;
  let getLogger: any;
  let setModuleRegistry: any;
  
  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
    info: console.info,
    trace: console.trace
  };

  // Mock console methods
  const mockConsole: Record<string, MockedFunction<any>> = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    trace: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Replace console methods with mocks
    Object.keys(mockConsole).forEach(method => {
      (console as any)[method] = mockConsole[method];
    });
    
    // Re-import the module to get a fresh instance with mocked console
    const loggerModule = await import('../../../src/utils/logger');
    logger = loggerModule.logger;
    getLogger = loggerModule.getLogger;
    setModuleRegistry = loggerModule.setModuleRegistry;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original console methods
    Object.keys(originalConsole).forEach(method => {
      (console as any)[method] = (originalConsole as any)[method];
    });
  });

  describe('Bootstrap Logger', () => {
    it.each([
      ['info', 'log', 'Test info message', { extra: 'data' }],
      ['error', 'error', 'Test error message', new Error('test')],
      ['warn', 'warn', 'Test warning message', null],
      ['debug', 'debug', 'Test debug message', undefined],
    ])('logs %s messages with bootstrap logger', (method, consoleMethod, message, extra) => {
      const testLogger = getLogger();
      if (extra !== undefined) {
        testLogger[method](message, extra);
        expect(mockConsole[consoleMethod]).toHaveBeenCalledWith(
          `[BOOTSTRAP] [${method.toUpperCase()}] ${message}`,
          extra
        );
      } else {
        testLogger[method](message);
        expect(mockConsole[consoleMethod]).toHaveBeenCalledWith(
          `[BOOTSTRAP] [${method.toUpperCase()}] ${message}`
        );
      }
    });

    it('handles multiple arguments', () => {
      const testLogger = getLogger();
      testLogger.info('Multiple', 'args', 123, true);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] Multiple',
        'args',
        123,
        true
      );
    });

    it('handles addLog with different levels', () => {
      const testLogger = getLogger();
      
      testLogger.addLog('info', 'Info via addLog');
      expect(mockConsole.info).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] Info via addLog');
      
      testLogger.addLog('trace', 'Trace level message');
      expect(mockConsole.trace).toHaveBeenCalledWith('[BOOTSTRAP] [TRACE] Trace level message');
      
      // Should not throw on invalid level
      expect(() => testLogger.addLog('invalid', 'Message')).not.toThrow();
    });

    it('handles async methods', async () => {
      const testLogger = getLogger();
      
      const clearResult = await testLogger.clearLogs();
      expect(clearResult).toBeUndefined();
      
      const logs = await testLogger.getLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('Module Logger Integration', () => {
    let mockModuleLogger: Logger;
    let mockRegistry: ModuleRegistry;

    beforeEach(() => {
      mockModuleLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        addLog: vi.fn(),
        clearLogs: vi.fn().mockResolvedValue(undefined),
        getLogs: vi.fn().mockResolvedValue([{ level: 'info', message: 'test', timestamp: Date.now() }])
      };

      const mockLoggerModule = {
        getService: vi.fn().mockReturnValue(mockModuleLogger)
      };

      mockRegistry = {
        get: vi.fn().mockImplementation((name) => name === 'logger' ? mockLoggerModule : null),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
        initializeAll: vi.fn().mockResolvedValue(undefined),
        shutdownAll: vi.fn().mockResolvedValue(undefined)
      } as unknown as ModuleRegistry;
    });

    it('uses module logger when registry is set and caches it', () => {
      setModuleRegistry(mockRegistry);
      
      // First call queries registry
      const logger1 = getLogger();
      logger1.info('Test with module logger');
      
      expect(mockModuleLogger.info).toHaveBeenCalledWith('Test with module logger');
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockRegistry.get).toHaveBeenCalledWith('logger');
      
      // Second call uses cache
      mockRegistry.get.mockClear();
      const logger2 = getLogger();
      expect(mockRegistry.get).not.toHaveBeenCalled();
      expect(logger1).toBe(logger2);
    });

    it('handles async methods through module logger', async () => {
      setModuleRegistry(mockRegistry);
      const testLogger = getLogger();
      
      await testLogger.clearLogs();
      expect(mockModuleLogger.clearLogs).toHaveBeenCalled();
      
      const logs = await testLogger.getLogs();
      expect(mockModuleLogger.getLogs).toHaveBeenCalled();
      expect(logs).toHaveLength(1);
    });

    it.each([
      ['registry throws error', { get: vi.fn().mockImplementation(() => { throw new Error('Registry error'); }) }],
      ['module has no getService', { get: vi.fn().mockReturnValue({}) }],
      ['getService returns null', { get: vi.fn().mockReturnValue({ getService: vi.fn().mockReturnValue(null) }) }]
    ])('falls back to bootstrap logger when %s', (scenario, registryMock) => {
      setModuleRegistry(registryMock as unknown as ModuleRegistry);
      
      const testLogger = getLogger();
      testLogger.info('Fallback test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] Fallback test');
    });
  });

  describe('Dynamic logger switching', () => {
    it('switches from bootstrap to module logger dynamically', () => {
      // Start with bootstrap
      logger.info('Before registry');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] Before registry');
      
      // Set up module logger
      const mockModuleLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        addLog: vi.fn(),
        clearLogs: vi.fn().mockResolvedValue(undefined),
        getLogs: vi.fn().mockResolvedValue([])
      };
      
      const mockRegistry = {
        get: vi.fn().mockReturnValue({
          getService: vi.fn().mockReturnValue(mockModuleLogger)
        })
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      
      // Now uses module logger
      logger.info('After registry');
      expect(mockModuleLogger.info).toHaveBeenCalledWith('After registry');
    });

    it('clears cache when registry changes', () => {
      const createMockLogger = (name: string) => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        addLog: vi.fn(),
        clearLogs: vi.fn().mockResolvedValue(undefined),
        getLogs: vi.fn().mockResolvedValue([])
      });

      const mockLogger1 = createMockLogger('logger1');
      const mockLogger2 = createMockLogger('logger2');

      const createMockRegistry = (logger: any) => ({
        get: vi.fn().mockReturnValue({
          getService: vi.fn().mockReturnValue(logger)
        })
      }) as unknown as ModuleRegistry;

      // Set first registry
      setModuleRegistry(createMockRegistry(mockLogger1));
      getLogger().info('Test 1');
      expect(mockLogger1.info).toHaveBeenCalledWith('Test 1');

      // Set new registry - should use new logger
      setModuleRegistry(createMockRegistry(mockLogger2));
      getLogger().info('Test 2');
      expect(mockLogger2.info).toHaveBeenCalledWith('Test 2');
      expect(mockLogger1.info).not.toHaveBeenCalledWith('Test 2');
    });
  });
});