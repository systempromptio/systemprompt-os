/**
 * @fileoverview Unit tests for Agents module
 * @module tests/unit/modules/core/agents
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentsModule } from '../../../../../src/modules/core/agents/index.js';
import { AgentService } from '../../../../../src/modules/core/agents/services/agent.service.js';
import { AgentRepository } from '../../../../../src/modules/core/agents/repositories/agent-repository.js';

// Mock dependencies
vi.mock('../../../../../src/modules/core/database/adapters/module-adapter.js', () => ({
  createModuleAdapter: vi.fn().mockResolvedValue({
    query: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn()
  })
}));

vi.mock('../../../../../src/modules/core/agents/services/agent.service.js');
vi.mock('../../../../../src/modules/core/agents/repositories/agent-repository.js');

describe('AgentsModule', () => {
  let module: AgentsModule;
  let mockLogger: any;
  let mockDatabase: any;
  let mockAgentService: any;
  let mockAgentRepository: any;

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

    mockAgentService = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockReturnValue(true)
    };

    mockAgentRepository = {};

    vi.mocked(AgentService).mockImplementation(() => mockAgentService);
    vi.mocked(AgentRepository).mockImplementation(() => mockAgentRepository);

    module = new AgentsModule();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('module properties', () => {
    it('should have correct module metadata', () => {
      expect(module.name).toBe('agents');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('service');
      expect(module.dependencies).toEqual(['database', 'logger', 'auth']);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with default config', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);

      await module.initialize({ logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith('Agents module initialized', { module: 'agents' });
      expect(AgentRepository).toHaveBeenCalledWith(mockDatabase);
      expect(AgentService).toHaveBeenCalledWith(mockAgentRepository, mockLogger);
    });

    it('should initialize with custom config', async () => {
      const customConfig = { maxAgents: 50 };
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);

      await module.initialize({ config: customConfig, logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith('Agents module initialized', { module: 'agents' });
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database connection failed');
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockRejectedValue(error);

      await expect(module.initialize({ logger: mockLogger })).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize agents module', { error });
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

      expect(mockAgentService.startMonitoring).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Agents module started', { module: 'agents' });
    });

    it('should handle start errors', async () => {
      const error = new Error('Failed to start monitoring');
      mockAgentService.startMonitoring.mockRejectedValue(error);

      await expect(module.start()).rejects.toThrow('Failed to start monitoring');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start agents module', { error });
    });

    it('should throw error when module is not initialized', async () => {
      const uninitializedModule = new AgentsModule();
      
      await expect(uninitializedModule.start()).rejects.toThrow('Module not initialized');
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

      expect(mockAgentService.stopMonitoring).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Agents module stopped', { module: 'agents' });
    });

    it('should handle stop errors gracefully', async () => {
      const error = new Error('Failed to stop monitoring');
      mockAgentService.stopMonitoring.mockRejectedValue(error);

      await module.stop(); // Should not throw

      expect(mockLogger.error).toHaveBeenCalledWith('Error stopping agents module', { error });
    });

    it('should return early when agentService is not initialized', async () => {
      const uninitializedModule = new AgentsModule();
      
      await uninitializedModule.stop(); // Should not throw and return early
      
      expect(mockAgentService.stopMonitoring).not.toHaveBeenCalled();
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
        message: 'Agents module is healthy'
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

    it('should return unhealthy when service is not healthy', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });
      
      mockAgentService.isHealthy.mockReturnValue(false);

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Agents module health check failed'
      });
    });

    it('should handle health check without initialization', async () => {
      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Agents module health check failed'
      });
    });
  });

  describe('exports', () => {
    it('should export AgentService and AgentRepository', async () => {
      const { createModuleAdapter } = await import('../../../../../src/modules/core/database/adapters/module-adapter.js');
      vi.mocked(createModuleAdapter).mockResolvedValue(mockDatabase);
      await module.initialize({ logger: mockLogger });

      const exports = module.exports;

      expect(exports).toHaveProperty('AgentService');
      expect(exports).toHaveProperty('AgentRepository');
      expect(exports.AgentService).toBe(mockAgentService);
      expect(exports.AgentRepository).toBe(mockAgentRepository);
    });

    it('should throw error when module is not initialized', () => {
      const uninitializedModule = new AgentsModule();
      
      expect(() => uninitializedModule.exports).toThrow('Module not initialized');
    });
  });
});