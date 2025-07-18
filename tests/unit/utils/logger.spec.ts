import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../../src/utils/logger';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleDebugSpy: any;
  const originalDebug = process.env.DEBUG;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.DEBUG = originalDebug;
  });

  describe('logger.info', () => {
    it('should log info messages with [BOOTSTRAP] [INFO] prefix', () => {
      logger.info('Test info message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] Test info message'
      );
    });

    it('should log info with additional data', () => {
      const data = { user: 'test', count: 42 };
      logger.info('User action', data);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] User action',
        data
      );
    });

    it('should handle multiple arguments', () => {
      logger.info('Multiple', 'args', 123, { test: true });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] Multiple',
        'args',
        123,
        { test: true }
      );
    });
  });

  describe('logger.warn', () => {
    it('should log warning messages with [BOOTSTRAP] [WARN] prefix', () => {
      logger.warn('Test warning');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [WARN] Test warning'
      );
    });

    it('should log warnings with additional context', () => {
      logger.warn('Deprecated function', { function: 'oldMethod', replacement: 'newMethod' });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [WARN] Deprecated function',
        { function: 'oldMethod', replacement: 'newMethod' }
      );
    });
  });

  describe('logger.error', () => {
    it('should log error messages with [BOOTSTRAP] [ERROR] prefix', () => {
      logger.error('Test error');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [ERROR] Test error'
      );
    });

    it('should log errors with Error objects', () => {
      const error = new Error('Something went wrong');
      logger.error('Operation failed', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [ERROR] Operation failed',
        error
      );
    });

    it('should handle error with stack trace', () => {
      const error = new Error('Stack trace test');
      error.stack = 'Error: Stack trace test\n  at Test.suite';
      
      logger.error('Error occurred', { error: error.message, stack: error.stack });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [ERROR] Error occurred',
        { error: error.message, stack: error.stack }
      );
    });
  });

  describe('logger.debug', () => {
    it('should log debug messages', () => {
      delete process.env.DEBUG;
      logger.debug('Debug info');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] Debug info');
    });

    it('should log debug messages when DEBUG is false', () => {
      process.env.DEBUG = 'false';
      logger.debug('Debug info');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith('[BOOTSTRAP] [DEBUG] Debug info');
    });

    it('should log debug messages when DEBUG is true', () => {
      process.env.DEBUG = 'true';
      const debugData = { complex: { nested: { data: [1, 2, 3] } } };
      logger.debug('Debug info', debugData);
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [DEBUG] Debug info',
        debugData
      );
    });

    it('should handle debug without data when enabled', () => {
      process.env.DEBUG = 'true';
      logger.debug('Simple debug');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [DEBUG] Simple debug'
      );
    });
  });

  describe('Formatting', () => {
    it('should handle empty messages', () => {
      logger.info('');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] ');
    });

    it('should handle null and undefined', () => {
      logger.info('Values:', null, undefined);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] Values:',
        null,
        undefined
      );
    });

    it('should handle no arguments', () => {
      logger.info();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('[BOOTSTRAP] [INFO] undefined');
    });

    it('should handle objects and arrays', () => {
      const obj = { a: 1, b: [2, 3] };
      const arr = [1, 2, 3];
      
      logger.info('Data:', obj, arr);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BOOTSTRAP] [INFO] Data:',
        obj,
        arr
      );
    });
  });
});