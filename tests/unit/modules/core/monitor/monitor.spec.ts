/**
 * @fileoverview Unit tests for monitor module
 * @module tests/unit/modules/core/monitor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonitorModule } from '../../../../../src/modules/core/monitor/index.js';
import type { ModuleInterface } from '../../../../../src/types/module.interface.js';

describe('Monitor Module', () => {
  let module: ModuleInterface;
  let mockConfig: any;
  let mockDeps: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock config
    mockConfig = {
      name: 'monitor',
      type: 'daemon',
      version: '1.0.0',
      config: {
        metrics: {
          enabled: true,
          flushInterval: 10000
        },
        alerts: {
          enabled: true,
          evaluationInterval: 60000
        },
        traces: {
          enabled: true,
          sampling: 1.0
        },
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

    module = new MonitorModule();
  });

  describe('Module Lifecycle', () => {
    it('should initialize successfully', async () => {
      const result = await module.initialize(mockConfig, mockDeps);
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Monitor module initialized');
      expect(mockDeps.database.getAdapter).toHaveBeenCalledWith('monitor');
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
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Monitor module started');
      
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should start cleanup interval', async () => {
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

    it('should stop successfully', async () => {
      vi.useFakeTimers();
      
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      const result = await module.stop();
      
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Monitor module stopped');
      
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

    it('should perform health check', async () => {
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.checks).toHaveProperty('database');
      expect(health.checks).toHaveProperty('service');
      expect(health.checks).toHaveProperty('status');
      expect(health.checks.database).toBe(true);
      expect(health.checks.service).toBe(true);
    });

    it('should handle health check errors', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      // Make query fail
      const adapter = mockDeps.database.getAdapter();
      adapter.query.mockRejectedValue(new Error('Database error'));
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.checks.database).toBe(false);
      expect(health.checks.service).toBe(false);
    });
  });

  describe('Module Exports', () => {
    it('should export MonitorService', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      expect(module.exports).toBeDefined();
      expect(module.exports.MonitorService).toBeDefined();
    });
  });

  describe('Module Info', () => {
    it('should return correct module info', () => {
      const info = module.getInfo();
      
      expect(info.name).toBe('monitor');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toBe('System monitoring and observability');
      expect(info.author).toBe('SystemPrompt OS Team');
    });
  });
});