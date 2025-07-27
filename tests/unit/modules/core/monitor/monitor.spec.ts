/**
 * @fileoverview Unit tests for monitor module
 * @module tests/unit/modules/core/monitor
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { MonitorModule, isMonitorModule } from '../../../../../src/modules/core/monitor/index.js';
import { ModuleStatusEnum } from '../../../../../src/modules/core/modules/types/index.js';
import { MetricService } from '../../../../../src/modules/core/monitor/services/metric.service.js';
import type { IModule } from '../../../../../src/modules/core/modules/types/index.js';
import type { IMonitorModuleExports } from '../../../../../src/modules/core/monitor/monitor-module.js';

describe('Monitor Module', () => {
  let module: MonitorModule;
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

    it('should handle health check when not initialized', async () => {
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.checks.database).toBe(false);
      expect(health.checks.service).toBe(false);
      expect(health.checks.status).toBe('not_initialized');
    });

    it('should handle unexpected errors in health check', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      // To trigger the outer catch block, we need to mock something that throws outside the inner try-catch
      // Let's mock the this.started property access to throw
      const originalStarted = Object.getOwnPropertyDescriptor(module, 'started');
      Object.defineProperty(module, 'started', {
        get: () => {
          throw new Error('Unexpected error accessing started property');
        },
        configurable: true
      });
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.checks.database).toBe(false);
      expect(health.checks.service).toBe(false);
      expect(health.checks.status).toBe('error');
      
      // Restore original property
      if (originalStarted) {
        Object.defineProperty(module, 'started', originalStarted);
      }
    });

    it('should show running status when started', async () => {
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      
      const health = await module.healthCheck();
      
      expect(health.checks.status).toBe('running');
    });

    it('should show stopped status when not started', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      const health = await module.healthCheck();
      
      expect(health.checks.status).toBe('stopped');
    });

    it('should handle start error when not initialized', async () => {
      // Create new module instance to ensure clean state
      const uninitializedModule = new MonitorModule();
      const result = await uninitializedModule.start();
      
      expect(result).toBe(false);
    });

    it('should handle stop error', async () => {
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      
      // Mock the metric service shutdown to throw an error
      const metricService = module.exports.MonitorService;
      const originalShutdown = metricService.shutdown;
      metricService.shutdown = vi.fn().mockRejectedValue(new Error('Shutdown failed'));
      
      const result = await module.stop();
      
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        'Failed to stop Monitor module',
        expect.any(Error)
      );
      
      // Restore original method
      metricService.shutdown = originalShutdown;
    });
  });

  describe('Module Exports', () => {
    it('should export MonitorService', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      expect(module.exports).toBeDefined();
      expect(module.exports.MonitorService).toBeDefined();
    });
  });

  describe('Periodic Cleanup', () => {
    it('should perform periodic cleanup during interval', async () => {
      vi.useFakeTimers();
      const cleanupSpy = vi.fn().mockResolvedValue(undefined);
      
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      
      // Spy on the metric service cleanup method
      const metricService = module.exports.MonitorService;
      metricService.cleanupOldMetrics = cleanupSpy;
      
      // Advance timer to trigger cleanup interval
      vi.advanceTimersByTime(mockConfig.config.cleanup.interval);
      
      // Allow async operations to complete
      await vi.runOnlyPendingTimersAsync();
      
      expect(cleanupSpy).toHaveBeenCalledWith(mockConfig.config.cleanup.retentionDays);
      
      await module.stop();
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.useFakeTimers();
      const cleanupError = new Error('Cleanup failed');
      const cleanupSpy = vi.fn().mockRejectedValue(cleanupError);
      
      await module.initialize(mockConfig, mockDeps);
      await module.start();
      
      // Spy on the metric service cleanup method to throw error
      const metricService = module.exports.MonitorService;
      metricService.cleanupOldMetrics = cleanupSpy;
      
      // Advance timer to trigger cleanup interval
      vi.advanceTimersByTime(mockConfig.config.cleanup.interval);
      
      // Allow async operations to complete
      await vi.runOnlyPendingTimersAsync();
      
      expect(cleanupSpy).toHaveBeenCalledWith(mockConfig.config.cleanup.retentionDays);
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        'Failed to perform cleanup',
        cleanupError
      );
      
      await module.stop();
      vi.clearAllTimers();
      vi.useRealTimers();
    });
  });

  describe('Metric Service Integration', () => {
    it('should initialize metric service with correct config', async () => {
      await module.initialize(mockConfig, mockDeps);
      
      const metricService = module.exports.MonitorService;
      expect(metricService).toBeDefined();
      
      // Verify metric service was initialized by calling a method
      await module.start();
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Metric service initialized');
    });

    it('should handle metric service initialization errors', async () => {
      // This is tricky to test without dependency injection, so we'll test the error handling path
      // by making database adapter fail during initialization
      mockDeps.database.getAdapter.mockImplementation(() => {
        throw new Error('Database adapter failed');
      });
      
      const result = await module.initialize(mockConfig, mockDeps);
      
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        'Failed to initialize Monitor module',
        expect.any(Error)
      );
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

  describe('Module Properties', () => {
    it('should have correct static properties', () => {
      expect(module.name).toBe('monitor');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('daemon');
      expect(module.status).toBe(ModuleStatusEnum.PENDING);
    });

    it('should extend EventEmitter', () => {
      expect(module).toBeInstanceOf(EventEmitter);
    });
  });
});