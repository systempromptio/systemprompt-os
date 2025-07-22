/**
 * @fileoverview Unit tests for webhooks module
 * @module tests/unit/modules/core/webhooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhooksModule } from '../../../../../src/modules/core/webhooks/index.js';
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

// Mock dependencies
vi.mock('../../../../../src/modules/core/webhooks/repositories/webhook-repository.js', () => ({
  WebhookRepository: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../../../src/modules/core/webhooks/services/webhook-service.js', () => ({
  WebhookService: vi.fn().mockImplementation(() => ({
    createWebhook: vi.fn(),
    listWebhooks: vi.fn(),
    getWebhook: vi.fn(),
    triggerWebhook: vi.fn().mockResolvedValue(undefined),
    cleanupOldDeliveries: vi.fn()
  }))
}));

vi.mock('../../../../../src/modules/core/webhooks/services/webhook-delivery-service.js', () => ({
  WebhookDeliveryService: vi.fn().mockImplementation(() => ({
    deliver: vi.fn(),
    deliverOnce: vi.fn(),
    cancelAllDeliveries: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Webhooks Module', () => {
  let module: ModuleInterface;
  let mockConfig: any;
  let mockDeps: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock config
    mockConfig = {
      name: 'webhooks',
      type: 'service',
      version: '1.0.0',
      config: {
        defaultTimeout: 30000,
        cleanup: {
          interval: 86400000,
          retentionDays: 30
        }
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

    module = new WebhooksModule();
  });

  describe('Module Lifecycle', () => {
    it('should initialize successfully', async () => {
      const result = await module.initialize(mockConfig, mockDeps);
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Webhooks module initialized');
      expect(mockDeps.database.getAdapter).toHaveBeenCalledWith('webhooks');
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
      vi.useFakeTimers();
      
      await module.initialize(mockConfig, mockDeps);
      const result = await module.start();
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Webhooks module started');
      
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should stop successfully', async () => {
      vi.useFakeTimers();
      
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      const result = await module.stop();
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Webhooks module stopped');
      
      vi.clearAllTimers();
      vi.useRealTimers();
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
    it('should export WebhookService', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      expect(module.exports).toBeDefined();
      expect(module.exports.WebhookService).toBeDefined();
    });

  });

  describe('Module Info', () => {
    it('should return correct module info', () => {
      const info = module.getInfo();
      
      expect(info.name).toBe('webhooks');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toBe('Event-driven webhook notifications');
      expect(info.author).toBe('SystemPrompt OS Team');
    });
  });

  describe('Cleanup Interval', () => {
    it('should start cleanup interval on start', async () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        86400000 // 24 hours
      );
      
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should clear cleanup interval on stop', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      await module.stop();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      vi.clearAllTimers();
      vi.useRealTimers();
    });
  });
});