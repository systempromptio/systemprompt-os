/**
 * @fileoverview Unit tests for API module
 * @module tests/unit/modules/core/api
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiModule } from '../../../../../src/modules/core/api/index.js';
import { ModuleInterface } from '../../../../../src/types/module.interface.js';

// Mock the database service to prevent initialization errors
vi.mock('@/modules/core/database/services/database.service.js', () => ({
  DatabaseService: {
    initialize: vi.fn(),
    getInstance: vi.fn().mockReturnValue({
      isInitialized: () => true,
      getConnection: vi.fn()
    })
  }
}));

// Mock the entire module dependencies before importing
vi.mock('../../../../../src/modules/core/api/repositories/api-repository.js', () => ({
  ApiRepository: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../../../src/modules/core/api/services/api-key-service.js', () => ({
  ApiKeyService: vi.fn().mockImplementation(() => ({
    createApiKey: vi.fn(),
    validateApiKey: vi.fn(),
    listApiKeys: vi.fn()
  }))
}));

vi.mock('../../../../../src/modules/core/api/services/rate-limit-service.js', () => ({
  RateLimitService: vi.fn().mockImplementation(() => ({
    checkRateLimit: vi.fn(),
    startCleanup: vi.fn().mockResolvedValue(undefined),
    stopCleanup: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('API Module', () => {
  let module: ModuleInterface;
  let mockConfig: any;
  let mockDeps: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock config
    mockConfig = {
      name: 'api',
      type: 'service',
      version: '1.0.0',
      config: {
        defaultRateLimit: 1000,
        rateLimitWindowSize: 3600000,
        keyPrefix: 'sk_'
      }
    };

    // Mock dependencies
    mockDeps = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      },
      database: {
        getAdapter: vi.fn().mockReturnValue({
          query: vi.fn().mockResolvedValue({ rows: [{ '1': 1 }] }),
          execute: vi.fn().mockResolvedValue({ changes: 0 }),
          select: vi.fn().mockResolvedValue({ rows: [] }),
          insert: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
          update: vi.fn().mockResolvedValue({ changes: 1 }),
          delete: vi.fn().mockResolvedValue({ changes: 1 }),
          close: vi.fn().mockResolvedValue(undefined)
        })
      }
    };

    module = new ApiModule();
  });

  describe('Module Lifecycle', () => {
    it('should initialize successfully', async () => {
      const result = await module.initialize(mockConfig, mockDeps);
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('API module initialized');
      expect(mockDeps.database.getAdapter).toHaveBeenCalledWith('api');
    });

    it('should handle initialization errors', async () => {
      mockDeps.database.getAdapter.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await module.initialize(mockConfig, mockDeps);
      
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    it('should start successfully', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      // Verify services were created
      expect(module.exports.RateLimitService).toBeDefined();
      
      const result = await module.start();
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('API module started');
    });

    it('should stop successfully', async () => {
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      const result = await module.stop();
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('API module stopped');
    });

    it('should perform health check', async () => {
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.checks).toHaveProperty('services');
      expect(health.checks).toHaveProperty('database');
      expect(health.checks.services).toBe(true);
      expect(health.checks.database).toBe(true);
    });

    it('should handle health check errors', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      // Make query fail
      const adapter = mockDeps.database.getAdapter();
      adapter.query.mockRejectedValue(new Error('Database error'));
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.checks.services).toBe(false);
      expect(health.checks.database).toBe(false);
    });
  });

  describe('Module Exports', () => {
    it('should export ApiKeyService', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      expect(module.exports).toBeDefined();
      expect(module.exports.ApiKeyService).toBeDefined();
    });

    it('should export RateLimitService', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      expect(module.exports).toBeDefined();
      expect(module.exports.RateLimitService).toBeDefined();
    });
  });

  describe('Module Info', () => {
    it('should return correct module info', () => {
      // Don't need to initialize for getInfo
      const info = module.getInfo();
      
      expect(info.name).toBe('api');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toBe('API key management and rate limiting');
      expect(info.author).toBe('SystemPrompt OS Team');
    });
  });
});