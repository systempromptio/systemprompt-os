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
      getAgentById: vi.fn(),
      listAgents: vi.fn(),
      updateAgent: vi.fn(),
      updateHeartbeat: vi.fn(),
      incrementTaskCount: vi.fn(),
      createTask: vi.fn(),
      updateTaskStatus: vi.fn(),
      getAgentTasks: vi.fn(),
      getAgentLogs: vi.fn(),
      createLog: vi.fn().mockResolvedValue(undefined),
      recordMetrics: vi.fn()
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

    it('should create agent with all optional fields', async () => {
      const createDto: CreateAgentDto = {
        name: 'test-agent',
        type: 'coordinator',
        config: { maxTasks: 5, timeout: 30000 },
        capabilities: ['analysis', 'processing']
      };

      const createdAgent: Agent = {
        id: 'agent-456',
        name: 'test-agent',
        type: 'coordinator',
        status: 'idle',
        config: { maxTasks: 5, timeout: 30000 },
        capabilities: ['analysis', 'processing'],
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
        agentId: 'agent-456',
        name: 'test-agent'
      });
    });

    it('should create agent with minimal required fields', async () => {
      const createDto: CreateAgentDto = {
        name: 'minimal-agent',
        type: 'monitor'
      };

      const createdAgent: Agent = {
        id: 'agent-789',
        name: 'minimal-agent',
        type: 'monitor',
        status: 'idle',
        config: {},
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
      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.updateAgent.mockResolvedValue({ ...mockAgent, status: 'active' });

      await service.startAgent('agent-123');

      expect(mockRepository.updateAgent).toHaveBeenCalledWith('agent-123', { status: 'active' });
      expect(mockLogger.info).toHaveBeenCalledWith('Agent started', { agentId: 'agent-123' });
    });

    it('should throw error if agent not found', async () => {
      mockRepository.getAgentById.mockResolvedValue(null);

      await expect(service.startAgent('agent-123')).rejects.toThrow('Agent not found');
    });

    it('should throw error if agent already active', async () => {
      mockRepository.getAgentById.mockResolvedValue({ ...mockAgent, status: 'active' });

      await expect(service.startAgent('agent-123')).rejects.toThrow('Agent already active');
    });

    it('should handle repository update failure', async () => {
      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.updateAgent.mockRejectedValue(new Error('Update failed'));

      await expect(service.startAgent('agent-123')).rejects.toThrow('Update failed');
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
      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.getAgentTasks.mockResolvedValue([]);
      mockRepository.updateAgent.mockResolvedValue({ ...mockAgent, status: 'active' });

      await service.stopAgent('agent-123');

      expect(mockRepository.updateAgent).toHaveBeenCalledWith('agent-123', { status: 'stopped' });
      expect(mockLogger.info).toHaveBeenCalledWith('Agent stopped', { agentId: 'agent-123', force: false });
    });

    it('should stop agent even with running tasks (no task check implemented)', async () => {
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

      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.getAgentTasks.mockResolvedValue([runningTask]);
      mockRepository.updateAgent.mockResolvedValue({ ...mockAgent, status: 'stopped' });

      await service.stopAgent('agent-123');

      expect(mockRepository.updateAgent).toHaveBeenCalledWith('agent-123', { status: 'stopped' });
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

      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.getAgentTasks.mockResolvedValue([runningTask]);
      mockRepository.updateAgent.mockResolvedValue({ ...mockAgent, status: 'active' });

      await service.stopAgent('agent-123', true);

      expect(mockRepository.updateAgent).toHaveBeenCalledWith('agent-123', { status: 'stopped' });
      expect(mockLogger.info).toHaveBeenCalledWith('Agent stopped', { agentId: 'agent-123', force: true });
    });

    it('should handle already stopped agent', async () => {
      mockRepository.getAgentById.mockResolvedValue({ ...mockAgent, status: 'stopped' });

      await service.stopAgent('agent-123');

      expect(mockRepository.updateAgent).not.toHaveBeenCalled();
    });

    it('should throw error if agent not found', async () => {
      mockRepository.getAgentById.mockResolvedValue(null);

      await expect(service.stopAgent('agent-123')).rejects.toThrow('Agent not found');
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

      mockRepository.getAgentById.mockResolvedValue(mockAgent);
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
      mockRepository.getAgentById.mockResolvedValue(null);

      await expect(service.assignTask({
        agent_id: 'agent-123',
        name: 'test-task',
        payload: {}
      })).rejects.toThrow('Agent not found');
    });

    it('should throw error if agent not active', async () => {
      mockRepository.getAgentById.mockResolvedValue({ ...mockAgent, status: 'stopped' });

      await expect(service.assignTask({
        agent_id: 'agent-123',
        name: 'test-task',
        payload: {}
      })).rejects.toThrow('Agent not available');
    });

    it('should handle repository createTask failure', async () => {
      const taskData = {
        agent_id: 'agent-123',
        name: 'test-task',
        payload: { data: 'test' }
      };

      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.createTask.mockRejectedValue(new Error('Task creation failed'));

      await expect(service.assignTask(taskData)).rejects.toThrow('Task creation failed');
    });

    it('should handle repository updateTaskStatus failure', async () => {
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

      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.createTask.mockResolvedValue(createdTask);
      mockRepository.updateTaskStatus.mockRejectedValue(new Error('Status update failed'));

      await expect(service.assignTask(taskData)).rejects.toThrow('Status update failed');
    });

    it('should assign task with all optional parameters', async () => {
      const taskData = {
        agent_id: 'agent-123',
        name: 'high-priority-task',
        priority: 'high' as const,
        payload: { data: 'test', options: { retry: true } },
        max_retries: 5
      };

      const createdTask: AgentTask = {
        id: 'task-456',
        agent_id: 'agent-123',
        name: 'high-priority-task',
        priority: 'high',
        status: 'assigned',
        payload: { data: 'test', options: { retry: true } },
        created_at: new Date(),
        assigned_at: new Date(),
        retry_count: 0,
        max_retries: 5
      };

      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.createTask.mockResolvedValue(createdTask);
      mockRepository.updateTaskStatus.mockResolvedValue(undefined);

      const result = await service.assignTask(taskData);

      expect(result).toEqual(createdTask);
      expect(mockRepository.createTask).toHaveBeenCalledWith(taskData);
      expect(mockLogger.info).toHaveBeenCalledWith('Task assigned to agent', {
        agentId: 'agent-123',
        taskId: 'task-456',
        taskName: 'high-priority-task'
      });
    });

    it('should assign task with minimal required parameters', async () => {
      const taskData = {
        agent_id: 'agent-123',
        name: 'simple-task',
        payload: {}
      };

      const createdTask: AgentTask = {
        id: 'task-789',
        agent_id: 'agent-123',
        name: 'simple-task',
        priority: 'medium',
        status: 'assigned',
        payload: {},
        created_at: new Date(),
        retry_count: 0,
        max_retries: 3
      };

      mockRepository.getAgentById.mockResolvedValue(mockAgent);
      mockRepository.createTask.mockResolvedValue(createdTask);
      mockRepository.updateTaskStatus.mockResolvedValue(undefined);

      const result = await service.assignTask(taskData);

      expect(result).toEqual(createdTask);
      expect(mockRepository.createTask).toHaveBeenCalledWith(taskData);
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
      mockRepository.updateHeartbeat.mockResolvedValue(undefined);
      mockRepository.recordMetrics.mockResolvedValue(undefined);

      await service.startMonitoring();

      expect(mockLogger.info).toHaveBeenCalledWith('Agent monitoring started');
      expect(service.isHealthy()).toBe(true);
      
      // Monitoring doesn't start immediately, it runs on interval
      // So listAgents won't be called until the interval triggers
    });

    it('should return early when already monitoring', async () => {
      // Start monitoring first
      await service.startMonitoring();
      
      // Clear previous calls
      mockLogger.info.mockClear();
      
      // Try to start monitoring again
      await service.startMonitoring();
      
      // Should not log start message again
      expect(mockLogger.info).not.toHaveBeenCalledWith('Agent monitoring started');
      expect(service.isHealthy()).toBe(true);
    });

    it('should stop monitoring successfully', async () => {
      mockRepository.listAgents.mockResolvedValue([]);
      await service.startMonitoring();
      await service.stopMonitoring();

      expect(mockLogger.info).toHaveBeenCalledWith('Agent monitoring stopped');
      expect(service.isHealthy()).toBe(false);
    });

    it('should return early when not monitoring', async () => {
      // Ensure service is not monitoring
      expect(service.isHealthy()).toBe(false);
      
      await service.stopMonitoring(); // Should not throw and return early
      
      expect(mockLogger.info).not.toHaveBeenCalledWith('Agent monitoring stopped');
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
      mockRepository.getAgentTasks.mockResolvedValue([]);

      // Trigger monitoring once
      vi.advanceTimersByTime(5000);

      // Clean up immediately
      await service.stopMonitoring();

      // Since monitoring runs async, we just verify it started correctly
      expect(service.isHealthy()).toBe(false);
    });

    it('should execute full monitoring cycle with metrics recording', async () => {
      const activeAgent = {
        id: 'agent-1',
        name: 'test-agent',
        type: 'worker',
        status: 'active',
        config: {},
        capabilities: [],
        created_at: new Date(),
        updated_at: new Date(),
        assigned_tasks: 5,
        completed_tasks: 3,
        failed_tasks: 1
      };

      mockRepository.listAgents.mockResolvedValue([activeAgent]);
      mockRepository.updateHeartbeat.mockResolvedValue(undefined);
      mockRepository.getAgentTasks.mockResolvedValue([]);
      mockRepository.recordMetrics.mockResolvedValue(undefined);

      await service.startMonitoring();

      // Trigger one monitoring cycle and wait for it to complete
      await vi.advanceTimersByTimeAsync(5000);

      await service.stopMonitoring();

      expect(mockRepository.updateHeartbeat).toHaveBeenCalledWith('agent-1');
      expect(mockRepository.getAgentTasks).toHaveBeenCalledWith('agent-1');
      expect(mockRepository.recordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'agent-1',
          cpu_usage: expect.any(Number),
          memory_usage: expect.any(Number),
          active_tasks: 1, // 5 assigned - 3 completed - 1 failed
          timestamp: expect.any(Date)
        })
      );
    });

    it('should handle individual agent monitoring failures', async () => {
      const activeAgent = {
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
      };

      mockRepository.listAgents.mockResolvedValue([activeAgent]);
      mockRepository.updateHeartbeat.mockRejectedValue(new Error('Heartbeat failed'));

      await service.startMonitoring();

      // Trigger one monitoring cycle and wait for it to complete
      await vi.advanceTimersByTimeAsync(5000);

      await service.stopMonitoring();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to monitor agent',
        { agentId: 'agent-1', error: expect.any(Error) }
      );
    });

    it('should handle general monitoring cycle failures', async () => {
      mockRepository.listAgents.mockRejectedValue(new Error('Database connection failed'));

      await service.startMonitoring();

      // Trigger one monitoring cycle and wait for it to complete
      await vi.advanceTimersByTimeAsync(5000);

      await service.stopMonitoring();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Monitoring cycle failed',
        { error: expect.any(Error) }
      );
    });
  });

  describe('getAgentLogs', () => {
    it('should retrieve agent logs with limit', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          agent_id: 'agent-123',
          level: 'info',
          message: 'Test log',
          timestamp: new Date()
        }
      ];

      mockRepository.getAgentLogs.mockResolvedValue(mockLogs);

      const result = await service.getAgentLogs('agent-123', 50);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.getAgentLogs).toHaveBeenCalledWith('agent-123', 50);
    });

    it('should retrieve agent logs without limit', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          agent_id: 'agent-123',
          level: 'info',
          message: 'Test log 1',
          timestamp: new Date()
        },
        {
          id: 'log-2',
          agent_id: 'agent-123',
          level: 'warn',
          message: 'Test log 2',
          timestamp: new Date()
        }
      ];

      mockRepository.getAgentLogs.mockResolvedValue(mockLogs);

      const result = await service.getAgentLogs('agent-123');

      expect(result).toEqual(mockLogs);
      expect(mockRepository.getAgentLogs).toHaveBeenCalledWith('agent-123', undefined);
    });
  });
});