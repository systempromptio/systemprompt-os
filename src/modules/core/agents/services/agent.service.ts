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
  ICreateTaskDto,
  IUpdateAgentDto
} from '@/modules/core/agents/types/agent.types';
import { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Service for managing agents and their tasks.
 */
export class AgentService {
  private static instance: AgentService | null = null;
  private readonly repository: AgentRepository;
  private readonly logger: ILogger;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.repository = AgentRepository.getInstance();
    this.logger = LoggerService.getInstance();
  }

  /**
   * Get singleton instance of AgentService.
   * @returns The AgentService instance.
   */
  static getInstance(): AgentService {
    AgentService.instance ??= new AgentService();
    return AgentService.instance;
  }

  /**
   * Creates a new agent.
   * @param createAgentDto - Agent creation data.
   * @returns Promise resolving to the created agent.
   */
  async createAgent(createAgentDto: ICreateAgentDto): Promise<IAgent> {
    try {
      const agent = await this.repository.createAgent(createAgentDto);

      this.logger.info(LogSource.AGENT, 'Agent created', {
        metadata: {
          agentId: agent.id,
          name: agent.name
        }
      });

      return agent;
    } catch (error) {
      this.logger.error(LogSource.AGENT, 'Failed to create agent', {
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

    if (agent === null) {
      throw new Error('Agent not found');
    }

    if (agent.status === 'active') {
      throw new Error('Agent already active');
    }

    await this.repository.updateAgent(agentId, { status: 'active' });

    this.logger.info(LogSource.AGENT, 'Agent started', { metadata: { agentId } });
  }

  /**
   * Stops an agent.
   * @param agentId - ID of the agent to stop.
   * @param force - Whether to force stop the agent.
   * @returns Promise.
   */
  async stopAgent(agentId: string, force = false): Promise<void> {
    const agent = await this.repository.getAgentById(agentId);

    if (agent === null) {
      throw new Error('Agent not found');
    }

    if (agent.status === 'stopped') {
      return;
    }

    await this.repository.updateAgent(agentId, { status: 'stopped' });

    this.logger.info(LogSource.AGENT, 'Agent stopped', {
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

    if (agent === null) {
      throw new Error('Agent not found');
    }

    if (agent.status !== 'active') {
      throw new Error('Agent not available');
    }

    const task = await this.repository.createTask(taskData);
    await this.repository.updateTaskStatus(task.id, 'assigned');

    this.logger.info(LogSource.AGENT, 'Task assigned to agent', {
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
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    await Promise.resolve();
    this.logger.info(LogSource.AGENT, 'Agent monitoring started');

    this.monitoringInterval = setInterval((): void => {
      this.performMonitoringCycle().catch((error: unknown): void => {
        this.logger.error(LogSource.AGENT, 'Monitoring cycle failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, 5000);
  }

  /**
   * Stops monitoring agents.
   * @returns Promise.
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval !== undefined) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    await Promise.resolve();
    this.logger.info(LogSource.AGENT, 'Agent monitoring stopped');
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
   * Gets an agent by ID or name.
   * @param identifier - Agent ID or name.
   * @returns Promise resolving to the agent or null.
   */
  async getAgent(identifier: string): Promise<IAgent | null> {
    let agent = await this.repository.getAgentById(identifier);

    agent ??= await this.repository.getAgentByName(identifier);

    return agent;
  }

  /**
   * Lists all agents.
   * @param status - Optional status filter.
   * @returns Promise resolving to array of agents.
   */
  async listAgents(status?: string): Promise<IAgent[]> {
    return await this.repository.listAgents(status);
  }

  /**
   * Updates an agent.
   * @param identifier - Agent ID or name.
   * @param data - Update data.
   * @returns Promise resolving to updated agent or null.
   */
  async updateAgent(identifier: string, data: IUpdateAgentDto): Promise<IAgent | null> {
    const agent = await this.getAgent(identifier);

    if (agent === null) {
      return null;
    }

    return await this.repository.updateAgent(agent.id, data);
  }

  /**
   * Deletes an agent.
   * @param identifier - Agent ID or name.
   * @returns Promise resolving to true if deleted, false if not found.
   */
  async deleteAgent(identifier: string): Promise<boolean> {
    const agent = await this.getAgent(identifier);

    if (agent === null) {
      return false;
    }

    return await this.repository.deleteAgent(agent.id);
  }

  /**
   * Performs a monitoring cycle for all active agents.
   * @returns Promise.
   */
  private async performMonitoringCycle(): Promise<void> {
    const activeAgents = await this.repository.listAgents('active');

    await Promise.all(
      activeAgents.map(async (agent): Promise<void> => {
        try {
          await this.repository.getAgentTasks(agent.id);
          await this.repository.recordMetrics({
            agent_id: agent.id,
            cpu_usage: Math.random() * 100,
            memory_usage: Math.random() * 100,
            active_tasks: agent.assigned_tasks - agent.completed_tasks - agent.failed_tasks,
            timestamp: new Date()
          });
        } catch (error) {
          this.logger.error(LogSource.AGENT, 'Failed to monitor agent', {
            metadata: { agentId: agent.id },
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );
  }
}
