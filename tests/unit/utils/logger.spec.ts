/**
 * @fileoverview Unit tests for Logger utility
 * @module tests/unit/utils/logger
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import type { ModuleRegistry } from '../../../src/modules/registry';
import type { ILogger } from '../../../src/modules/core/logger/types/index';
import { LogSource } from '../../../src/modules/core/logger/types/index';

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
    
    // Unmock the logger module to get the real implementation
    vi.unmock('@/utils/logger');
    vi.unmock('../../../src/utils/logger');
    
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
        testLogger[method](LogSource.BOOTSTRAP, message, extra);
        expect(mockConsole[consoleMethod]).toHaveBeenCalledWith(
          `[BOOTSTRAP] [${method.toUpperCase()}] [${LogSource.BOOTSTRAP}] ${message}`,
          extra
        );
      } else {
        testLogger[method](LogSource.BOOTSTRAP, message);
        expect(mockConsole[consoleMethod]).toHaveBeenCalledWith(
          `[BOOTSTRAP] [${method.toUpperCase()}] [${LogSource.BOOTSTRAP}] ${message}`,
          undefined
        );
      }
    });

    it('handles LogArgs parameter correctly', () => {
      const testLogger = getLogger();
      const args = { category: 'test', userId: '123' };
      testLogger.info(LogSource.CLI, 'Test with args', args);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] [cli] Test with args',
        args
      );
    });

    it('handles log method with different levels', () => {
      const testLogger = getLogger();
      
      testLogger.log('info', LogSource.SYSTEM, 'Info via log method');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [system] Info via log method', undefined);
      
      testLogger.log('error', LogSource.DATABASE, 'Error via log method');
      expect(mockConsole.error).toHaveBeenCalledWith('[BOOTSTRAP] [ERROR] [database] Error via log method', undefined);
      
      testLogger.log('warn', LogSource.AUTH, 'Warning via log method');
      expect(mockConsole.warn).toHaveBeenCalledWith('[BOOTSTRAP] [WARN] [auth] Warning via log method', undefined);
      
      testLogger.log('debug', LogSource.MCP, 'Debug via log method');
      expect(mockConsole.debug).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] [mcp] Debug via log method', undefined);
    });

    it('handles access method', () => {
      const testLogger = getLogger();
      testLogger.access('User login successful');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOTSTRAP] [ACCESS] [bootstrap] User login successful'
      );
    });

    it('handles invalid log level gracefully', () => {
      const testLogger = getLogger();
      // Should not throw on invalid level, just do nothing
      expect(() => testLogger.log('invalid' as any, LogSource.SYSTEM, 'Message')).not.toThrow();
      expect(mockConsole.log).not.toHaveBeenCalled();
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
    let mockModuleLogger: ILogger;
    let mockRegistry: ModuleRegistry;

    beforeEach(() => {
      mockModuleLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        access: vi.fn(),
        clearLogs: vi.fn().mockResolvedValue(undefined),
        getLogs: vi.fn().mockResolvedValue(['log entry 1', 'log entry 2'])
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
      logger1.info(LogSource.SYSTEM, 'Test with module logger');
      
      expect(mockModuleLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'Test with module logger');
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockRegistry.get).toHaveBeenCalledWith('logger');
      
      // Second call uses cache
      vi.clearAllMocks();
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
      expect(logs).toEqual(['log entry 1', 'log entry 2']);
    });

    it('passes parameters to module logger methods correctly', () => {
      setModuleRegistry(mockRegistry);
      const testLogger = getLogger();
      const args = { category: 'test', userId: '456' };
      
      testLogger.debug(LogSource.AUTH, 'Debug test', args);
      expect(mockModuleLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Debug test', args);
      
      testLogger.log('warn', LogSource.DATABASE, 'Warning test');
      expect(mockModuleLogger.log).toHaveBeenCalledWith('warn', LogSource.DATABASE, 'Warning test');
      
      testLogger.access('Access test');
      expect(mockModuleLogger.access).toHaveBeenCalledWith('Access test');
    });

    it.each([
      ['registry throws error', { get: vi.fn().mockImplementation(() => { throw new Error('Registry error'); }) }],
      ['module has no getService', { get: vi.fn().mockReturnValue({}) }],
      ['getService returns null', { get: vi.fn().mockReturnValue({ getService: vi.fn().mockReturnValue(null) }) }]
    ])('falls back to bootstrap logger when %s', (scenario, registryMock) => {
      setModuleRegistry(registryMock as unknown as ModuleRegistry);
      
      const testLogger = getLogger();
      testLogger.info(LogSource.SYSTEM, 'Fallback test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [system] Fallback test', undefined);
    });
  });

  describe('Dynamic logger switching', () => {
    it('switches from bootstrap to module logger dynamically', () => {
      // Start with bootstrap
      logger.info(LogSource.BOOTSTRAP, 'Before registry');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [bootstrap] Before registry', undefined);
      
      // Set up module logger
      const mockModuleLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        access: vi.fn(),
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
      logger.info(LogSource.SYSTEM, 'After registry');
      expect(mockModuleLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'After registry');
    });

    it('clears cache when registry changes', () => {
      const createMockLogger = (name: string) => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        access: vi.fn(),
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
      getLogger().info(LogSource.MODULES, 'Test 1');
      expect(mockLogger1.info).toHaveBeenCalledWith(LogSource.MODULES, 'Test 1');

      // Set new registry - should use new logger
      setModuleRegistry(createMockRegistry(mockLogger2));
      getLogger().info(LogSource.MODULES, 'Test 2');
      expect(mockLogger2.info).toHaveBeenCalledWith(LogSource.MODULES, 'Test 2');
      expect(mockLogger1.info).not.toHaveBeenCalledWith(LogSource.MODULES, 'Test 2');
    });

    it('handles setModuleRegistry with null to clear cache', () => {
      // First set a module logger
      const mockModuleLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        access: vi.fn(),
        clearLogs: vi.fn().mockResolvedValue(undefined),
        getLogs: vi.fn().mockResolvedValue([])
      };
      
      const mockRegistry = {
        get: vi.fn().mockReturnValue({
          getService: vi.fn().mockReturnValue(mockModuleLogger)
        })
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      getLogger().info(LogSource.SYSTEM, 'With module logger');
      expect(mockModuleLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'With module logger');
      
      // Clear registry
      setModuleRegistry(null);
      getLogger().info(LogSource.SYSTEM, 'Back to bootstrap');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [system] Back to bootstrap', undefined);
    });

    it('uses proxy logger correctly for all methods', () => {
      // Test that the proxy correctly forwards all method calls
      logger.debug(LogSource.DEV, 'Debug via proxy');
      expect(mockConsole.debug).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] [dev] Debug via proxy', undefined);
      
      logger.warn(LogSource.EXECUTORS, 'Warning via proxy');
      expect(mockConsole.warn).toHaveBeenCalledWith('[BOOTSTRAP] [WARN] [executors] Warning via proxy', undefined);
      
      logger.error(LogSource.MONITOR, 'Error via proxy');
      expect(mockConsole.error).toHaveBeenCalledWith('[BOOTSTRAP] [ERROR] [monitor] Error via proxy', undefined);
    });

    it('proxy logger forwards async methods correctly', async () => {
      await logger.clearLogs();
      // Should complete without error (bootstrap logger returns resolved promise)
      
      const logs = await logger.getLogs();
      expect(logs).toEqual([]);
    });

    it('proxy logger forwards log method correctly', () => {
      logger.log('info', LogSource.PERMISSIONS, 'Info via proxy log');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [permissions] Info via proxy log', undefined);
    });

    it('proxy logger forwards access method correctly', () => {
      logger.access('Access via proxy');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [ACCESS] [bootstrap] Access via proxy');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles various LogSource values correctly', () => {
      const testLogger = getLogger();
      
      // Test all LogSource enum values
      testLogger.info(LogSource.AGENT, 'Agent message');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [agent] Agent message', undefined);
      
      testLogger.error(LogSource.USERS, 'Users error');
      expect(mockConsole.error).toHaveBeenCalledWith('[BOOTSTRAP] [ERROR] [users] Users error', undefined);
      
      testLogger.warn(LogSource.TASKS, 'Tasks warning');
      expect(mockConsole.warn).toHaveBeenCalledWith('[BOOTSTRAP] [WARN] [tasks] Tasks warning', undefined);
      
      testLogger.debug(LogSource.WORKFLOW, 'Workflow debug');
      expect(mockConsole.debug).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] [workflow] Workflow debug', undefined);
    });

    it('handles async methods with parameters', async () => {
      const testLogger = getLogger();
      
      // Test clearLogs with parameter
      await testLogger.clearLogs('system');
      // Should complete without error
      
      // Test getLogs with parameter
      const logs = await testLogger.getLogs('error');
      expect(logs).toEqual([]);
    });

    it('handles module registry with missing logger module', () => {
      const mockRegistry = {
        get: vi.fn().mockReturnValue(null)
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      const testLogger = getLogger();
      testLogger.info(LogSource.API, 'Should use bootstrap');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [api] Should use bootstrap', undefined);
    });

    it('handles module registry with getService throwing error', () => {
      const mockRegistry = {
        get: vi.fn().mockReturnValue({
          getService: vi.fn().mockImplementation(() => { throw new Error('getService error'); })
        })
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      const testLogger = getLogger();
      testLogger.info(LogSource.WEBHOOK, 'Should fallback to bootstrap');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [webhook] Should fallback to bootstrap', undefined);
    });

    it('handles module registry get method returning non-object', () => {
      const mockRegistry = {
        get: vi.fn().mockReturnValue('not an object')
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      const testLogger = getLogger();
      testLogger.info(LogSource.SCHEDULER, 'Should fallback to bootstrap');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [scheduler] Should fallback to bootstrap', undefined);
    });

    it('handles complex LogArgs with all possible fields', () => {
      const testLogger = getLogger();
      const complexArgs = {
        category: 'test-category',
        persistToDb: true,
        sessionId: 'session-123',
        userId: 'user-456',
        requestId: 'req-789',
        module: 'test-module',
        action: 'test-action',
        error: new Error('test error'),
        duration: 1234,
        status: 200,
        data: { key: 'value', nested: { prop: 42 } },
        customField: 'custom-value'
      };
      
      testLogger.error(LogSource.SYSTEM, 'Complex error log', complexArgs);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[BOOTSTRAP] [ERROR] [system] Complex error log',
        complexArgs
      );
    });

    it('handles undefined and null args gracefully', () => {
      const testLogger = getLogger();
      
      testLogger.info(LogSource.BOOTSTRAP, 'With undefined args', undefined);
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] [bootstrap] With undefined args',
        undefined
      );
      
      testLogger.warn(LogSource.BOOTSTRAP, 'With null args', null);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[BOOTSTRAP] [WARN] [bootstrap] With null args',
        null
      );
    });

    it('verifies proxy behavior with property access', () => {
      // Test that proxy correctly forwards property access
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.access).toBe('function');
      expect(typeof logger.clearLogs).toBe('function');
      expect(typeof logger.getLogs).toBe('function');
    });
  });

  describe('Coverage Completion Tests', () => {
    it('tests all branches in formatMessage method', () => {
      const testLogger = getLogger();
      
      // Test different level and source combinations to cover formatMessage branches
      testLogger.debug(LogSource.AGENT, 'agent debug');
      testLogger.info(LogSource.CLI, 'cli info');
      testLogger.warn(LogSource.DATABASE, 'database warn');
      testLogger.error(LogSource.LOGGER, 'logger error');
      
      expect(mockConsole.debug).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] [agent] agent debug', undefined);
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [cli] cli info', undefined);
      expect(mockConsole.warn).toHaveBeenCalledWith('[BOOTSTRAP] [WARN] [database] database warn', undefined);
      expect(mockConsole.error).toHaveBeenCalledWith('[BOOTSTRAP] [ERROR] [logger] logger error', undefined);
    });

    it('tests cached module logger branch coverage', () => {
      const mockModuleLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        access: vi.fn(),
        clearLogs: vi.fn().mockResolvedValue(undefined),
        getLogs: vi.fn().mockResolvedValue([])
      };
      
      const mockRegistry = {
        get: vi.fn().mockReturnValue({
          getService: vi.fn().mockReturnValue(mockModuleLogger)
        })
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      
      // First call should set cache
      const logger1 = getLogger();
      expect(mockRegistry.get).toHaveBeenCalledTimes(1);
      
      // Second call should use cache (cachedModuleLogger branch)
      const logger2 = getLogger();
      expect(mockRegistry.get).toHaveBeenCalledTimes(1); // Still only called once
      expect(logger1).toBe(logger2);
    });

    it('tests all log method switch branches', () => {
      const testLogger = getLogger();
      
      // Test each case in the switch statement
      testLogger.log('debug', LogSource.MCP, 'debug case');
      expect(mockConsole.debug).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] [mcp] debug case', undefined);
      
      testLogger.log('info', LogSource.SERVER, 'info case');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [server] info case', undefined);
      
      testLogger.log('warn', LogSource.MODULES, 'warn case');
      expect(mockConsole.warn).toHaveBeenCalledWith('[BOOTSTRAP] [WARN] [modules] warn case', undefined);
      
      testLogger.log('error', LogSource.API, 'error case');
      expect(mockConsole.error).toHaveBeenCalledWith('[BOOTSTRAP] [ERROR] [api] error case', undefined);
      
      // Test default case - invalid log level should not call any console method
      vi.clearAllMocks();
      testLogger.log('invalid' as any, LogSource.SYSTEM, 'invalid level');
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it('tests log method with args parameter', () => {
      const testLogger = getLogger();
      const args = { category: 'test', userId: '123' };
      
      // Test each case with args to ensure 100% coverage
      testLogger.log('debug', LogSource.MCP, 'debug with args', args);
      expect(mockConsole.debug).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] [mcp] debug with args', args);
      
      testLogger.log('info', LogSource.SERVER, 'info with args', args);
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] [server] info with args', args);
      
      testLogger.log('warn', LogSource.MODULES, 'warn with args', args);
      expect(mockConsole.warn).toHaveBeenCalledWith('[BOOTSTRAP] [WARN] [modules] warn with args', args);
      
      testLogger.log('error', LogSource.API, 'error with args', args);
      expect(mockConsole.error).toHaveBeenCalledWith('[BOOTSTRAP] [ERROR] [api] error with args', args);
    });

    it('tests getLogger module registry error handling branch', () => {
      // Test the catch block in getLogger when moduleRegistry.get throws
      const mockRegistry = {
        get: vi.fn().mockImplementation(() => {
          throw new Error('Registry access error');
        })
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      
      // Should catch error and fall back to bootstrap logger
      const testLogger = getLogger();
      testLogger.info(LogSource.SYSTEM, 'Should use bootstrap after error');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] [system] Should use bootstrap after error',
        undefined
      );
    });

    it('tests getLogger when moduleRegistry exists but module is falsy', () => {
      const mockRegistry = {
        get: vi.fn().mockReturnValue(null)
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      
      const testLogger = getLogger();
      testLogger.info(LogSource.SYSTEM, 'Should use bootstrap when module is null');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] [system] Should use bootstrap when module is null',
        undefined
      );
    });

    it('tests getLogger when module exists but getService is missing', () => {
      const moduleWithoutGetService = {
        someOtherMethod: vi.fn()
      };
      
      const mockRegistry = {
        get: vi.fn().mockReturnValue(moduleWithoutGetService)
      } as unknown as ModuleRegistry;
      
      setModuleRegistry(mockRegistry);
      
      const testLogger = getLogger();
      testLogger.info(LogSource.SYSTEM, 'Should use bootstrap when getService missing');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] [system] Should use bootstrap when getService missing',
        undefined
      );
    });
  });
});