/**
 * @fileoverview Unit tests for metric service
 * @module tests/unit/modules/core/monitor
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetricService } from '../../../../../src/modules/core/monitor/services/metric-service.js';
import type { MonitorRepository } from '../../../../../src/modules/core/monitor/repositories/monitor-repository.js';

describe('MetricService', () => {
  let service: MetricService;
  let mockRepository: jest.Mocked<MonitorRepository>;
  let mockLogger: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock repository
    mockRepository = {
      recordMetric: vi.fn().mockResolvedValue(undefined),
      getMetrics: vi.fn().mockResolvedValue([]),
      getMetricNames: vi.fn().mockResolvedValue([]),
      deleteOldMetrics: vi.fn().mockResolvedValue(undefined)
    } as any;

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Mock config
    mockConfig = {
      metrics: {
        flushInterval: 100, // Short interval for testing
        bufferSize: 10,
        collectSystem: false // Disable system metrics for tests
      }
    };

    service = new MetricService(mockRepository, mockLogger, mockConfig);
  });

  afterEach(() => {
    // Clear all timers
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      vi.useFakeTimers();
      
      await service.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Metric service initialized');
      
      vi.useRealTimers();
    });

    it('should start flush interval', async () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      await service.initialize();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        100 // flushInterval from config
      );
      
      vi.useRealTimers();
    });
  });

  describe('metric recording', () => {
    it('should record metric to buffer', () => {
      service.recordMetric('test.metric', 42, 'gauge', { env: 'test' }, 'ms');
      
      // Check that metric was buffered (not immediately recorded)
      expect(mockRepository.recordMetric).not.toHaveBeenCalled();
    });

    it('should emit metric:recorded event', () => {
      const listener = vi.fn();
      service.on('metric:recorded', listener);
      
      service.recordMetric('test.metric', 42);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test.metric',
          value: 42
        })
      );
    });

    it('should auto-flush when buffer is full', async () => {
      // Fill buffer beyond limit
      for (let i = 0; i < 11; i++) {
        service.recordMetric('test.metric', i);
      }
      
      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockRepository.recordMetric).toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    it('should increment counter', () => {
      const listener = vi.fn();
      service.on('metric:recorded', listener);
      
      service.incrementCounter('test.counter', { type: 'api' }, 5);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test.counter',
          value: 5,
          type: 'counter',
          labels: { type: 'api' }
        })
      );
    });

    it('should set gauge', () => {
      const listener = vi.fn();
      service.on('metric:recorded', listener);
      
      service.setGauge('test.gauge', 100, { queue: 'email' }, '%');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test.gauge',
          value: 100,
          type: 'gauge',
          labels: { queue: 'email' },
          unit: '%'
        })
      );
    });

    it('should record histogram', () => {
      const listener = vi.fn();
      service.on('metric:recorded', listener);
      
      service.recordHistogram('test.histogram', 250, { endpoint: '/api' }, 'ms');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test.histogram',
          value: 250,
          type: 'histogram',
          labels: { endpoint: '/api' },
          unit: 'ms'
        })
      );
    });
  });

  describe('querying', () => {
    it('should query metrics from repository', async () => {
      const mockData = [
        { timestamp: new Date(), value: 10 },
        { timestamp: new Date(), value: 20 }
      ];
      mockRepository.getMetrics.mockResolvedValue(mockData);
      
      const result = await service.queryMetrics({
        metric: 'test.metric',
        start_time: new Date()
      });
      
      expect(result).toEqual({
        metric: 'test.metric',
        data: mockData,
        labels: {}
      });
      expect(mockRepository.getMetrics).toHaveBeenCalled();
    });

    it('should get metric names', async () => {
      const mockNames = ['metric1', 'metric2', 'metric3'];
      mockRepository.getMetricNames.mockResolvedValue(mockNames);
      
      const names = await service.getMetricNames();
      
      expect(names).toEqual(mockNames);
      expect(mockRepository.getMetricNames).toHaveBeenCalled();
    });
  });

  describe('system metrics', () => {
    it('should get system metrics', async () => {
      const metrics = await service.getSystemMetrics();
      
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('network');
      expect(metrics).toHaveProperty('uptime');
      
      expect(metrics.cpu.cores).toBeGreaterThan(0);
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup old metrics', async () => {
      await service.cleanupOldMetrics(30);
      
      expect(mockRepository.deleteOldMetrics).toHaveBeenCalledWith(30);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up old metrics', { retentionDays: 30 });
    });

    it('should handle cleanup errors', async () => {
      mockRepository.deleteOldMetrics.mockRejectedValue(new Error('Cleanup failed'));
      
      await expect(service.cleanupOldMetrics(30)).rejects.toThrow('Cleanup failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should flush metrics on shutdown', async () => {
      vi.useFakeTimers();
      
      await service.initialize();
      
      // Add some metrics
      service.recordMetric('test.metric', 1);
      service.recordMetric('test.metric', 2);
      
      await service.shutdown();
      
      // Should have flushed metrics
      expect(mockRepository.recordMetric).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should clear intervals on shutdown', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      await service.initialize();
      await service.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('flush behavior', () => {
    it('should flush metrics periodically', async () => {
      vi.useFakeTimers();
      
      await service.initialize();
      
      // Add metrics
      service.recordMetric('test.metric', 1);
      service.recordMetric('test.metric', 2);
      
      // Stop the service to prevent infinite timers
      await service.shutdown();
      
      expect(mockRepository.recordMetric).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should emit metrics:flushed event', async () => {
      vi.useFakeTimers();
      const listener = vi.fn();
      service.on('metrics:flushed', listener);
      
      await service.initialize();
      
      // Add metrics
      service.recordMetric('test.metric', 1);
      
      // Manually trigger flush by advancing time
      vi.advanceTimersByTime(100);
      
      // Wait for the flush to complete
      await new Promise(resolve => process.nextTick(resolve));
      
      expect(listener).toHaveBeenCalledWith(1);
      
      await service.shutdown();
      vi.useRealTimers();
    });
  });
});