/**
 * @fileoverview Unit tests for Scheduler module
 * @module tests/unit/modules/core/scheduler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchedulerModule } from '../../../../../src/modules/core/scheduler/index.js';
import { SchedulerService } from '../../../../../src/modules/core/scheduler/services/scheduler-service.js';
import { SchedulerRepository } from '../../../../../src/modules/core/scheduler/repositories/scheduler-repository.js';
import { CronEngine } from '../../../../../src/modules/core/scheduler/services/cron-engine.js';

// Mock dependencies
vi.mock('../../../../../src/modules/core/database/adapters/module-adapter.js', () => ({
  createModuleAdapter: vi.fn().mockResolvedValue({
    query: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn()
  })
}));

vi.mock('../../../../../src/modules/core/scheduler/services/scheduler-service.js');
vi.mock('../../../../../src/modules/core/scheduler/repositories/scheduler-repository.js');
vi.mock('../../../../../src/modules/core/scheduler/services/cron-engine.js');

describe('SchedulerModule', () => {
  let module: SchedulerModule;
  let mockLogger: any;
  let mockDatabase: any;
  let mockSchedulerService: any;
  let mockSchedulerRepository: any;
  let mockCronEngine: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    mockDatabase = {
      query: vi.fn().mockResolvedValue([{ '1': 1 }]),
      execute: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn()
    };

    mockCronEngine = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockReturnValue(true)
    };

    mockSchedulerService = {
      loadScheduledTasks: vi.fn().mockResolvedValue(undefined),
      stopAllTasks: vi.fn().mockResolvedValue(undefined)
    };

    mockSchedulerRepository = {};

    vi.mocked(SchedulerService).mockImplementation(() => mockSchedulerService);
    vi.mocked(SchedulerRepository).mockImplementation(() => mockSchedulerRepository);
    vi.mocked(CronEngine).mockImplementation(() => mockCronEngine);

    module = new SchedulerModule();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('module properties', () => {
    it('should have correct module metadata', () => {
      expect(module.name).toBe('scheduler');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('daemon');
      expect(module.dependencies).toEqual(['database', 'logger']);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with default config', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);

      await module.initialize({ logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith('Scheduler module initialized', { module: 'scheduler' });
      expect(SchedulerRepository).toHaveBeenCalledWith(mockDatabase);
      expect(CronEngine).toHaveBeenCalledWith(mockSchedulerRepository, mockLogger);
      expect(SchedulerService).toHaveBeenCalledWith(mockSchedulerRepository, mockCronEngine, mockLogger);
    });

    it('should initialize with custom config', async () => {
      const customConfig = { maxConcurrentTasks: 200 };
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);

      await module.initialize({ config: customConfig, logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith('Scheduler module initialized', { module: 'scheduler' });
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database connection failed');
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockRejectedValue(error);

      await expect(module.initialize({ logger: mockLogger })).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize scheduler module', { error });
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });
    });

    it('should start successfully', async () => {
      await module.start();

      expect(mockCronEngine.start).toHaveBeenCalled();
      expect(mockSchedulerService.loadScheduledTasks).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduler module started', { module: 'scheduler' });
    });

    it('should handle start errors', async () => {
      const error = new Error('Failed to start engine');
      mockCronEngine.start.mockRejectedValue(error);

      await expect(module.start()).rejects.toThrow('Failed to start engine');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start scheduler module', { error });
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });
      await module.start();
    });

    it('should stop successfully', async () => {
      await module.stop();

      expect(mockSchedulerService.stopAllTasks).toHaveBeenCalled();
      expect(mockCronEngine.stop).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduler module stopped', { module: 'scheduler' });
    });

    it('should handle stop errors gracefully', async () => {
      const error = new Error('Failed to stop tasks');
      mockSchedulerService.stopAllTasks.mockRejectedValue(error);

      await module.stop(); // Should not throw

      expect(mockLogger.error).toHaveBeenCalledWith('Error stopping scheduler module', { error });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when all checks pass', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Scheduler module is healthy'
      });
    });

    it('should return unhealthy when database check fails', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });
      
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Health check error: Database error'
      });
    });

    it('should return unhealthy when engine is not healthy', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });
      
      mockCronEngine.isHealthy.mockReturnValue(false);

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Scheduler module health check failed'
      });
    });

    it('should handle health check without initialization', async () => {
      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Scheduler module health check failed'
      });
    });
  });

  describe('exports', () => {
    it('should export SchedulerService, SchedulerRepository, and CronEngine', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });

      const exports = module.exports;

      expect(exports).toHaveProperty('SchedulerService');
      expect(exports).toHaveProperty('SchedulerRepository');
      expect(exports).toHaveProperty('CronEngine');
      expect(exports.SchedulerService).toBe(mockSchedulerService);
      expect(exports.SchedulerRepository).toBe(mockSchedulerRepository);
      expect(exports.CronEngine).toBe(mockCronEngine);
    });
  });
});