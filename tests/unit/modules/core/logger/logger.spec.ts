/**
 * @fileoverview Unit tests for Logger Module
 * @module tests/unit/modules/core/logger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerModule } from '../../../../../src/modules/core/logger/index';
import type { LoggerConfig } from '../../../../../src/modules/core/logger/index';
import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn()
}));

describe('LoggerModule', () => {
  const defaultConfig: LoggerConfig = {
    stateDir: '/tmp/test-state',
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

  let logger: LoggerModule;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up console mocks
    mockConsole = {
      log: vi.spyOn(console, 'log').mockImplementation(),
      error: vi.spyOn(console, 'error').mockImplementation(),
      warn: vi.spyOn(console, 'warn').mockImplementation(),
      debug: vi.spyOn(console, 'debug').mockImplementation()
    };
    
    vi.mocked(existsSync).mockReturnValue(false);
    logger = new LoggerModule(defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.values(mockConsole).forEach(mock => mock?.mockRestore());
  });

  describe('Module lifecycle and health', () => {
    it('should handle complete lifecycle', async () => {
      // Initialize
      await expect(logger.initialize({})).resolves.toBeUndefined();
      expect(mkdirSync).toHaveBeenCalledWith(join(defaultConfig.stateDir, 'logs'), { recursive: true });
      
      // Start/stop
      await expect(logger.start()).resolves.toBeUndefined();
      await expect(logger.stop()).resolves.toBeUndefined();
      
      // Health check - writable
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(unlinkSync).mockImplementation(() => {});
      let health = await logger.healthCheck();
      expect(health).toEqual({ healthy: true });
      
      // Health check - not writable
      vi.mocked(writeFileSync).mockImplementation(() => { throw new Error('Permission denied'); });
      health = await logger.healthCheck();
      expect(health).toEqual({ healthy: false, message: 'Logger health check failed: Permission denied' });
      
      // Shutdown
      await expect(logger.shutdown()).resolves.toBeUndefined();
    });

    it('should provide logger service interface', () => {
      const service = logger.getService();
      expect(service).toMatchObject({
        debug: expect.any(Function),
        info: expect.any(Function),
        warn: expect.any(Function),
        error: expect.any(Function),
        addLog: expect.any(Function),
        clearLogs: expect.any(Function),
        getLogs: expect.any(Function)
      });
    });
  });

  describe('Logging behavior', () => {
    it.each([
      ['debug', 'debug', 'debug', '[DEBUG]', false],
      ['info', 'info', 'log', '[INFO]', true],
      ['warn', 'warn', 'warn', '[WARN]', true],
      ['error', 'error', 'error', '[ERROR]', true]
    ])('logs %s messages correctly', (level, loggerMethod, consoleMethod, prefix, shouldLogAtInfo) => {
      // Test at debug level (all should log)
      const debugLogger = new LoggerModule({ ...defaultConfig, logLevel: 'debug' });
      debugLogger[loggerMethod as 'debug' | 'info' | 'warn' | 'error']('Test message', { extra: 'data' });
      
      expect(mockConsole[consoleMethod]).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`\\[.*\\] \\${prefix}`)),
        'Test message',
        { extra: 'data' }
      );
      
      expect(appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('system.log'),
        expect.stringContaining(`${prefix} Test message`)
      );
      
      // Test at info level
      vi.clearAllMocks();
      logger[loggerMethod as 'debug' | 'info' | 'warn' | 'error']('Test message');
      
      if (shouldLogAtInfo) {
        expect(mockConsole[consoleMethod]).toHaveBeenCalled();
        expect(appendFileSync).toHaveBeenCalled();
      } else {
        expect(mockConsole[consoleMethod]).not.toHaveBeenCalled();
        expect(appendFileSync).not.toHaveBeenCalled();
      }
    });

    it('handles error logs with dual file output', () => {
      logger.error('Critical error');
      
      const calls = vi.mocked(appendFileSync).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toContain('system.log');
      expect(calls[1][0]).toContain('error.log');
    });

    it('respects output configuration', () => {
      // Console only
      const consoleLogger = new LoggerModule({ ...defaultConfig, outputs: ['console'] });
      vi.clearAllMocks();
      consoleLogger.info('Console only');
      expect(mockConsole.log).toHaveBeenCalled();
      expect(appendFileSync).not.toHaveBeenCalled();
      
      // File only
      const fileLogger = new LoggerModule({ ...defaultConfig, outputs: ['file'] });
      vi.clearAllMocks();
      fileLogger.info('File only');
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(appendFileSync).toHaveBeenCalled();
    });

    it('handles file write errors gracefully', () => {
      vi.mocked(appendFileSync).mockImplementation(() => { throw new Error('Disk full'); });
      
      expect(() => logger.info('Test')).not.toThrow();
      expect(mockConsole.error).toHaveBeenCalledWith('Logger file write error:', expect.any(Error));
    });
  });

  describe('Log management', () => {
    it('clears logs correctly', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      
      // Clear all logs
      await logger.clearLogs();
      expect(writeFileSync).toHaveBeenCalledTimes(3);
      expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining('system.log'), '');
      expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining('error.log'), '');
      expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining('access.log'), '');
      
      // Clear specific log
      vi.clearAllMocks();
      await logger.clearLogs('custom.log');
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining('custom.log'), '');
      
      // Skip non-existent
      vi.mocked(existsSync).mockReturnValue(false);
      vi.clearAllMocks();
      await logger.clearLogs();
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('retrieves logs correctly', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('Line 1\nLine 2\n\nLine 3\n');
      
      // Get all logs
      const allLogs = await logger.getLogs();
      expect(allLogs).toHaveLength(9); // 3 files × 3 non-empty lines
      
      // Get specific log
      const specificLogs = await logger.getLogs('system.log');
      expect(specificLogs).toHaveLength(3);
      expect(specificLogs).toEqual(['Line 1', 'Line 2', 'Line 3']);
      
      // Non-existent file
      vi.mocked(existsSync).mockReturnValue(false);
      const noLogs = await logger.getLogs();
      expect(noLogs).toEqual([]);
    });
  });

  describe('Special logging features', () => {
    it('handles access logs and custom levels', () => {
      // Access logs (internal method)
      (logger as any).access('GET /api/test 200');
      expect(appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('access.log'),
        expect.stringContaining('[ACCESS] GET /api/test 200')
      );
      
      // Custom log level
      vi.clearAllMocks();
      logger.addLog('CUSTOM', 'Custom message');
      expect(appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('system.log'),
        expect.stringContaining('[CUSTOM] Custom message')
      );
      // Custom levels don't go to console
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });
});