/**
 * @fileoverview Unit tests for MetricService
 * @module tests/unit/modules/core/monitor/metric-service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetricService } from '../../../../../src/modules/core/monitor/services/metric-service.js';
import type { MonitorRepository } from '../../../../../src/modules/core/monitor/repositories/monitor-repository.js';

describe('MetricService', () => {
  let service: MetricService;
  let mockRepository: MonitorRepository;
  let mockLogger: any;
  let mockConfig: any;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      recordMetric: vi.fn().mockResolvedValue(undefined),
      getMetrics: vi.fn().mockResolvedValue([]),
      getMetricNames: vi.fn().mockResolvedValue(['cpu_usage', 'memory_usage']),
      deleteOldMetrics: vi.fn().mockResolvedValue(undefined)
    };

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
        flushInterval: 1000,
        bufferSize: 10,
        collectSystem: true
      }
    };

    service = new MetricService(mockRepository, mockLogger, mockConfig);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      await service.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Metric service initialized');
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        mockConfig.metrics.flushInterval
      );

      vi.clearAllTimers();
    });
  });

  describe('Metric Recording', () => {
    it('should record a metric with default parameters', () => {
      const metricSpy = vi.fn();
      service.on('metric:recorded', metricSpy);

      service.recordMetric('test_metric', 100);

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test_metric',
          value: 100,
          type: 'gauge',
          labels: {},
          timestamp: expect.any(Date)
        })
      );
    });

    it('should record a metric with custom parameters', () => {
      const metricSpy = vi.fn();
      service.on('metric:recorded', metricSpy);

      service.recordMetric('custom_metric', 50, 'counter', { env: 'test' }, 'requests');

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'custom_metric',
          value: 50,
          type: 'counter',
          labels: { env: 'test' },
          unit: 'requests',
          timestamp: expect.any(Date)
        })
      );
    });

    it('should auto-flush when buffer size is reached', async () => {
      vi.useFakeTimers();
      
      // Fill buffer to capacity
      for (let i = 0; i < mockConfig.metrics.bufferSize; i++) {
        service.recordMetric(`metric_${i}`, i);
      }

      // Wait for async flush to complete
      await vi.runAllTimersAsync();

      expect(mockRepository.recordMetric).toHaveBeenCalledTimes(mockConfig.metrics.bufferSize);
    });

    it('should handle auto-flush errors gracefully', async () => {
      vi.useFakeTimers();
      mockRepository.recordMetric.mockRejectedValue(new Error('Flush failed'));

      // Fill buffer to trigger auto-flush
      for (let i = 0; i < mockConfig.metrics.bufferSize; i++) {
        service.recordMetric(`metric_${i}`, i);
      }

      // Wait for async operations
      await vi.runAllTimersAsync();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to auto-flush metrics',
        expect.objectContaining({ error: 'Flush failed' })
      );
    });
  });

  describe('Counter Metrics', () => {
    it('should increment counter with default value', () => {
      const metricSpy = vi.fn();
      service.on('metric:recorded', metricSpy);

      service.incrementCounter('requests_total');

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'requests_total',
          value: 1,
          type: 'counter'
        })
      );
    });

    it('should increment counter with custom value and labels', () => {
      const metricSpy = vi.fn();
      service.on('metric:recorded', metricSpy);

      service.incrementCounter('requests_total', { method: 'GET' }, 5);

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'requests_total',
          value: 5,
          type: 'counter',
          labels: { method: 'GET' }
        })
      );
    });
  });

  describe('Gauge Metrics', () => {
    it('should set gauge value', () => {
      const metricSpy = vi.fn();
      service.on('metric:recorded', metricSpy);

      service.setGauge('temperature', 23.5, { location: 'server_room' }, 'celsius');

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'temperature',
          value: 23.5,
          type: 'gauge',
          labels: { location: 'server_room' },
          unit: 'celsius'
        })
      );
    });
  });

  describe('Histogram Metrics', () => {
    it('should record histogram value', () => {
      const metricSpy = vi.fn();
      service.on('metric:recorded', metricSpy);

      service.recordHistogram('response_time', 150, { endpoint: '/api/users' }, 'ms');

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'response_time',
          value: 150,
          type: 'histogram',
          labels: { endpoint: '/api/users' },
          unit: 'ms'
        })
      );
    });
  });

  describe('Metric Querying', () => {
    it('should query metrics from repository', async () => {
      const mockData = [
        { name: 'cpu_usage', value: 75, timestamp: new Date() }
      ];
      mockRepository.getMetrics.mockResolvedValue(mockData);

      const query = {
        metric: 'cpu_usage',
        start_time: new Date('2023-01-01'),
        end_time: new Date('2023-01-02'),
        labels: { host: 'server1' }
      };

      const result = await service.queryMetrics(query);

      expect(mockRepository.getMetrics).toHaveBeenCalledWith(query);
      expect(result).toEqual({
        metric: 'cpu_usage',
        data: mockData,
        labels: { host: 'server1' }
      });
    });

    it('should get metric names', async () => {
      const result = await service.getMetricNames();

      expect(mockRepository.getMetricNames).toHaveBeenCalled();
      expect(result).toEqual(['cpu_usage', 'memory_usage']);
    });
  });

  describe('System Metrics', () => {
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

  describe('Cleanup Operations', () => {
    it('should cleanup old metrics successfully', async () => {
      await service.cleanupOldMetrics(30);

      expect(mockRepository.deleteOldMetrics).toHaveBeenCalledWith(30);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up old metrics',
        { retentionDays: 30 }
      );
    });

    it('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      mockRepository.deleteOldMetrics.mockRejectedValue(error);

      await expect(service.cleanupOldMetrics(30)).rejects.toThrow('Cleanup failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup old metrics',
        { error: 'Cleanup failed', retentionDays: 30 }
      );
    });
  });

  describe('Flush Operations', () => {
    it('should flush metrics to repository', async () => {
      vi.useFakeTimers();
      const flushSpy = vi.fn();
      service.on('metrics:flushed', flushSpy);

      // Add some metrics to buffer
      service.recordMetric('metric1', 10);
      service.recordMetric('metric2', 20);

      // Manually trigger flush
      await service.shutdown();

      expect(mockRepository.recordMetric).toHaveBeenCalledTimes(2);
      expect(flushSpy).toHaveBeenCalledWith(2);
    });

    it('should handle flush errors and restore buffer', async () => {
      vi.useFakeTimers();
      mockRepository.recordMetric.mockRejectedValue(new Error('Repository error'));

      // Add metrics to buffer
      service.recordMetric('metric1', 10);
      service.recordMetric('metric2', 20);

      // Attempt flush - should handle error gracefully
      await expect(service.shutdown()).rejects.toThrow('Repository error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to flush metrics',
        expect.objectContaining({
          error: 'Repository error',
          count: 2
        })
      );
    });

    it('should not flush empty buffer', async () => {
      vi.useFakeTimers();
      
      // Call flush without adding any metrics
      await service.shutdown();

      expect(mockRepository.recordMetric).not.toHaveBeenCalled();
    });
  });

  describe('Periodic Flush', () => {
    it('should set up periodic flush timer', async () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      await service.initialize();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        mockConfig.metrics.flushInterval
      );

      vi.clearAllTimers();
    });

    it('should flush metrics periodically', async () => {
      vi.useFakeTimers();

      await service.initialize();

      // Add a metric
      service.recordMetric('periodic_metric', 42);

      // Advance time to trigger periodic flush
      vi.advanceTimersByTime(mockConfig.metrics.flushInterval);
      await vi.runOnlyPendingTimersAsync();

      expect(mockRepository.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'periodic_metric',
          value: 42
        })
      );

      vi.clearAllTimers();
    });
  });

  describe('Shutdown', () => {
    it('should clear flush timer and flush remaining metrics', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      await service.initialize();
      
      // Add a metric
      service.recordMetric('shutdown_metric', 100);

      await service.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(mockRepository.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'shutdown_metric',
          value: 100
        })
      );

      vi.clearAllTimers();
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      vi.useFakeTimers();

      await service.initialize();
      await service.shutdown();
      await service.shutdown(); // Second call should not throw

      expect(mockRepository.recordMetric).toHaveBeenCalledTimes(0);

      vi.clearAllTimers();
    });
  });
});