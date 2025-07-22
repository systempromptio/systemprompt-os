/**
 * @fileoverview Unit tests for logger error classes
 * @module modules/core/logger/tests/unit/utils
 */

import {
  LoggerError,
  LoggerInitializationError,
  LoggerFileWriteError,
  LoggerFileReadError,
  InvalidLogLevelError,
  LoggerDirectoryError
} from '@/modules/core/logger/utils/errors';
import { LoggerErrorCode } from '@/modules/core/logger/types';

describe('Logger Error Classes', () => {
  describe('LoggerError', () => {
    it('should create base error with all properties', () => {
      const cause = new Error('Original error');
      const error = new LoggerError(
        'Test error message',
        LoggerErrorCode.INITIALIZATION_FAILED,
        500,
        cause
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe(LoggerErrorCode.INITIALIZATION_FAILED);
      expect(error.statusCode).toBe(500);
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('LoggerError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should work without optional parameters', () => {
      const error = new LoggerError(
        'Test error',
        LoggerErrorCode.FILE_WRITE_FAILED
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(LoggerErrorCode.FILE_WRITE_FAILED);
      expect(error.statusCode).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should have proper stack trace', () => {
      const error = new LoggerError(
        'Test error',
        LoggerErrorCode.INVALID_LOG_LEVEL
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('LoggerError');
    });
  });

  describe('LoggerInitializationError', () => {
    it('should create initialization error with formatted message', () => {
      const error = new LoggerInitializationError('Config missing');

      expect(error.message).toBe('Logger initialization failed: Config missing');
      expect(error.code).toBe(LoggerErrorCode.INITIALIZATION_FAILED);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('LoggerInitializationError');
    });

    it('should accept cause error', () => {
      const cause = new Error('Underlying issue');
      const error = new LoggerInitializationError('Failed', cause);

      expect(error.message).toBe('Logger initialization failed: Failed');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of LoggerError', () => {
      const error = new LoggerInitializationError('Test');
      expect(error).toBeInstanceOf(LoggerError);
    });
  });

  describe('LoggerFileWriteError', () => {
    it('should create file write error with filename', () => {
      const error = new LoggerFileWriteError('system.log');

      expect(error.message).toBe('Failed to write to log file: system.log');
      expect(error.code).toBe(LoggerErrorCode.FILE_WRITE_FAILED);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('LoggerFileWriteError');
    });

    it('should accept cause error', () => {
      const cause = new Error('Disk full');
      const error = new LoggerFileWriteError('error.log', cause);

      expect(error.message).toBe('Failed to write to log file: error.log');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of LoggerError', () => {
      const error = new LoggerFileWriteError('test.log');
      expect(error).toBeInstanceOf(LoggerError);
    });
  });

  describe('LoggerFileReadError', () => {
    it('should create file read error with filename', () => {
      const error = new LoggerFileReadError('access.log');

      expect(error.message).toBe('Failed to read log file: access.log');
      expect(error.code).toBe(LoggerErrorCode.FILE_READ_FAILED);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('LoggerFileReadError');
    });

    it('should accept cause error', () => {
      const cause = new Error('Permission denied');
      const error = new LoggerFileReadError('system.log', cause);

      expect(error.message).toBe('Failed to read log file: system.log');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of LoggerError', () => {
      const error = new LoggerFileReadError('test.log');
      expect(error).toBeInstanceOf(LoggerError);
    });
  });

  describe('InvalidLogLevelError', () => {
    it('should create error with invalid level information', () => {
      const error = new InvalidLogLevelError('verbose');

      expect(error.message).toBe(
        'Invalid log level: verbose. Valid levels are: debug, info, warn, error'
      );
      expect(error.code).toBe(LoggerErrorCode.INVALID_LOG_LEVEL);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('InvalidLogLevelError');
    });

    it('should not accept cause (as per constructor)', () => {
      const error = new InvalidLogLevelError('invalid');
      expect(error.cause).toBeUndefined();
    });

    it('should be instance of LoggerError', () => {
      const error = new InvalidLogLevelError('test');
      expect(error).toBeInstanceOf(LoggerError);
    });
  });

  describe('LoggerDirectoryError', () => {
    it('should create directory error with path', () => {
      const error = new LoggerDirectoryError('/var/logs');

      expect(error.message).toBe(
        'Failed to create or access log directory: /var/logs'
      );
      expect(error.code).toBe(LoggerErrorCode.DIRECTORY_CREATE_FAILED);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('LoggerDirectoryError');
    });

    it('should accept cause error', () => {
      const cause = new Error('EACCES: permission denied');
      const error = new LoggerDirectoryError('/restricted/logs', cause);

      expect(error.message).toBe(
        'Failed to create or access log directory: /restricted/logs'
      );
      expect(error.cause).toBe(cause);
    });

    it('should be instance of LoggerError', () => {
      const error = new LoggerDirectoryError('/test');
      expect(error).toBeInstanceOf(LoggerError);
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain proper prototype chain', () => {
      const errors = [
        new LoggerInitializationError('test'),
        new LoggerFileWriteError('test.log'),
        new LoggerFileReadError('test.log'),
        new InvalidLogLevelError('test'),
        new LoggerDirectoryError('/test')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(LoggerError);
        expect(error.constructor).not.toBe(LoggerError);
      });
    });

    it('should be catchable as Error', () => {
      const throwError = () => {
        throw new LoggerInitializationError('test');
      };

      expect(throwError).toThrow(Error);
    });

    it('should be catchable as LoggerError', () => {
      const throwError = () => {
        throw new LoggerFileWriteError('test.log');
      };

      expect(throwError).toThrow(LoggerError);
    });

    it('should be catchable as specific error type', () => {
      const throwError = () => {
        throw new InvalidLogLevelError('test');
      };

      expect(throwError).toThrow(InvalidLogLevelError);
    });
  });

  describe('Error serialization', () => {
    it('should serialize to JSON properly', () => {
      const cause = new Error('Cause message');
      const error = new LoggerError(
        'Test error',
        LoggerErrorCode.FILE_WRITE_FAILED,
        500,
        cause
      );

      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      expect(parsed.message).toBe('Test error');
      expect(parsed.code).toBe(LoggerErrorCode.FILE_WRITE_FAILED);
      expect(parsed.statusCode).toBe(500);
      expect(parsed.name).toBe('LoggerError');
    });

    it('should include stack trace in string representation', () => {
      const error = new LoggerInitializationError('Test');
      const str = error.toString();

      expect(str).toContain('LoggerInitializationError');
      expect(str).toContain('Logger initialization failed: Test');
    });
  });
});