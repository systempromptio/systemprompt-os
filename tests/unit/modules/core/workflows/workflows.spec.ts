/**
 * @fileoverview Unit tests for Workflows module
 * @module tests/unit/modules/core/workflows
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowsModule } from '../../../../../src/modules/core/workflows/index.js';
import { WorkflowService } from '../../../../../src/modules/core/workflows/services/workflow-service.js';
import { WorkflowRepository } from '../../../../../src/modules/core/workflows/repositories/workflow-repository.js';
import { WorkflowEngine } from '../../../../../src/modules/core/workflows/services/workflow-engine.js';

// Mock dependencies
vi.mock('../../../../../src/modules/core/database/adapters/module-adapter.js', () => ({
  createModuleAdapter: vi.fn().mockResolvedValue({
    query: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn()
  })
}));

vi.mock('../../../../../src/modules/core/workflows/services/workflow-service.js');
vi.mock('../../../../../src/modules/core/workflows/repositories/workflow-repository.js');
vi.mock('../../../../../src/modules/core/workflows/services/workflow-engine.js');

describe('WorkflowsModule', () => {
  let module: WorkflowsModule;
  let mockLogger: any;
  let mockDatabase: any;
  let mockWorkflowService: any;
  let mockWorkflowRepository: any;
  let mockWorkflowEngine: any;

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

    mockWorkflowEngine = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockReturnValue(true)
    };

    mockWorkflowService = {};
    mockWorkflowRepository = {};

    vi.mocked(WorkflowService).mockImplementation(() => mockWorkflowService);
    vi.mocked(WorkflowRepository).mockImplementation(() => mockWorkflowRepository);
    vi.mocked(WorkflowEngine).mockImplementation(() => mockWorkflowEngine);

    module = new WorkflowsModule();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('module properties', () => {
    it('should have correct module metadata', () => {
      expect(module.name).toBe('workflows');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('service');
      expect(module.dependencies).toEqual(['database', 'logger', 'agents']);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with default config', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);

      await module.initialize({ logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith('Workflows module initialized', { module: 'workflows' });
      expect(WorkflowRepository).toHaveBeenCalledWith(mockDatabase);
      expect(WorkflowEngine).toHaveBeenCalledWith(mockWorkflowRepository, mockLogger);
      expect(WorkflowService).toHaveBeenCalledWith(mockWorkflowRepository, mockWorkflowEngine, mockLogger);
    });

    it('should initialize with custom config', async () => {
      const customConfig = { maxConcurrentWorkflows: 100 };
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);

      await module.initialize({ config: customConfig, logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith('Workflows module initialized', { module: 'workflows' });
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database connection failed');
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockRejectedValue(error);

      await expect(module.initialize({ logger: mockLogger })).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize workflows module', { error });
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

      expect(mockWorkflowEngine.start).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Workflows module started', { module: 'workflows' });
    });

    it('should handle start errors', async () => {
      const error = new Error('Failed to start engine');
      mockWorkflowEngine.start.mockRejectedValue(error);

      await expect(module.start()).rejects.toThrow('Failed to start engine');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start workflows module', { error });
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

      expect(mockWorkflowEngine.stop).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Workflows module stopped', { module: 'workflows' });
    });

    it('should handle stop errors gracefully', async () => {
      const error = new Error('Failed to stop engine');
      mockWorkflowEngine.stop.mockRejectedValue(error);

      await module.stop(); // Should not throw

      expect(mockLogger.error).toHaveBeenCalledWith('Error stopping workflows module', { error });
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
        message: 'Workflows module is healthy'
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
      
      mockWorkflowEngine.isHealthy.mockReturnValue(false);

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Workflows module health check failed'
      });
    });

    it('should handle health check without initialization', async () => {
      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Workflows module health check failed'
      });
    });
  });

  describe('exports', () => {
    it('should export WorkflowService, WorkflowRepository, and WorkflowEngine', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });

      const exports = module.exports;

      expect(exports).toHaveProperty('WorkflowService');
      expect(exports).toHaveProperty('WorkflowRepository');
      expect(exports).toHaveProperty('WorkflowEngine');
      expect(exports.WorkflowService).toBe(mockWorkflowService);
      expect(exports.WorkflowRepository).toBe(mockWorkflowRepository);
      expect(exports.WorkflowEngine).toBe(mockWorkflowEngine);
    });
  });
});