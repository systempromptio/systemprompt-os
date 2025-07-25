/**
 * @fileoverview Unit tests for Console Logger utility
 * @module tests/unit/utils/console-logger
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import {
  consoleInfo,
  consoleError,
  consoleWarn,
  consoleDebug,
  createConsoleLogger
} from '../../../src/utils/console-logger.js';

describe('Console Logger', () => {
  // Store original console methods and environment
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };
  const originalEnv = process.env;
  const originalArgv = process.argv;

  // Mock console methods
  const mockConsole: Record<string, MockedFunction<any>> = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Replace console methods with mocks
    Object.keys(mockConsole).forEach(method => {
      (console as any)[method] = mockConsole[method];
    });

    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.LOG_MODE;
  });

  afterEach(() => {
    vi.clearAllMocks();
    
    // Restore original console methods
    Object.keys(originalConsole).forEach(method => {
      (console as any)[method] = (originalConsole as any)[method];
    });
    
    // Restore original environment
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  describe('isCliMode detection', () => {
    describe('consoleInfo', () => {
      it('logs with [BOOT] prefix when not in CLI mode (default)', () => {
        consoleInfo('test message');
        
        expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test message');
        expect(mockConsole.log).toHaveBeenCalledTimes(1);
      });

      it('logs with additional arguments when not in CLI mode', () => {
        const testObj = { key: 'value' };
        const testArray = [1, 2, 3];
        
        consoleInfo('test message', testObj, testArray, 'extra');
        
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[BOOT] test message',
          testObj,
          testArray,
          'extra'
        );
      });

      it('does not log when LOG_MODE is "cli"', () => {
        process.env.LOG_MODE = 'cli';
        
        consoleInfo('test message');
        
        expect(mockConsole.log).not.toHaveBeenCalled();
      });

      it('does not log when process.argv[1] contains "cli"', () => {
        process.argv = ['node', '/path/to/cli/script.js'];
        
        consoleInfo('test message');
        
        expect(mockConsole.log).not.toHaveBeenCalled();
      });

      it('does not log when process.argv[1] contains "cli" in middle of path', () => {
        process.argv = ['node', '/path/cli/to/script.js'];
        
        consoleInfo('test message');
        
        expect(mockConsole.log).not.toHaveBeenCalled();
      });

      it('logs when process.argv[1] does not contain "cli"', () => {
        process.argv = ['node', '/path/to/server.js'];
        
        consoleInfo('test message');
        
        expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test message');
      });

      it('logs when process.argv[1] is undefined', () => {
        process.argv = ['node'];
        
        consoleInfo('test message');
        
        expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test message');
      });

      it('logs when process.argv is empty', () => {
        process.argv = [];
        
        consoleInfo('test message');
        
        expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test message');
      });

      it('handles empty message string', () => {
        consoleInfo('');
        
        expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] ');
      });

      it('handles multiple argument types', () => {
        const testCases = [
          undefined,
          null,
          0,
          false,
          '',
          {},
          [],
          new Error('test error'),
          Symbol('test'),
          BigInt(123)
        ];
        
        consoleInfo('test message', ...testCases);
        
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[BOOT] test message',
          ...testCases
        );
      });
    });

    describe('consoleError', () => {
      it('logs with [BOOT ERROR] prefix when not in CLI mode', () => {
        consoleError('error message');
        
        expect(mockConsole.error).toHaveBeenCalledWith('[BOOT ERROR] error message');
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('logs with additional arguments when not in CLI mode', () => {
        const error = new Error('test error');
        
        consoleError('error message', error, 'context');
        
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[BOOT ERROR] error message',
          error,
          'context'
        );
      });

      it('does not log when LOG_MODE is "cli"', () => {
        process.env.LOG_MODE = 'cli';
        
        consoleError('error message');
        
        expect(mockConsole.error).not.toHaveBeenCalled();
      });

      it('does not log when process.argv[1] contains "cli"', () => {
        process.argv = ['node', '/usr/local/bin/cli-tool'];
        
        consoleError('error message');
        
        expect(mockConsole.error).not.toHaveBeenCalled();
      });

      it('logs when neither CLI condition is met', () => {
        process.env.LOG_MODE = 'server';
        process.argv = ['node', '/path/to/server.js'];
        
        consoleError('error message');
        
        expect(mockConsole.error).toHaveBeenCalledWith('[BOOT ERROR] error message');
      });

      it('handles Error objects as arguments', () => {
        const error = new Error('test error');
        error.stack = 'Error: test error\n    at test';
        
        consoleError('error occurred', error);
        
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[BOOT ERROR] error occurred',
          error
        );
      });
    });

    describe('consoleWarn', () => {
      it('logs with [BOOT WARN] prefix when not in CLI mode', () => {
        consoleWarn('warning message');
        
        expect(mockConsole.warn).toHaveBeenCalledWith('[BOOT WARN] warning message');
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      });

      it('logs with additional arguments when not in CLI mode', () => {
        const context = { module: 'test', action: 'warn' };
        
        consoleWarn('warning message', context, 'extra info');
        
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[BOOT WARN] warning message',
          context,
          'extra info'
        );
      });

      it('does not log when LOG_MODE is "cli"', () => {
        process.env.LOG_MODE = 'cli';
        
        consoleWarn('warning message');
        
        expect(mockConsole.warn).not.toHaveBeenCalled();
      });

      it('does not log when process.argv[1] contains "cli"', () => {
        process.argv = ['node', 'dist/cli.js'];
        
        consoleWarn('warning message');
        
        expect(mockConsole.warn).not.toHaveBeenCalled();
      });

      it('logs when CLI detection fails', () => {
        process.env.LOG_MODE = 'development';
        process.argv = ['node', 'dist/server.js'];
        
        consoleWarn('warning message');
        
        expect(mockConsole.warn).toHaveBeenCalledWith('[BOOT WARN] warning message');
      });
    });

    describe('consoleDebug', () => {
      it('logs with [BOOT DEBUG] prefix when not in CLI mode', () => {
        consoleDebug('debug message');
        
        expect(mockConsole.log).toHaveBeenCalledWith('[BOOT DEBUG] debug message');
        expect(mockConsole.log).toHaveBeenCalledTimes(1);
      });

      it('logs with additional arguments when not in CLI mode', () => {
        const debugData = { timestamp: Date.now(), module: 'test' };
        
        consoleDebug('debug message', debugData, 'verbose');
        
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[BOOT DEBUG] debug message',
          debugData,
          'verbose'
        );
      });

      it('does not log when LOG_MODE is "cli"', () => {
        process.env.LOG_MODE = 'cli';
        
        consoleDebug('debug message');
        
        expect(mockConsole.log).not.toHaveBeenCalled();
      });

      it('does not log when process.argv[1] contains "cli"', () => {
        process.argv = ['node', 'build/src/cli/index.js'];
        
        consoleDebug('debug message');
        
        expect(mockConsole.log).not.toHaveBeenCalled();
      });

      it('logs when not in CLI mode with complex data structures', () => {
        const complexData = {
          nested: {
            array: [1, 2, { key: 'value' }],
            map: new Map([['key', 'value']]),
            set: new Set([1, 2, 3])
          }
        };
        
        consoleDebug('debug message', complexData);
        
        expect(mockConsole.log).toHaveBeenCalledWith(
          '[BOOT DEBUG] debug message',
          complexData
        );
      });
    });
  });

  describe('CLI mode detection edge cases', () => {
    it('detects CLI mode when LOG_MODE is exactly "cli"', () => {
      process.env.LOG_MODE = 'cli';
      
      consoleInfo('test');
      consoleError('test');
      consoleWarn('test');
      consoleDebug('test');
      
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('does not detect CLI mode when LOG_MODE contains "cli" but is not exact match', () => {
      process.env.LOG_MODE = 'client';
      
      consoleInfo('test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test');
    });

    it('detects CLI mode with case-sensitive process.argv check', () => {
      process.argv = ['node', '/path/to/CLI/script.js']; // uppercase CLI
      
      consoleInfo('test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test');
    });

    it('detects CLI mode with "cli" at the end of path', () => {
      process.argv = ['node', '/path/to/script-cli'];
      
      consoleInfo('test');
      
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('handles both CLI conditions being true', () => {
      process.env.LOG_MODE = 'cli';
      process.argv = ['node', '/path/cli/script.js'];
      
      consoleInfo('test');
      
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('handles null or undefined process.argv[1]', () => {
      process.argv = ['node', null as any];
      
      consoleInfo('test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test');
    });
  });

  describe('createConsoleLogger', () => {
    it('returns an object with all required ILogger methods', () => {
      const logger = createConsoleLogger();
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('returns methods that are the actual console logging functions', () => {
      const logger = createConsoleLogger();
      
      expect(logger.info).toBe(consoleInfo);
      expect(logger.error).toBe(consoleError);
      expect(logger.warn).toBe(consoleWarn);
      expect(logger.debug).toBe(consoleDebug);
    });

    it('creates a working logger that can be called', () => {
      const logger = createConsoleLogger();
      
      logger.info('info test');
      logger.error('error test');
      logger.warn('warn test');
      logger.debug('debug test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] info test');
      expect(mockConsole.error).toHaveBeenCalledWith('[BOOT ERROR] error test');
      expect(mockConsole.warn).toHaveBeenCalledWith('[BOOT WARN] warn test');
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT DEBUG] debug test');
    });

    it('creates multiple loggers that are independent instances', () => {
      const logger1 = createConsoleLogger();
      const logger2 = createConsoleLogger();
      
      expect(logger1).not.toBe(logger2);
      expect(logger1.info).toBe(logger2.info); // Same function references
      expect(logger1.error).toBe(logger2.error);
      expect(logger1.warn).toBe(logger2.warn);
      expect(logger1.debug).toBe(logger2.debug);
    });

    it('logger works correctly in CLI mode', () => {
      process.env.LOG_MODE = 'cli';
      const logger = createConsoleLogger();
      
      logger.info('should not log');
      logger.error('should not log');
      logger.warn('should not log');
      logger.debug('should not log');
      
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('logger handles multiple arguments correctly', () => {
      const logger = createConsoleLogger();
      const testData = { test: 'data' };
      
      logger.info('test message', testData, 123, true);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[BOOT] test message',
        testData,
        123,
        true
      );
    });
  });

  describe('argument handling variations', () => {
    it('handles functions as arguments', () => {
      const testFunction = () => 'test';
      
      consoleInfo('function test', testFunction);
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] function test', testFunction);
    });

    it('handles circular references in objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      expect(() => {
        consoleInfo('circular test', circularObj);
      }).not.toThrow();
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] circular test', circularObj);
    });

    it('handles very long strings', () => {
      const longString = 'a'.repeat(10000);
      
      consoleInfo(longString);
      
      expect(mockConsole.log).toHaveBeenCalledWith(`[BOOT] ${longString}`);
    });

    it('handles special characters and unicode', () => {
      const specialChars = '🚀 Special chars: \n\t\r\b\f\v\0 Unicode: 🌟🎉';
      
      consoleInfo(specialChars, '中文', 'العربية', 'русский');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        `[BOOT] ${specialChars}`,
        '中文',
        'العربية',
        'русский'
      );
    });

    it('handles Date objects', () => {
      const testDate = new Date('2023-01-01T00:00:00.000Z');
      
      consoleInfo('date test', testDate);
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] date test', testDate);
    });

    it('handles RegExp objects', () => {
      const testRegex = /test.*pattern/gi;
      
      consoleInfo('regex test', testRegex);
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] regex test', testRegex);
    });
  });

  describe('environment variable edge cases', () => {
    it('handles LOG_MODE with extra whitespace', () => {
      process.env.LOG_MODE = ' cli ';
      
      consoleInfo('test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test');
    });

    it('handles LOG_MODE with different casing', () => {
      process.env.LOG_MODE = 'CLI';
      
      consoleInfo('test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test');
    });

    it('handles empty LOG_MODE', () => {
      process.env.LOG_MODE = '';
      
      consoleInfo('test');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[BOOT] test');
    });
  });
});