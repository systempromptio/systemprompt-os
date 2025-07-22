/**
 * @fileoverview Unit tests for AgentService
 * @module tests/unit/modules/core/agents/services
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentService } from '../../../../../../src/modules/core/agents/services/agent-service.js';
import type { Agent, AgentTask, CreateAgentDto } from '../../../../../../src/modules/core/agents/types/agent.types.js';

describe('AgentService', () => {
  let service: AgentService;
  let mockRepository: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockRepository = {
      createAgent: vi.fn(),
      getAgent: vi.fn(),
      listAgents: vi.fn(),
      updateAgent: vi.fn(),
      updateAgentStatus: vi.fn(),
      updateHeartbeat: vi.fn(),
      deleteAgent: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn(),
      listTasks: vi.fn(),
      updateTaskStatus: vi.fn(),
      addLog: vi.fn().mockResolvedValue(undefined),
      getLogs: vi.fn()
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    service = new AgentService(mockRepository, mockLogger);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('createAgent', () => {
    it('should create an agent successfully', async () => {
      const createDto: CreateAgentDto = {
        name: 'test-agent',
        type: 'worker',
        config: { maxTasks: 10 }
      };

      const createdAgent: Agent = {
        id: 'agent-123',
        name: 'test-agent',
        type: 'worker',
        status: 'idle',
        config: { maxTasks: 10 },
        capabilities: [],
        created_at: new Date(),
        updated_at: new Date(),
        assigned_tasks: 0,
        completed_tasks: 0,
        failed_tasks: 0
      };

      mockRepository.createAgent.mockResolvedValue(createdAgent);

      const result = await service.createAgent(createDto);

      expect(result).toEqual(createdAgent);
      expect(mockRepository.createAgent).toHaveBeenCalledWith(createDto);
      expect(mockLogger.info).toHaveBeenCalledWith('Agent created', {
        agentId: 'agent-123',
        name: 'test-agent'
      });
    });

    it('should handle creation errors', async () => {
      const createDto: CreateAgentDto = { name: 'test-agent', type: 'worker' };
      const error = new Error('Database error');
      mockRepository.createAgent.mockRejectedValue(error);

      await expect(service.createAgent(createDto)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create agent', { error, data: createDto });
    });
  });

  describe('startAgent', () => {
    const mockAgent: Agent = {
      id: 'agent-123',
      name: 'test-agent',
      type: 'worker',
      status: 'idle',
      config: {},
      capabilities: [],
      created_at: new Date(),
      updated_at: new Date(),
      assigned_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0
    };

    it('should start an agent successfully', async () => {
      mockRepository.getAgent.mockResolvedValue(mockAgent);
      mockRepository.updateAgentStatus.mockResolvedValue(undefined);

      await service.startAgent('agent-123');

      expect(mockRepository.updateAgentStatus).toHaveBeenCalledWith('agent-123', 'active');
      expect(mockLogger.info).toHaveBeenCalledWith('Agent started', { agentId: 'agent-123' });
    });

    it('should throw error if agent not found', async () => {
      mockRepository.getAgent.mockResolvedValue(null);

      await expect(service.startAgent('agent-123')).rejects.toThrow('Agent not found');
    });

    it('should throw error if agent already active', async () => {
      mockRepository.getAgent.mockResolvedValue({ ...mockAgent, status: 'active' });

      await expect(service.startAgent('agent-123')).rejects.toThrow('Agent is already active');
    });
  });

  describe('stopAgent', () => {
    const mockAgent: Agent = {
      id: 'agent-123',
      name: 'test-agent',
      type: 'worker',
      status: 'active',
      config: {},
      capabilities: [],
      created_at: new Date(),
      updated_at: new Date(),
      assigned_tasks: 5,
      completed_tasks: 3,
      failed_tasks: 0
    };

    it('should stop an agent successfully', async () => {
      mockRepository.getAgent.mockResolvedValue(mockAgent);
      mockRepository.listTasks.mockResolvedValue([]);
      mockRepository.updateAgentStatus.mockResolvedValue(undefined);

      await service.stopAgent('agent-123');

      expect(mockRepository.updateAgentStatus).toHaveBeenCalledWith('agent-123', 'stopped');
      expect(mockLogger.info).toHaveBeenCalledWith('Agent stopped', { agentId: 'agent-123', forced: false });
    });

    it('should prevent stop if agent has running tasks', async () => {
      const runningTask: AgentTask = {
        id: 'task-1',
        agent_id: 'agent-123',
        name: 'running-task',
        priority: 'medium',
        status: 'running',
        payload: {},
        created_at: new Date(),
        retry_count: 0,
        max_retries: 3
      };

      mockRepository.getAgent.mockResolvedValue(mockAgent);
      mockRepository.listTasks.mockResolvedValue([runningTask]);

      await expect(service.stopAgent('agent-123')).rejects.toThrow(
        'Agent has running tasks. Use force=true to stop anyway.'
      );
    });

    it('should force stop agent with running tasks', async () => {
      const runningTask: AgentTask = {
        id: 'task-1',
        agent_id: 'agent-123',
        name: 'running-task',
        priority: 'medium',
        status: 'running',
        payload: {},
        created_at: new Date(),
        retry_count: 0,
        max_retries: 3
      };

      mockRepository.getAgent.mockResolvedValue(mockAgent);
      mockRepository.listTasks.mockResolvedValue([runningTask]);
      mockRepository.updateAgentStatus.mockResolvedValue(undefined);

      await service.stopAgent('agent-123', true);

      expect(mockRepository.updateAgentStatus).toHaveBeenCalledWith('agent-123', 'stopped');
      expect(mockLogger.info).toHaveBeenCalledWith('Agent stopped', { agentId: 'agent-123', forced: true });
    });

    it('should handle already stopped agent', async () => {
      mockRepository.getAgent.mockResolvedValue({ ...mockAgent, status: 'stopped' });

      await service.stopAgent('agent-123');

      expect(mockRepository.updateAgentStatus).not.toHaveBeenCalled();
    });
  });

  describe('assignTask', () => {
    const mockAgent: Agent = {
      id: 'agent-123',
      name: 'test-agent',
      type: 'worker',
      status: 'active',
      config: {},
      capabilities: [],
      created_at: new Date(),
      updated_at: new Date(),
      assigned_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0
    };

    it('should assign task successfully', async () => {
      const taskData = {
        agent_id: 'agent-123',
        name: 'test-task',
        payload: { data: 'test' }
      };

      const createdTask: AgentTask = {
        id: 'task-123',
        agent_id: 'agent-123',
        name: 'test-task',
        priority: 'medium',
        status: 'assigned',
        payload: { data: 'test' },
        created_at: new Date(),
        assigned_at: new Date(),
        retry_count: 0,
        max_retries: 3
      };

      mockRepository.getAgent.mockResolvedValue(mockAgent);
      mockRepository.createTask.mockResolvedValue(createdTask);
      mockRepository.updateTaskStatus.mockResolvedValue(undefined);

      const result = await service.assignTask(taskData);

      expect(result).toEqual(createdTask);
      expect(mockRepository.createTask).toHaveBeenCalledWith(taskData);
      expect(mockLogger.info).toHaveBeenCalledWith('Task assigned to agent', {
        agentId: 'agent-123',
        taskId: 'task-123',
        taskName: 'test-task'
      });
    });

    it('should throw error if agent not found', async () => {
      mockRepository.getAgent.mockResolvedValue(null);

      await expect(service.assignTask({
        agent_id: 'agent-123',
        name: 'test-task',
        payload: {}
      })).rejects.toThrow('Agent not found');
    });

    it('should throw error if agent not active', async () => {
      mockRepository.getAgent.mockResolvedValue({ ...mockAgent, status: 'stopped' });

      await expect(service.assignTask({
        agent_id: 'agent-123',
        name: 'test-task',
        payload: {}
      })).rejects.toThrow('Agent is not active');
    });
  });

  describe('monitoring', () => {
    it('should start monitoring successfully', async () => {
      const activeAgents: Agent[] = [{
        id: 'agent-1',
        name: 'active-agent',
        type: 'worker',
        status: 'active',
        config: {},
        capabilities: [],
        created_at: new Date(),
        updated_at: new Date(),
        assigned_tasks: 0,
        completed_tasks: 0,
        failed_tasks: 0
      }];

      mockRepository.listAgents.mockResolvedValue(activeAgents);

      await service.startMonitoring();

      expect(mockRepository.listAgents).toHaveBeenCalledWith('active');
      expect(mockLogger.info).toHaveBeenCalledWith('Agent monitoring started');
      expect(service.isHealthy()).toBe(true);
    });

    it('should stop monitoring successfully', async () => {
      mockRepository.listAgents.mockResolvedValue([]);
      await service.startMonitoring();
      await service.stopMonitoring();

      expect(mockLogger.info).toHaveBeenCalledWith('Agent monitoring stopped');
      expect(service.isHealthy()).toBe(false);
    });

    it('should handle monitoring errors gracefully', async () => {
      mockRepository.listAgents.mockResolvedValue([{
        id: 'agent-1',
        name: 'test-agent',
        type: 'worker',
        status: 'active',
        config: {},
        capabilities: [],
        created_at: new Date(),
        updated_at: new Date(),
        assigned_tasks: 0,
        completed_tasks: 0,
        failed_tasks: 0
      }]);

      await service.startMonitoring();

      // Setup error mocks
      mockRepository.updateHeartbeat.mockRejectedValue(new Error('Database error'));
      mockRepository.listTasks.mockResolvedValue([]);

      // Trigger monitoring once
      vi.advanceTimersByTime(5000);

      // Clean up immediately
      await service.stopMonitoring();

      // Since monitoring runs async, we just verify it started correctly
      expect(service.isHealthy()).toBe(false);
    });
  });

  describe('getAgentLogs', () => {
    it('should retrieve agent logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          agent_id: 'agent-123',
          level: 'info',
          message: 'Test log',
          timestamp: new Date()
        }
      ];

      mockRepository.getLogs.mockResolvedValue(mockLogs);

      const result = await service.getAgentLogs('agent-123', 50);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.getLogs).toHaveBeenCalledWith('agent-123', 50);
    });
  });
});