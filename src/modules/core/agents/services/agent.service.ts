/**
 * Agent Service for managing agents and tasks.
 * @file Agent Service for managing agents and tasks.
 * @module src/modules/core/agents/services
 */

import type {
  IAgent,
  IAgentLog,
  IAgentTask,
  ICreateAgentDto,
  ICreateTaskDto
} from '@/modules/core/agents/types/agent.types';
import type { AgentRepository } from '@/modules/core/agents/repositories/agent-repository';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

/**
 * Service for managing agents and their tasks.
 */
export class AgentService {
  private readonly repository: AgentRepository;
  private readonly logger: ILogger;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;

  /**
   * Creates an instance of AgentService.
   * @param repository - Agent repository for data access.
   * @param logger - Logger instance.
   */
  constructor(repository: AgentRepository, logger: ILogger) {
    this.repository = repository;
    this.logger = logger;
  }

  /**
   * Creates a new agent.
   * @param createAgentDto - Agent creation data.
   * @returns Promise resolving to the created agent.
   */
  async createAgent(createAgentDto: ICreateAgentDto): Promise<IAgent> {
    try {
      const agent = await this.repository.createAgent(createAgentDto);

      this.logger.info(LogSource.SYSTEM, 'Agent created', {
        metadata: {
          agentId: agent.id,
          name: agent.name
        }
      });

      return agent;
    } catch (error) {
      this.logger.error(LogSource.SYSTEM, 'Failed to create agent', {
        error: error instanceof Error ? error.message : String(error),
        metadata: { ...createAgentDto }
      });
      throw error;
    }
  }

  /**
   * Starts an agent.
   * @param agentId - ID of the agent to start.
   * @returns Promise.
   */
  async startAgent(agentId: string): Promise<void> {
    const agent = await this.repository.getAgentById(agentId);

    if (agent === null || agent === undefined) {
      throw new Error('Agent not found');
    }

    if (agent.status === 'active') {
      throw new Error('Agent already active');
    }

    await this.repository.updateAgent(agentId, { status: 'active' });

    this.logger.info(LogSource.SYSTEM, 'Agent started', { metadata: { agentId } });
  }

  /**
   * Stops an agent.
   * @param agentId - ID of the agent to stop.
   * @param force - Whether to force stop the agent.
   * @returns Promise.
   */
  async stopAgent(agentId: string, force = false): Promise<void> {
    const agent = await this.repository.getAgentById(agentId);

    if (agent === null || agent === undefined) {
      throw new Error('Agent not found');
    }

    if (agent.status === 'stopped') {
      return;
    }

    await this.repository.updateAgent(agentId, { status: 'stopped' });

    this.logger.info(LogSource.SYSTEM, 'Agent stopped', {
      metadata: {
        agentId,
        force
      }
    });
  }

  /**
   * Assigns a task to an agent.
   * @param taskData - Task creation data.
   * @returns Promise resolving to the created task.
   */
  async assignTask(taskData: ICreateTaskDto): Promise<IAgentTask> {
    const agent = await this.repository.getAgentById(taskData.agent_id);

    if (agent === null || agent === undefined) {
      throw new Error('Agent not found');
    }

    if (agent.status !== 'active') {
      throw new Error('Agent not available');
    }

    const task = await this.repository.createTask(taskData);
    await this.repository.updateTaskStatus(task.id, 'assigned');

    this.logger.info(LogSource.SYSTEM, 'Task assigned to agent', {
      metadata: {
        agentId: taskData.agent_id,
        taskId: task.id,
        taskName: task.name
      }
    });

    return task;
  }

  /**
   * Starts monitoring agents.
   * @returns Promise.
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    this.logger.info(LogSource.SYSTEM, 'Agent monitoring started');

    this.monitoringInterval = setInterval(() => {
      void this.performMonitoringCycle().catch((error) => {
        this.logger.error(LogSource.SYSTEM, 'Monitoring cycle failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, 5000);
  }

  /**
   * Stops monitoring agents.
   * @returns Promise.
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval !== undefined) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.logger.info(LogSource.SYSTEM, 'Agent monitoring stopped');
  }

  /**
   * Checks if the service is healthy.
   * @returns True if the service is healthy.
   */
  isHealthy(): boolean {
    return this.isMonitoring;
  }

  /**
   * Gets logs for an agent.
   * @param agentId - ID of the agent.
   * @param limit - Maximum number of logs to return.
   * @returns Promise resolving to array of agent logs.
   */
  async getAgentLogs(agentId: string, limit?: number): Promise<IAgentLog[]> {
    return await this.repository.getAgentLogs(agentId, limit);
  }

  /**
   * Performs a monitoring cycle for all active agents.
   * @returns Promise.
   */
  private async performMonitoringCycle(): Promise<void> {
    const activeAgents = await this.repository.listAgents('active');

    await Promise.all(
      activeAgents.map(async (agent) => {
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
            metadata: { agentId: agent.id },
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );
  }
}
