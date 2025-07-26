/**
 * @file Agent Service for managing agents and tasks.
 * @module src/modules/core/agents/services
 */

import type {
  Agent,
  AgentLog,
  AgentTask,
  CreateAgentDto,
  CreateTaskDto
} from '@/modules/core/agents/types/agent.types';
import type { AgentRepository } from '@/modules/core/agents/repositories/agent-repository';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

export class AgentService {
  private readonly repository: AgentRepository;
  private readonly logger: ILogger;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;

  constructor(repository: AgentRepository, logger: ILogger) {
    this.repository = repository;
    this.logger = logger;
  }

  async createAgent(data: CreateAgentDto): Promise<Agent> {
    try {
      const agent = await this.repository.createAgent(data);

      this.logger.info(LogSource.SYSTEM, 'Agent created', {
        data: {
          agentId: agent.id,
          name: agent.name
        }
      });

      return agent;
    } catch (error) {
      this.logger.error(LogSource.SYSTEM, 'Failed to create agent', {
        error: error instanceof Error ? error.message : String(error),
        data: { ...data }
      });
      throw error;
    }
  }

  async startAgent(agentId: string): Promise<void> {
    const agent = await this.repository.getAgentById(agentId);

    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status === 'active') {
      throw new Error('Agent already active');
    }

    await this.repository.updateAgent(agentId, { status: 'active' });

    this.logger.info(LogSource.SYSTEM, 'Agent started', { data: { agentId } });
  }

  async stopAgent(agentId: string, force = false): Promise<void> {
    const agent = await this.repository.getAgentById(agentId);

    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status === 'stopped') {
      return;
    }

    await this.repository.updateAgent(agentId, { status: 'stopped' });

    this.logger.info(LogSource.SYSTEM, 'Agent stopped', {
      data: {
        agentId,
        force
      }
    });
  }

  async assignTask(taskData: CreateTaskDto): Promise<AgentTask> {
    const agent = await this.repository.getAgentById(taskData.agent_id);

    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status !== 'active') {
      throw new Error('Agent not available');
    }

    const task = await this.repository.createTask(taskData);
    await this.repository.updateTaskStatus(task.id, 'assigned');

    this.logger.info(LogSource.SYSTEM, 'Task assigned to agent', {
      data: {
        agentId: taskData.agent_id,
        taskId: task.id,
        taskName: task.name
      }
    });

    return task;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    this.logger.info(LogSource.SYSTEM, 'Agent monitoring started');

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCycle();
      } catch (error) {
        this.logger.error(LogSource.SYSTEM, 'Monitoring cycle failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 5000);
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.logger.info(LogSource.SYSTEM, 'Agent monitoring stopped');
  }

  private async performMonitoringCycle(): Promise<void> {
    const activeAgents = await this.repository.listAgents('active');

    for (const agent of activeAgents) {
      try {
        await this.repository.updateHeartbeat(agent.id);

        await this.repository.getAgentTasks(agent.id);

        await this.repository.recordMetrics({
          agent_id: agent.id,
          cpu_usage: Math.random() * 100,
          memory_usage: Math.random() * 100,
          active_tasks: agent.assigned_tasks - agent.completed_tasks - agent.failed_tasks,
          timestamp: new Date()
        });
      } catch (error) {
        this.logger.error(LogSource.SYSTEM, 'Failed to monitor agent', {
          data: { agentId: agent.id },
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  isHealthy(): boolean {
    return this.isMonitoring;
  }

  async getAgentLogs(agentId: string, limit?: number): Promise<AgentLog[]> {
    return await this.repository.getAgentLogs(agentId, limit);
  }
}
