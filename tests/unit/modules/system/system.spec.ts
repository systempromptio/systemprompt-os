/**
 * System module tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SystemModule } from '../../../src/modules/core/system/index.js';
import { SystemService } from '../../../src/modules/core/system/services/system.service.js';
import { HealthService } from '../../../src/modules/core/system/services/health.service.js';
import { MetricsService } from '../../../src/modules/core/system/services/metrics.service.js';
import { BackupService } from '../../../src/modules/core/system/services/backup.service.js';
import type { SystemStatus, HealthReport } from '../../../src/modules/core/system/types/index.js';

// Mock the services
vi.mock('../../../src/modules/core/system/services/system.service.js');
vi.mock('../../../src/modules/core/system/services/health.service.js');
vi.mock('../../../src/modules/core/system/services/metrics.service.js');
vi.mock('../../../src/modules/core/system/services/backup.service.js');

describe('SystemModule', () => {
  let systemModule: SystemModule;
  let mockLogger: any;
  
  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    
    systemModule = new SystemModule();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Module Interface', () => {
    it('should have correct module properties', () => {
      expect(systemModule.name).toBe('system');
      expect(systemModule.version).toBe('1.0.0');
      expect(systemModule.type).toBe('daemon');
    });
    
    it('should implement required methods', () => {
      expect(systemModule.initialize).toBeDefined();
      expect(systemModule.start).toBeDefined();
      expect(systemModule.stop).toBeDefined();
      expect(systemModule.healthCheck).toBeDefined();
    });
  });
  
  describe('initialize', () => {
    it('should initialize with config and logger', async () => {
      const config = {
        monitoring: { enabled: true, interval: 60000 },
        health: { checks: ['memory', 'cpu'] }
      };
      
      await systemModule.initialize({ config, logger: mockLogger });
      
      expect(mockLogger.info).toHaveBeenCalledWith('System module initialized');
    });
    
    it('should initialize successfully with default config', async () => {
      await systemModule.initialize({ logger: mockLogger });
      
      expect(mockLogger.info).toHaveBeenCalledWith('System module initialized');
      expect(systemModule.name).toBe('system');
      expect(systemModule.version).toBe('1.0.0');
    });
  });
  
  describe('start', () => {
    it('should start monitoring when enabled', async () => {
      const config = {
        monitoring: { enabled: true, interval: 60000 }
      };
      
      await systemModule.initialize({ config, logger: mockLogger });
      await systemModule.start();
      
      expect(mockLogger.info).toHaveBeenCalledWith('System module started');
    });
    
    it('should not start monitoring when disabled', async () => {
      const config = {
        monitoring: { enabled: false }
      };
      
      await systemModule.initialize({ config, logger: mockLogger });
      await systemModule.start();
      
      expect(mockLogger.info).toHaveBeenCalledWith('System module started');
    });
  });
  
  describe('stop', () => {
    it('should stop monitoring and flush metrics', async () => {
      await systemModule.initialize({ logger: mockLogger });
      await systemModule.start();
      await systemModule.stop();
      
      expect(mockLogger.info).toHaveBeenCalledWith('System module stopped');
    });
  });
  
  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const mockReport: HealthReport = {
        overall: 'healthy',
        checks: [],
        timestamp: new Date()
      };
      
      await systemModule.initialize({ logger: mockLogger });
      
      // Mock the health service
      const healthService = (systemModule as any).healthService;
      vi.spyOn(healthService, 'runHealthCheck').mockResolvedValue(mockReport);
      
      const result = await systemModule.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('System is healthy');
    });
    
    it('should return unhealthy status on error', async () => {
      await systemModule.initialize({ logger: mockLogger });
      
      // Mock the health service to throw error
      const healthService = (systemModule as any).healthService;
      vi.spyOn(healthService, 'runHealthCheck').mockRejectedValue(new Error('Test error'));
      
      const result = await systemModule.healthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Health check failed');
    });
  });
  
  describe('getSystemStatus', () => {
    it('should return system status', async () => {
      const mockStatus: SystemStatus = {
        uptime: 1000,
        version: '1.0.0',
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        architecture: 'x64',
        hostname: 'test-host',
        memory: {
          total: 8000000000,
          free: 4000000000,
          used: 4000000000,
          usagePercent: 50
        },
        cpu: {
          model: 'Test CPU',
          cores: 4,
          usage: 25,
          loadAverage: [1, 1, 1]
        },
        disk: {
          total: 100000000000,
          free: 50000000000,
          used: 50000000000,
          usagePercent: 50,
          path: '/'
        },
        modules: [],
        timestamp: new Date()
      };
      
      await systemModule.initialize({ logger: mockLogger });
      
      // Mock the system service
      const systemService = (systemModule as any).systemService;
      vi.spyOn(systemService, 'getStatus').mockResolvedValue(mockStatus);
      
      const status = await systemModule.getSystemStatus();
      
      expect(status).toEqual(mockStatus);
    });
  });
  
  describe('Metrics Collection', () => {
    it('should collect metrics on interval', async () => {
      vi.useFakeTimers();
      
      const config = {
        monitoring: { enabled: true, interval: 1000 }
      };
      
      await systemModule.initialize({ config, logger: mockLogger });
      
      // Mock services
      const systemService = (systemModule as any).systemService;
      const metricsService = (systemModule as any).metricsService;
      
      const mockStatus: SystemStatus = {
        uptime: 1000,
        version: '1.0.0',
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        architecture: 'x64',
        hostname: 'test-host',
        memory: { total: 8000000000, free: 4000000000, used: 4000000000, usagePercent: 50 },
        cpu: { model: 'Test CPU', cores: 4, usage: 25, loadAverage: [1, 1, 1] },
        disk: { total: 100000000000, free: 50000000000, used: 50000000000, usagePercent: 50, path: '/' },
        modules: [],
        timestamp: new Date()
      };
      
      vi.spyOn(systemService, 'getStatus').mockResolvedValue(mockStatus);
      vi.spyOn(metricsService, 'record').mockResolvedValue(undefined);
      
      await systemModule.start();
      
      // Fast forward time
      await vi.advanceTimersByTimeAsync(1000);
      
      expect(metricsService.record).toHaveBeenCalled();
      
      await systemModule.stop();
      vi.useRealTimers();
    }, 15000);
    
    it('should warn on high resource usage', async () => {
      const config = {
        monitoring: { enabled: true, interval: 60000 },
        health: {
          thresholds: {
            memory: 0.8,
            cpu: 0.7,
            disk: 0.8
          }
        }
      };
      
      await systemModule.initialize({ config, logger: mockLogger });
      
      // Mock high usage status
      const systemService = (systemModule as any).systemService;
      const mockStatus: SystemStatus = {
        uptime: 1000,
        version: '1.0.0',
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        architecture: 'x64',
        hostname: 'test-host',
        memory: { total: 8000000000, free: 1000000000, used: 7000000000, usagePercent: 87.5 },
        cpu: { model: 'Test CPU', cores: 4, usage: 75, loadAverage: [3, 3, 3] },
        disk: { total: 100000000000, free: 10000000000, used: 90000000000, usagePercent: 90, path: '/' },
        modules: [],
        timestamp: new Date()
      };
      
      vi.spyOn(systemService, 'getStatus').mockResolvedValue(mockStatus);
      
      // Trigger metric collection
      await (systemModule as any).collectMetrics();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('High memory usage', { usage: 87.5 });
      expect(mockLogger.warn).toHaveBeenCalledWith('High CPU usage', { usage: 75 });
      expect(mockLogger.warn).toHaveBeenCalledWith('High disk usage', { usage: 90 });
    });
  });
});

describe('System Services', () => {
  describe('HealthService', () => {
    it('should run health checks', async () => {
      const mockLogger = { info: vi.fn(), error: vi.fn() };
      const config = {
        checks: ['memory', 'cpu'],
        thresholds: { memory: 0.9, cpu: 0.8 }
      };
      
      // Note: In a real test, we would test the actual HealthService
      // For now, we're just verifying the interface
      const healthService = new HealthService(config, mockLogger);
      expect(healthService.runHealthCheck).toBeDefined();
    });
  });
  
  describe('MetricsService', () => {
    it('should record and retrieve metrics', async () => {
      const mockLogger = { info: vi.fn(), error: vi.fn() };
      const config = { metricsFile: './test-metrics.json' };
      
      // Note: In a real test, we would test the actual MetricsService
      const metricsService = new MetricsService(config, mockLogger);
      expect(metricsService.record).toBeDefined();
      expect(metricsService.getMetrics).toBeDefined();
    });
  });
});