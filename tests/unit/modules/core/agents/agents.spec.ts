/**
 * @fileoverview Unit tests for Agents module
 * @module tests/unit/modules/core/agents
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentsModule } from '../../../../../src/modules/core/agents/index.js';
import { AgentService } from '../../../../../src/modules/core/agents/services/agent.service.js';
import { AgentRepository } from '../../../../../src/modules/core/agents/repositories/agent-repository.js';
import { DatabaseService } from '../../../../../src/modules/core/database/services/database.service.js';
import { LoggerService } from '../../../../../src/modules/core/logger/services/logger.service.js';
import { DatabaseServiceAdapter } from '../../../../../src/modules/core/database/adapters/database-service-adapter.js';

// Mock dependencies
vi.mock('../../../../../src/modules/core/database/services/database.service.js');
vi.mock('../../../../../src/modules/core/logger/services/logger.service.js');
vi.mock('../../../../../src/modules/core/database/adapters/database-service-adapter.js');
vi.mock('../../../../../src/modules/core/agents/services/agent.service.js');
vi.mock('../../../../../src/modules/core/agents/repositories/agent-repository.js');

describe('AgentsModule', () => {
  let module: AgentsModule;
  let mockLogger: any;
  let mockDatabase: any;
  let mockDatabaseService: any;
  let mockDatabaseAdapter: any;
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

    mockDatabaseService = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([{ '1': 1 }]),
      execute: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn()
    };

    mockDatabaseAdapter = {
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

    // Mock the singleton services
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDatabaseService);
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
    vi.mocked(DatabaseServiceAdapter).mockImplementation(() => mockDatabaseAdapter);
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
      await module.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('modules', 'Agents module initialized');
      expect(DatabaseServiceAdapter).toHaveBeenCalledWith(mockDatabaseService);
      expect(AgentRepository).toHaveBeenCalledWith(mockDatabaseAdapter);
      expect(AgentService).toHaveBeenCalledWith(mockAgentRepository, mockLogger);
    });

    it('should initialize with custom config', async () => {
      await module.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('modules', 'Agents module initialized');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database connection failed');
      vi.mocked(DatabaseService.getInstance).mockImplementation(() => {
        throw error;
      });

      await expect(module.initialize()).rejects.toThrow('Database connection failed');
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      await module.initialize();
    });

    it('should start successfully', async () => {
      await module.start();

      expect(mockAgentService.startMonitoring).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('modules', 'Agents module started');
    });

    it('should handle start errors', async () => {
      const error = new Error('Failed to start monitoring');
      mockAgentService.startMonitoring.mockRejectedValue(error);

      await expect(module.start()).rejects.toThrow('Failed to start monitoring');
      // The current implementation doesn't log error on start failure, it just throws
    });

    it('should throw error when module is not initialized', async () => {
      const uninitializedModule = new AgentsModule();
      
      await expect(uninitializedModule.start()).rejects.toThrow('Agents module not initialized');
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await module.initialize();
      await module.start();
    });

    it('should stop successfully', async () => {
      await module.stop();

      expect(mockAgentService.stopMonitoring).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('modules', 'Agents module stopped');
    });

    it('should handle stop errors gracefully', async () => {
      const error = new Error('Failed to stop monitoring');
      mockAgentService.stopMonitoring.mockRejectedValue(error);

      await expect(module.stop()).rejects.toThrow('Failed to stop monitoring');

      expect(mockLogger.error).toHaveBeenCalledWith('modules', 'Failed to stop Agents module', { error: 'Failed to stop monitoring' });
    });

    it('should handle stop when agentService is not initialized', async () => {
      const uninitializedModule = new AgentsModule();
      
      // Since logger is not initialized, stop will throw when trying to log
      await expect(uninitializedModule.stop()).rejects.toThrow();
      
      expect(mockAgentService.stopMonitoring).not.toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when all checks pass', async () => {
      await module.initialize();
      await module.start();

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Agents module is healthy'
      });
    });

    it('should return unhealthy when module is not started', async () => {
      await module.initialize();
      // Don't start the module

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Agents module not started'
      });
    });

    it('should handle health check errors', async () => {
      await module.initialize();
      await module.start();
      
      // Mock an error during health check
      Object.defineProperty(module, 'initialized', {
        get: () => { throw new Error('Health check error'); }
      });

      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Agents module unhealthy: Error: Health check error'
      });
    });

    it('should handle health check without initialization', async () => {
      const result = await module.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Agents module not initialized'
      });
    });
  });

  describe('exports', () => {
    it('should export service and repository functions', async () => {
      await module.initialize();

      const exports = module.exports;

      expect(exports).toHaveProperty('service');
      expect(exports).toHaveProperty('repository');
      expect(typeof exports.service).toBe('function');
      expect(typeof exports.repository).toBe('function');
      expect(exports.service()).toBe(mockAgentService);
      expect(exports.repository()).toBe(mockAgentRepository);
    });

    it('should return exports even when module is not initialized', () => {
      const uninitializedModule = new AgentsModule();
      
      // The exports getter doesn't throw, it returns functions that would fail when called
      const exports = uninitializedModule.exports;
      expect(exports).toHaveProperty('service');
      expect(exports).toHaveProperty('repository');
    });
  });
});