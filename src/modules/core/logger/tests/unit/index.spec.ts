/**
 * @fileoverview Unit tests for LoggerModule
 * @module modules/core/logger/tests/unit
 */

import { LoggerModule } from '@/modules/core/logger';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { ModuleContext } from '@/modules/types';
import { LoggerConfig } from '@/modules/core/logger/types';
import { LoggerInitializationError } from '@/modules/core/logger/utils/errors';

// Mock the LoggerService
jest.mock('@/modules/core/logger/services/logger.service');

describe('LoggerModule', () => {
  let module: LoggerModule;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockContext: ModuleContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock logger service
    mockLoggerService = {
      initialize: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      addLog: jest.fn(),
      clearLogs: jest.fn(),
      getLogs: jest.fn(),
      access: jest.fn()
    } as any;

    // Mock the getInstance method
    (LoggerService.getInstance as jest.Mock).mockReturnValue(mockLoggerService);

    // Create module instance
    module = new LoggerModule();

    // Setup mock context
    mockContext = {
      config: {
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
      } as LoggerConfig
    };
  });

  describe('module properties', () => {
    it('should have correct module metadata', () => {
      expect(module.name).toBe('logger');
      expect(module.type).toBe('core');
      expect(module.version).toBe('1.0.0');
      expect(module.description).toBe('System-wide logging service with file and console output');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(module.initialize(mockContext)).resolves.not.toThrow();
      
      expect(mockLoggerService.initialize).toHaveBeenCalledWith(mockContext.config);
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Logger module initialized successfully',
        expect.objectContaining({
          version: '1.0.0',
          logLevel: 'info',
          outputs: ['console', 'file']
        })
      );
    });

    it('should throw error if already initialized', async () => {
      await module.initialize(mockContext);
      
      await expect(module.initialize(mockContext))
        .rejects.toThrow(LoggerInitializationError);
    });

    it('should throw error if config is missing', async () => {
      const emptyContext: ModuleContext = {};
      
      await expect(module.initialize(emptyContext))
        .rejects.toThrow('Logger configuration is required');
    });

    it('should handle initialization errors from logger service', async () => {
      const error = new Error('Service init failed');
      mockLoggerService.initialize.mockRejectedValue(error);
      
      await expect(module.initialize(mockContext))
        .rejects.toThrow(LoggerInitializationError);
    });

    it('should rethrow LoggerInitializationError as-is', async () => {
      const error = new LoggerInitializationError('Custom error');
      mockLoggerService.initialize.mockRejectedValue(error);
      
      await expect(module.initialize(mockContext))
        .rejects.toThrow(error);
    });
  });

  describe('start', () => {
    it('should start successfully when initialized', async () => {
      await module.initialize(mockContext);
      
      await expect(module.start()).resolves.not.toThrow();
      expect(mockLoggerService.info).toHaveBeenCalledWith('Logger module started');
    });

    it('should throw error if not initialized', async () => {
      await expect(module.start())
        .rejects.toThrow('Logger module not initialized');
    });

    it('should throw error if already started', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      await expect(module.start())
        .rejects.toThrow('Logger module already started');
    });
  });

  describe('stop', () => {
    it('should stop successfully when started', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      await expect(module.stop()).resolves.not.toThrow();
      expect(mockLoggerService.info).toHaveBeenCalledWith('Logger module stopping');
    });

    it('should do nothing if not started', async () => {
      await expect(module.stop()).resolves.not.toThrow();
      expect(mockLoggerService.info).not.toHaveBeenCalled();
    });

    it('should allow stopping multiple times', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      await module.stop();
      await module.stop();
      
      expect(mockLoggerService.info).toHaveBeenCalledTimes(2); // init + start only
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when initialized and started', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      const result = await module.healthCheck();
      
      expect(result).toEqual({
        healthy: true,
        message: 'Logger module is healthy'
      });
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Health check test log');
    });

    it('should return unhealthy if not initialized', async () => {
      const result = await module.healthCheck();
      
      expect(result).toEqual({
        healthy: false,
        message: 'Logger module not initialized'
      });
    });

    it('should return unhealthy if not started', async () => {
      await module.initialize(mockContext);
      
      const result = await module.healthCheck();
      
      expect(result).toEqual({
        healthy: false,
        message: 'Logger module not started'
      });
    });

    it('should handle errors during health check', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      mockLoggerService.debug.mockImplementation(() => {
        throw new Error('Log write failed');
      });
      
      const result = await module.healthCheck();
      
      expect(result).toEqual({
        healthy: false,
        message: 'Logger health check failed: Log write failed'
      });
    });

    it('should handle non-Error objects in catch', async () => {
      await module.initialize(mockContext);
      await module.start();
      
      mockLoggerService.debug.mockImplementation(() => {
        throw 'String error';
      });
      
      const result = await module.healthCheck();
      
      expect(result).toEqual({
        healthy: false,
        message: 'Logger health check failed: Unknown error'
      });
    });
  });

  describe('getService', () => {
    it('should return logger service when initialized', async () => {
      await module.initialize(mockContext);
      
      const service = module.getService();
      
      expect(service).toBe(mockLoggerService);
    });

    it('should throw error if not initialized', () => {
      expect(() => module.getService())
        .toThrow('Logger module not initialized');
    });
  });

  describe('exports', () => {
    it('should export service and types when initialized', async () => {
      await module.initialize(mockContext);
      
      const exports = module.exports;
      
      expect(exports).toHaveProperty('service');
      expect(exports).toHaveProperty('LoggerService');
      expect(exports).toHaveProperty('types');
      expect(exports.service).toBe(mockLoggerService);
      expect(exports.LoggerService).toBe(LoggerService);
    });

    it('should throw error when accessing service export if not initialized', () => {
      expect(() => module.exports.service)
        .toThrow('Logger module not initialized');
    });
  });

  describe('createModule', () => {
    it('should create a new module instance', () => {
      const { createModule } = require('@/modules/core/logger');
      const config = mockContext.config as LoggerConfig;
      
      const newModule = createModule(config);
      
      expect(newModule).toBeInstanceOf(LoggerModule);
      expect(newModule).not.toBe(module);
    });
  });

  describe('default export', () => {
    it('should export a default module instance', () => {
      const defaultExport = require('@/modules/core/logger').default;
      
      expect(defaultExport).toBeInstanceOf(LoggerModule);
    });
  });
});