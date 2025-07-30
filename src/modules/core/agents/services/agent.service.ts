/**
 * Agent Service for managing agents.
 * Clean version without direct task management.
 */

import type {
  AgentsStatus,
  IAgent,
  IAgentLogsRow,
  IAgentsRow
} from '@/modules/core/agents/types/agent.types';
import { AgentsStatus as AgentsStatusEnum } from '@/modules/core/agents/types/database.generated';
import { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { EventNames } from '@/modules/core/events/types/index';

/**
 * Service for managing agents.
 */
export class AgentService {
  private static instance: AgentService | null = null;
  private readonly repository: AgentRepository;
  private readonly logger: ILogger;
  private readonly eventBus: EventBusService;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.repository = AgentRepository.getInstance();
    this.logger = LoggerService.getInstance();
    this.eventBus = EventBusService.getInstance();
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
   * @param createAgentDto.name
   * @param createAgentDto.description
   * @param createAgentDto.instructions
   * @param createAgentDto.type
   * @param createAgentDto.capabilities
   * @param createAgentDto.tools
   * @param createAgentDto.config
   * @returns Promise resolving to the created agent.
   */
  async createAgent(createAgentDto: {
    name: string;
    description: string;
    instructions: string;
    type: string;
    capabilities?: string[];
    tools?: string[];
    config?: Record<string, unknown>;
  }): Promise<IAgent> {
    try {
      const agent = await this.repository.createAgentExtended({
        ...createAgentDto,
        type: createAgentDto.type as an
      });

      this.logger.info(LogSource.AGENT, 'Agent created', {
        metadata: {
          agentId: agent.id,
          name: agent.name
        }
      });

      this.eventBus.emit(EventNames.AGENT_CREATED, {
        agentId: agent.id,
        name: agent.name,
        type: agent.type
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

    if (agent.status === AgentsStatusEnum.ACTIVE) {
      throw new Error('Agent already active');
    }

    await this.repository.updateAgent(agentId, { status: AgentsStatusEnum.ACTIVE });

    this.logger.info(LogSource.AGENT, 'Agent started', { metadata: { agentId } });

    this.eventBus.emit(EventNames.AGENT_STARTED, {
      agentId,
      startedAt: new Date()
    });

    const extendedAgent = await this.repository.getAgentByIdExtended(agentId);
    if (extendedAgent) {
      this.eventBus.emit(EventNames.AGENT_AVAILABLE, {
        agentId,
        capabilities: extendedAgent.capabilities
      });
    }
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

    if (agent.status === AgentsStatusEnum.STOPPED) {
      this.logger.info(LogSource.AGENT, 'Agent already stopped', {
        metadata: { agentId }
      });
      return;
    }

    await this.repository.updateAgent(agentId, { status: AgentsStatusEnum.STOPPED });

    this.logger.info(LogSource.AGENT, 'Agent stopped', {
      metadata: {
        agentId,
        force
      }
    });
  }

  /**
   * Updates an agent's status.
   * @param agentId - ID of the agent to update.
   * @param status - New status for the agent.
   * @returns Promise resolving to the updated agent.
   */
  async updateAgentStatus(agentId: string, status: AgentsStatus): Promise<IAgent> {
    this.logger.debug(LogSource.AGENT, 'Updating agent status', {
      metadata: {
 agentId,
status,
statusType: typeof status
}
    });

    const agent = await this.repository.getAgentById(agentId);

    if (agent === null) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    this.logger.debug(LogSource.AGENT, 'Found agent before update', {
      metadata: {
 agentId,
currentStatus: agent.status
}
    });

    try {
      const success = await this.repository.updateAgent(agentId, { status });
      if (!success) {
        throw new Error('Repository updateAgent returned false');
      }

      this.logger.debug(LogSource.AGENT, 'Repository update succeeded', {
        metadata: { agentId }
      });
    } catch (error) {
      this.logger.error(LogSource.AGENT, 'Repository update failed', {
        error: error instanceof Error ? error.message : String(error),
        metadata: {
 agentId,
status
}
      });
      throw error;
    }

    const extendedAgent: IAgent = {
      ...agent,
      status,
      updated_at: new Date().toISOString(),
      capabilities: [],
      tools: [],
      config: {}
    };

    this.logger.info(LogSource.AGENT, 'Agent status updated', {
      metadata: {
        agentId,
        oldStatus: agent.status,
        newStatus: status
      }
    });

    this.eventBus.emit(EventNames.AGENT_STATUS_CHANGED, {
      agentId,
      oldStatus: agent.status,
      newStatus: status
    });

    return extendedAgent;
  }

  /**
   * Reports that an agent is working on a task.
   * @param agentId - ID of the agent.
   * @param taskId - ID of the task.
   * @returns Promise.
   */
  async reportAgentBusy(agentId: string, taskId: number): Promise<void> {
    await this.repository.updateAgent(agentId, {
      status: AgentsStatusEnum.ACTIVE
    });

    this.eventBus.emit(EventNames.AGENT_BUSY, {
      agentId,
      taskId
    });
  }

  /**
   * Reports that an agent has finished a task.
   * @param agentId - ID of the agent.
   * @param success - Whether the task was successful.
   * @returns Promise.
   */
  async reportAgentIdle(agentId: string): Promise<void> {
    const agent = await this.repository.getAgentById(agentId);
    if (agent === null) {
      return;
    }

    await this.repository.updateAgent(agentId, {
      status: AgentsStatusEnum.IDLE
    });

    this.eventBus.emit(EventNames.AGENT_IDLE, {
      agentId
    });

    this.eventBus.emit(EventNames.AGENT_AVAILABLE, {
      agentId
    });
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
   * Reset singleton instance for testing purposes.
   * @returns Promise.
   */
  static async reset(): Promise<void> {
    if (AgentService.instance !== null) {
      await AgentService.instance.stopMonitoring();
      AgentService.instance = null;
    }
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
  async getAgentLogs(agentId: string, limit?: number): Promise<IAgentLogsRow[]> {
    return await this.repository.getAgentLogs(agentId, limit);
  }

  /**
   * Updates an agent.
   * @param identifier - Agent ID or name.
   * @param data - Update data.
   * @returns Promise resolving to updated agent or null.
   */
  async updateAgent(identifier: string, data: Partial<{
    name: string;
    description: string;
    instructions: string;
    type: string;
    status: AgentsStatus;
  }>): Promise<IAgent | null> {
    let agent = await this.repository.getAgentById(identifier);
    agent ??= await this.repository.getAgentByName(identifier);

    if (agent === null) {
      return null;
    }

    const updated = await this.repository.updateAgent(agent.id, data as any);
    if (!updated) {
      return null;
    }

    await new Promise(resolve => { return setTimeout(resolve, 50) });

    return await this.repository.getAgentByIdExtended(agent.id);
  }

  /**
   * Deletes an agent by identifier.
   * @param identifier - Agent ID or name to delete.
   * @returns Promise resolving to success status.
   */
  async deleteAgent(identifier: string): Promise<boolean> {
    let agent = await this.repository.getAgentById(identifier);
    agent ??= await this.repository.getAgentByName(identifier);

    if (agent === null) {
      return false;
    }

    const success = await this.repository.deleteAgent(agent.id);

    if (success) {
      this.logger.info(LogSource.AGENT, `Agent deleted: ${agent.name}`, { agentId: agent.id });
    }

    return success;
  }

  /**
   * Lists all agents with optional status filtering.
   * @param status - Optional status to filter by.
   * @returns Promise resolving to array of extended agents.
   */
  async listAgents(status?: string): Promise<IAgent[]> {
    return await this.repository.listAgentsExtended(status);
  }

  /**
   * Gets an agent by identifier (ID or name).
   * @param identifier - Agent ID or name.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgent(identifier: string): Promise<IAgent | null> {
    let agent = await this.repository.getAgentByIdExtended(identifier);
    if (!agent) {
      const agentRow = await this.repository.getAgentByName(identifier);
      if (agentRow) {
        agent = await this.repository.getAgentByIdExtended(agentRow.id);
      }
    }
    return agent;
  }

  /**
   * Gets available agents for a specific capability.
   * @param capability - Optional capability filter.
   * @returns Promise resolving to array of available agents.
   */
  async getAvailableAgents(capability?: string): Promise<IAgentsRow[]> {
    const activeAgents = await this.repository.listAgents(AgentsStatusEnum.ACTIVE);
    const idleAgents = await this.repository.listAgents(AgentsStatusEnum.IDLE);
    const agents = [...activeAgents, ...idleAgents];

    if (capability === undefined || capability === '') {
      return agents;
    }

    return agents;
  }

  /**
   * Performs a monitoring cycle for all active agents.
   * @returns Promise.
   */
  private async performMonitoringCycle(): Promise<void> {
    const activeAgents = await this.repository.listAgents(AgentsStatusEnum.ACTIVE);

    await Promise.all(
      activeAgents.map(async (agent): Promise<void> => {
        try {
          await this.repository.updateAgent(agent.id, { status: AgentsStatusEnum.ACTIVE });
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
