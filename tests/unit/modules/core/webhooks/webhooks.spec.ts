/**
 * @fileoverview Unit tests for webhooks module
 * @module tests/unit/modules/core/webhooks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebhooksModule, WebhookService, createModule, initialize } from '../../../../../src/modules/core/webhooks/index.js';
import type { IWebhooksModuleExports } from '../../../../../src/modules/core/webhooks/index.js';

// Mock LoggerService completely
vi.mock('../../../../../src/modules/core/logger/services/logger.service.js', () => ({
  LoggerService: {
    getInstance: vi.fn()
  }
}));

// Mock LogSource to prevent import errors
vi.mock('../../../../../src/modules/core/logger/types/index.js', () => ({
  LogSource: {
    SYSTEM: 'SYSTEM'
  }
}));

// Import the mocked dependencies
import { LoggerService } from '../../../../../src/modules/core/logger/services/logger.service.js';
import { LogSource } from '../../../../../src/modules/core/logger/types/index.js';

describe('WebhookService', () => {
  beforeEach(() => {
    // Reset all mocks and clear singleton instance
    vi.clearAllMocks();
    // Reset singleton instance for clean tests
    (WebhookService as any).instance = undefined;
  });

  afterEach(() => {
    // Clean up singleton instance after each test
    (WebhookService as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = WebhookService.getInstance();
      const instance2 = WebhookService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(WebhookService);
    });

    it('should create new instance on first call', () => {
      const instance = WebhookService.getInstance();
      
      expect(instance).toBeInstanceOf(WebhookService);
    });

    it('should maintain singleton pattern after reset', () => {
      const instance1 = WebhookService.getInstance();
      
      // Reset the singleton
      (WebhookService as any).instance = undefined;
      
      const instance2 = WebhookService.getInstance();
      const instance3 = WebhookService.getInstance();
      
      // Should be different from the first instance but same as third
      expect(instance1).not.toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe('initialize method', () => {
    it('should initialize successfully', async () => {
      const service = WebhookService.getInstance();
      
      await expect(service.initialize()).resolves.toBeUndefined();
    });

    it('should handle initialize being called multiple times', async () => {
      const service = WebhookService.getInstance();
      
      await expect(service.initialize()).resolves.toBeUndefined();
      await expect(service.initialize()).resolves.toBeUndefined();
    });
  });
});

describe('WebhooksModule', () => {
  let module: WebhooksModule;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Mock LoggerService.getInstance to return our mock logger
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
    
    module = new WebhooksModule();
  });

  afterEach(() => {
    // Clear all mocks between tests
    vi.clearAllMocks();
  });

  describe('Constructor and Properties', () => {
    it('should initialize with correct default properties', () => {
      expect(module.name).toBe('webhooks');
      expect(module.type).toBe('service');
      expect(module.version).toBe('1.0.0');
      expect(module.description).toBe('Webhook management system');
      expect(module.dependencies).toEqual(['logger', 'database', 'auth']);
      expect(module.status).toBe('stopped');
    });
  });

  describe('exports getter', () => {
    it('should return correct exports interface when not initialized', () => {
      const moduleExports = module.exports;
      
      expect(moduleExports).toBeDefined();
      expect(typeof moduleExports.service).toBe('function');
      
      // Should throw error when trying to get service before initialization
      expect(() => moduleExports.service()).toThrow('Webhooks module not initialized');
    });

    it('should return working service function after initialization', async () => {
      await module.initialize();
      
      const moduleExports = module.exports;
      const service = moduleExports.service();
      
      expect(service).toBeInstanceOf(WebhookService);
    });
  });

  describe('initialize method', () => {
    it('should initialize successfully', async () => {
      await expect(module.initialize()).resolves.toBeUndefined();
      
      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'Webhooks module initialized');
    });

    it('should throw error if already initialized', async () => {
      await module.initialize();
      
      await expect(module.initialize()).rejects.toThrow('Webhooks module already initialized');
    });

    it('should handle WebhookService.initialize() errors', async () => {
      // Mock WebhookService.getInstance to return a service that throws on initialize
      const mockService = {
        initialize: vi.fn().mockRejectedValue(new Error('Service initialization failed'))
      };
      
      vi.spyOn(WebhookService, 'getInstance').mockReturnValue(mockService as any);
      
      await expect(module.initialize()).rejects.toThrow('Failed to initialize webhooks module: Service initialization failed');
    });

    it('should handle non-Error exceptions during initialization', async () => {
      // Mock WebhookService.getInstance to return a service that throws a non-Error
      const mockService = {
        initialize: vi.fn().mockRejectedValue('String error')
      };
      
      vi.spyOn(WebhookService, 'getInstance').mockReturnValue(mockService as any);
      
      await expect(module.initialize()).rejects.toThrow('Failed to initialize webhooks module: String error');
    });
  });

  describe('start method', () => {
    it('should start successfully when initialized', async () => {
      await module.initialize();
      
      await expect(module.start()).resolves.toBeUndefined();
      
      expect(module.status).toBe('running');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'Webhooks module started');
    });

    it('should throw error if not initialized', async () => {
      await expect(module.start()).rejects.toThrow('Webhooks module not initialized');
    });

    it('should throw error if already started', async () => {
      await module.initialize();
      await module.start();
      
      await expect(module.start()).rejects.toThrow('Webhooks module already started');
    });
  });

  describe('stop method', () => {
    it('should stop successfully when started', async () => {
      await module.initialize();
      await module.start();
      
      await expect(module.stop()).resolves.toBeUndefined();
      
      expect(module.status).toBe('stopped');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'Webhooks module stopped');
    });

    it('should do nothing if not started', async () => {
      await module.initialize();
      
      await expect(module.stop()).resolves.toBeUndefined();
      
      expect(module.status).toBe('stopped');
      // Should not log anything if it wasn't started
      expect(mockLogger.info).not.toHaveBeenCalledWith(LogSource.SYSTEM, 'Webhooks module stopped');
    });
  });

  describe('healthCheck method', () => {
    it('should return unhealthy if not initialized', async () => {
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Webhooks module not initialized');
    });

    it('should return unhealthy if initialized but not started', async () => {
      await module.initialize();
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Webhooks module not started');
    });

    it('should return healthy if initialized and started', async () => {
      await module.initialize();
      await module.start();
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Webhooks module is healthy');
    });
  });

  describe('getService method', () => {
    it('should return service when initialized', async () => {
      await module.initialize();
      
      const service = module.getService();
      
      expect(service).toBeInstanceOf(WebhookService);
    });

    it('should throw error if not initialized', () => {
      expect(() => module.getService()).toThrow('Webhooks module not initialized');
    });
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createModule function', () => {
    it('should create a new WebhooksModule instance', () => {
      const module = createModule();
      
      expect(module).toBeInstanceOf(WebhooksModule);
      expect(module.name).toBe('webhooks');
    });
  });

  describe('initialize function', () => {
    it('should create and initialize a WebhooksModule', async () => {
      // Mock logger for this test
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      };
      vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
      
      const module = await initialize();
      
      expect(module).toBeInstanceOf(WebhooksModule);
      expect(module.name).toBe('webhooks');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'Webhooks module initialized');
    });
  });
});