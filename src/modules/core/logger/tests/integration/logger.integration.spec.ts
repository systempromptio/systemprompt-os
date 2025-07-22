/**
 * @fileoverview Integration tests for the logger module
 * @module modules/core/logger/tests/integration
 */

import { LoggerModule } from '@/modules/core/logger';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { ModuleContext } from '@/modules/types';
import { LoggerConfig } from '@/modules/core/logger/types';
import fs from 'fs';
import { readFile, rm, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Logger Module Integration Tests', () => {
  let module: LoggerModule;
  let tempDir: string;
  let mockContext: ModuleContext;

  beforeAll(async () => {
    // Create temporary directory for logs
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'logger-test-')
    );
  });

  afterAll(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reset logger service
    LoggerService.resetInstance();
    
    // Create new module instance
    module = new LoggerModule();

    // Setup context with temp directory
    mockContext = {
      config: {
        stateDir: tempDir,
        logLevel: 'debug',
        maxSize: '10MB',
        maxFiles: 5,
        outputs: ['console', 'file'],
        files: {
          system: 'system.log',
          error: 'error.log',
          access: 'access.log'
        }
      } as LoggerConfig
    };

    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    // Stop module if running
    try {
      await module.stop();
    } catch {}

    // Clean up log files
    const logsDir = path.join(tempDir, 'logs');
    if (fs.existsSync(logsDir)) {
      await rm(logsDir, { recursive: true, force: true });
    }

    // Restore console
    jest.restoreAllMocks();
  });

  describe('Full module lifecycle', () => {
    it('should complete full lifecycle successfully', async () => {
      // Initialize
      await expect(module.initialize(mockContext)).resolves.not.toThrow();
      
      // Start
      await expect(module.start()).resolves.not.toThrow();
      
      // Health check
      const health = await module.healthCheck();
      expect(health.healthy).toBe(true);
      
      // Use the service
      const service = module.getService();
      service.info('Test message from integration test');
      
      // Stop
      await expect(module.stop()).resolves.not.toThrow();
    });
  });

  describe('File logging integration', () => {
    it('should create log files and write messages', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();
      const logsDir = path.join(tempDir, 'logs');

      // Log different levels
      service.debug('Debug message');
      service.info('Info message');
      service.warn('Warning message');
      service.error('Error message');
      service.access('GET /api/test 200');

      // Wait a bit for file writes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check system log
      const systemLog = await readFile(
        path.join(logsDir, 'system.log'),
        'utf-8'
      );
      expect(systemLog).toContain('[DEBUG] Debug message');
      expect(systemLog).toContain('[INFO] Info message');
      expect(systemLog).toContain('[WARN] Warning message');
      expect(systemLog).toContain('[ERROR] Error message');

      // Check error log
      const errorLog = await readFile(
        path.join(logsDir, 'error.log'),
        'utf-8'
      );
      expect(errorLog).toContain('[ERROR] Error message');
      expect(errorLog).not.toContain('[INFO] Info message');

      // Check access log
      const accessLog = await readFile(
        path.join(logsDir, 'access.log'),
        'utf-8'
      );
      expect(accessLog).toContain('[ACCESS] GET /api/test 200');
    });

    it('should respect log level configuration', async () => {
      // Initialize with 'warn' level
      mockContext.config.logLevel = 'warn';
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();
      const logsDir = path.join(tempDir, 'logs');

      // Log different levels
      service.debug('Debug - should not appear');
      service.info('Info - should not appear');
      service.warn('Warning - should appear');
      service.error('Error - should appear');

      // Wait for file writes
      await new Promise(resolve => setTimeout(resolve, 100));

      const systemLog = await readFile(
        path.join(logsDir, 'system.log'),
        'utf-8'
      );
      
      expect(systemLog).not.toContain('Debug - should not appear');
      expect(systemLog).not.toContain('Info - should not appear');
      expect(systemLog).toContain('Warning - should appear');
      expect(systemLog).toContain('Error - should appear');
    });
  });

  describe('Log management operations', () => {
    it('should clear logs successfully', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();
      const logsDir = path.join(tempDir, 'logs');

      // Write some logs
      service.info('Message before clear');
      service.error('Error before clear');

      // Wait for writes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear all logs
      await service.clearLogs();

      // Check files are empty
      const systemLog = await readFile(
        path.join(logsDir, 'system.log'),
        'utf-8'
      );
      const errorLog = await readFile(
        path.join(logsDir, 'error.log'),
        'utf-8'
      );

      expect(systemLog).toBe('');
      expect(errorLog).toBe('');
    });

    it('should retrieve logs successfully', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();

      // Write some logs
      service.info('First message');
      service.warn('Second message');
      service.error('Third message');

      // Wait for writes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get all logs
      const allLogs = await service.getLogs();
      
      expect(allLogs.length).toBeGreaterThan(0);
      expect(allLogs.some(log => log.includes('First message'))).toBe(true);
      expect(allLogs.some(log => log.includes('Second message'))).toBe(true);
      expect(allLogs.some(log => log.includes('Third message'))).toBe(true);

      // Get specific log file
      const errorLogs = await service.getLogs('error.log');
      expect(errorLogs.some(log => log.includes('Third message'))).toBe(true);
      expect(errorLogs.some(log => log.includes('First message'))).toBe(false);
    });
  });

  describe('Console output integration', () => {
    it('should write to console when enabled', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();

      service.debug('Debug to console');
      service.info('Info to console');
      service.warn('Warn to console');
      service.error('Error to console');

      expect(console.debug).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('should not write to console when disabled', async () => {
      mockContext.config.outputs = ['file'];
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();

      service.info('Should not appear in console');

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('Error handling integration', () => {
    it('should handle missing log directory gracefully', async () => {
      // Use a directory that will fail
      mockContext.config.stateDir = '/invalid/path/that/does/not/exist';
      
      await expect(module.initialize(mockContext))
        .rejects.toThrow('Logger initialization failed');
    });

    it('should continue logging to console if file write fails', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();
      const logsDir = path.join(tempDir, 'logs');

      // Make logs directory read-only (simulate write failure)
      await fs.promises.chmod(logsDir, 0o444);

      // Should not throw, but log to console
      expect(() => service.info('Test message')).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'Logger file write error:',
        expect.any(Error)
      );

      // Restore permissions
      await fs.promises.chmod(logsDir, 0o755);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent log writes', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();

      // Write many logs concurrently
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            service.info(`Concurrent message ${i}`);
            service.error(`Concurrent error ${i}`);
          })
        );
      }

      await Promise.all(promises);

      // Wait for all writes
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all logs were written
      const logs = await service.getLogs();
      const infoCount = logs.filter(log => 
        log.includes('Concurrent message')
      ).length;
      const errorCount = logs.filter(log => 
        log.includes('Concurrent error')
      ).length;

      expect(infoCount).toBe(100);
      expect(errorCount).toBe(100);
    });
  });

  describe('Module exports', () => {
    it('should export expected interfaces', async () => {
      await module.initialize(mockContext);
      
      const exports = module.exports;
      
      expect(exports).toBeDefined();
      expect(exports.service).toBeDefined();
      expect(exports.LoggerService).toBe(LoggerService);
      expect(exports.types).toBeDefined();
      
      // Verify service methods
      const service = exports.service;
      expect(typeof service.debug).toBe('function');
      expect(typeof service.info).toBe('function');
      expect(typeof service.warn).toBe('function');
      expect(typeof service.error).toBe('function');
      expect(typeof service.addLog).toBe('function');
      expect(typeof service.clearLogs).toBe('function');
      expect(typeof service.getLogs).toBe('function');
    });
  });

  describe('Performance', () => {
    it('should handle high volume logging efficiently', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const service = module.getService();
      const startTime = Date.now();
      const messageCount = 1000;

      // Log many messages
      for (let i = 0; i < messageCount; i++) {
        service.info(`Performance test message ${i}`, {
          index: i,
          timestamp: new Date().toISOString()
        });
      }

      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time (less than 1 second for 1000 messages)
      expect(duration).toBeLessThan(1000);

      // Wait for writes to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify messages were written
      const logs = await service.getLogs('system.log');
      const perfLogs = logs.filter(log => 
        log.includes('Performance test message')
      );
      
      expect(perfLogs.length).toBe(messageCount);
    });
  });
});