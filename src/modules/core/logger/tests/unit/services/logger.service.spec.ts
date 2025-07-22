/**
 * @fileoverview Unit tests for LoggerService
 * @module modules/core/logger/tests/unit/services
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerConfig, LogLevelName } from '@/modules/core/logger/types';
import {
  LoggerInitializationError,
  LoggerFileWriteError,
  LoggerFileReadError,
  InvalidLogLevelError
} from '@/modules/core/logger/utils/errors';
import fs from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

// Mock the fs module
jest.mock('fs');
jest.mock('fs/promises');

describe('LoggerService', () => {
  let service: LoggerService;
  let mockConfig: LoggerConfig;
  const mockFsModule = fs as jest.Mocked<typeof fs>;
  const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
  const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;

  beforeEach(() => {
    // Reset singleton instance
    LoggerService.resetInstance();
    service = LoggerService.getInstance();
    
    // Setup default config
    mockConfig = {
      stateDir: '/test/state',
      logLevel: 'info',
      maxSize: '10MB',
      maxFiles: 5,
      outputs: ['console', 'file'],
      files: {
        system: 'system.log',
        error: 'error.log',
        access: 'access.log'
      }
    };

    // Reset all mocks
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Default mock implementations
    mockFsModule.existsSync.mockReturnValue(true);
    mockFsModule.mkdirSync.mockImplementation();
    mockFsModule.appendFileSync.mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = LoggerService.getInstance();
      const instance2 = LoggerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(service.initialize(mockConfig)).resolves.not.toThrow();
    });

    it('should throw error if already initialized', async () => {
      await service.initialize(mockConfig);
      await expect(service.initialize(mockConfig))
        .rejects.toThrow(LoggerInitializationError);
    });

    it('should create logs directory if it does not exist', async () => {
      mockFsModule.existsSync.mockReturnValue(false);
      
      await service.initialize(mockConfig);
      
      expect(mockFsModule.mkdirSync).toHaveBeenCalledWith(
        path.join(mockConfig.stateDir, 'logs'),
        { recursive: true }
      );
    });

    it('should throw error for invalid log level', async () => {
      const invalidConfig = { ...mockConfig, logLevel: 'invalid' as LogLevelName };
      
      await expect(service.initialize(invalidConfig))
        .rejects.toThrow(InvalidLogLevelError);
    });

    it('should handle directory creation errors', async () => {
      mockFsModule.existsSync.mockReturnValue(false);
      mockFsModule.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(service.initialize(mockConfig))
        .rejects.toThrow(LoggerInitializationError);
    });
  });

  describe('logging methods', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    describe('debug', () => {
      it('should log debug messages when level allows', async () => {
        await service.initialize({ ...mockConfig, logLevel: 'debug' });
        
        service.debug('Test debug message', { extra: 'data' });
        
        expect(console.debug).toHaveBeenCalled();
        expect(mockFsModule.appendFileSync).toHaveBeenCalled();
      });

      it('should not log debug messages when level is higher', () => {
        service.debug('Test debug message');
        
        expect(console.debug).not.toHaveBeenCalled();
        expect(mockFsModule.appendFileSync).not.toHaveBeenCalled();
      });

      it('should throw error if not initialized', () => {
        const uninitializedService = LoggerService.getInstance();
        LoggerService.resetInstance();
        
        expect(() => uninitializedService.debug('Test'))
          .toThrow(LoggerInitializationError);
      });
    });

    describe('info', () => {
      it('should log info messages', () => {
        service.info('Test info message');
        
        expect(console.log).toHaveBeenCalled();
        expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('system.log'),
          expect.stringContaining('[INFO] Test info message')
        );
      });

      it('should handle multiple arguments', () => {
        service.info('Test message', 'arg1', { key: 'value' }, 123);
        
        expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('arg1')
        );
      });
    });

    describe('warn', () => {
      it('should log warning messages', () => {
        service.warn('Test warning message');
        
        expect(console.warn).toHaveBeenCalled();
        expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('system.log'),
          expect.stringContaining('[WARN] Test warning message')
        );
      });
    });

    describe('error', () => {
      it('should log error messages to both system and error logs', () => {
        service.error('Test error message');
        
        expect(console.error).toHaveBeenCalled();
        expect(mockFsModule.appendFileSync).toHaveBeenCalledTimes(2);
        expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('system.log'),
          expect.stringContaining('[ERROR] Test error message')
        );
        expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('error.log'),
          expect.stringContaining('[ERROR] Test error message')
        );
      });
    });

    describe('addLog', () => {
      it('should log with custom level', () => {
        service.addLog('CUSTOM', 'Test custom message');
        
        expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('system.log'),
          expect.stringContaining('[CUSTOM] Test custom message')
        );
      });
    });

    describe('access', () => {
      it('should log to access log only', () => {
        service.access('GET /api/test 200');
        
        expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('access.log'),
          expect.stringContaining('[ACCESS] GET /api/test 200')
        );
        expect(mockFsModule.appendFileSync).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('output configuration', () => {
    it('should only write to console when file output is disabled', async () => {
      await service.initialize({ ...mockConfig, outputs: ['console'] });
      
      service.info('Test message');
      
      expect(console.log).toHaveBeenCalled();
      expect(mockFsModule.appendFileSync).not.toHaveBeenCalled();
    });

    it('should only write to file when console output is disabled', async () => {
      await service.initialize({ ...mockConfig, outputs: ['file'] });
      
      service.info('Test message');
      
      expect(console.log).not.toHaveBeenCalled();
      expect(mockFsModule.appendFileSync).toHaveBeenCalled();
    });

    it('should handle file write errors gracefully', async () => {
      await service.initialize(mockConfig);
      mockFsModule.appendFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });
      
      // Should not throw
      expect(() => service.info('Test message')).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'Logger file write error:',
        expect.any(Error)
      );
    });
  });

  describe('clearLogs', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should clear specific log file', async () => {
      mockFsModule.existsSync.mockReturnValue(true);
      mockWriteFile.mockResolvedValue();
      
      await service.clearLogs('system.log');
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(mockConfig.stateDir, 'logs', 'system.log'),
        ''
      );
    });

    it('should clear all log files when no file specified', async () => {
      mockFsModule.existsSync.mockReturnValue(true);
      mockWriteFile.mockResolvedValue();
      
      await service.clearLogs();
      
      expect(mockWriteFile).toHaveBeenCalledTimes(3);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('system.log'),
        ''
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('error.log'),
        ''
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('access.log'),
        ''
      );
    });

    it('should skip non-existent files', async () => {
      mockFsModule.existsSync.mockReturnValue(false);
      
      await service.clearLogs('system.log');
      
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should throw error on write failure', async () => {
      mockFsModule.existsSync.mockReturnValue(true);
      mockWriteFile.mockRejectedValue(new Error('Write failed'));
      
      await expect(service.clearLogs('system.log'))
        .rejects.toThrow(LoggerFileWriteError);
    });
  });

  describe('getLogs', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should read specific log file', async () => {
      const mockLogs = '[2024-01-01] [INFO] Test log 1\n[2024-01-01] [INFO] Test log 2\n';
      mockFsModule.existsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(mockLogs);
      
      const logs = await service.getLogs('system.log');
      
      expect(mockReadFile).toHaveBeenCalledWith(
        path.join(mockConfig.stateDir, 'logs', 'system.log'),
        'utf-8'
      );
      expect(logs).toEqual([
        '[2024-01-01] [INFO] Test log 1',
        '[2024-01-01] [INFO] Test log 2'
      ]);
    });

    it('should read all log files when no file specified', async () => {
      const mockSystemLogs = '[2024-01-01] [INFO] System log\n';
      const mockErrorLogs = '[2024-01-01] [ERROR] Error log\n';
      const mockAccessLogs = '[2024-01-01] [ACCESS] Access log\n';
      
      mockFsModule.existsSync.mockReturnValue(true);
      mockReadFile
        .mockResolvedValueOnce(mockSystemLogs)
        .mockResolvedValueOnce(mockErrorLogs)
        .mockResolvedValueOnce(mockAccessLogs);
      
      const logs = await service.getLogs();
      
      expect(mockReadFile).toHaveBeenCalledTimes(3);
      expect(logs).toHaveLength(3);
      expect(logs).toContain('[2024-01-01] [INFO] System log');
      expect(logs).toContain('[2024-01-01] [ERROR] Error log');
      expect(logs).toContain('[2024-01-01] [ACCESS] Access log');
    });

    it('should return empty array for non-existent files', async () => {
      mockFsModule.existsSync.mockReturnValue(false);
      
      const logs = await service.getLogs('system.log');
      
      expect(logs).toEqual([]);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('should filter empty lines', async () => {
      mockFsModule.existsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('Log 1\n\n  \nLog 2\n\n');
      
      const logs = await service.getLogs('system.log');
      
      expect(logs).toEqual(['Log 1', 'Log 2']);
    });

    it('should throw error on read failure', async () => {
      mockFsModule.existsSync.mockReturnValue(true);
      mockReadFile.mockRejectedValue(new Error('Read failed'));
      
      await expect(service.getLogs('system.log'))
        .rejects.toThrow(LoggerFileReadError);
    });
  });

  describe('message formatting', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should format objects as JSON', () => {
      const obj = { key: 'value', nested: { prop: 123 } };
      service.info('Test', obj);
      
      expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(JSON.stringify(obj))
      );
    });

    it('should handle circular references in objects', () => {
      const obj: any = { key: 'value' };
      obj.circular = obj;
      
      service.info('Test', obj);
      
      // Should not throw and should fall back to String()
      expect(mockFsModule.appendFileSync).toHaveBeenCalled();
    });

    it('should format null and undefined values', () => {
      service.info('Test', null, undefined);
      
      expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('null undefined')
      );
    });

    it('should include timestamp in ISO format', () => {
      const isoRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
      service.info('Test');
      
      expect(mockFsModule.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(isoRegex)
      );
    });
  });
});