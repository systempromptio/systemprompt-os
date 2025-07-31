/**
 * Agents service implementation - manages agent lifecycle and operations.
 * @file Agents service implementation.
 * @module agents/services
 * Provides business logic for agent management operations.
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';
import {
  type IAgent,
  type IAgentCreateData,
  type IAgentUpdateData
} from '@/modules/core/agents/types/agents.module.generated';
import type { IAgentsService } from '@/modules/core/agents/types/agents.service.generated';
import {
  AgentsStatus,
  type IAgentLogsRow,
  type IAgentsRow
} from '@/modules/core/agents/types/database.generated';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { EventNames } from '@/modules/core/events/types/index';

/**
 * Service for managing agents.
 */
export class AgentsService implements IAgentsService {
  private static instance: AgentsService;
  private readonly repository: AgentRepository;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;
  private started = false;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.repository = AgentRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance of AgentsService.
   * @returns The AgentsService instance.
   */
  static getInstance(): AgentsService {
    AgentsService.instance ||= new AgentsService();
    return AgentsService.instance;
  }

  /**
   * Set logger for the service.
   * @param logger - Logger instance.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize the service.
   * @returns Promise.
   */
  async initialize(): Promise<void> {
    if (this.initialized) { return; }
    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.AGENT, 'AgentsService initialized');
  }

  /**
   * Ensure service is initialized before operations.
   * @returns Promise.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Set up event handlers for inter-module communication.
   */
  private setupEventHandlers(): void {
  }

  /**
   * Creates a new agent.
   * @param data - Agent creation data.
   * @returns Promise resolving to the created agent.
   */
  async createAgent(data: IAgentCreateData): Promise<IAgent> {
    await this.ensureInitialized();

    try {
      const agent = await this.repository.createAgentExtended(data);

      this.logger?.info(LogSource.AGENT, 'Agent created', {
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
      this.logger?.error(LogSource.AGENT, 'Failed to create agent', {
        error: error instanceof Error ? error.message : String(error),
        metadata: { ...data }
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
    await this.ensureInitialized();

    const agent = await this.repository.getAgentById(agentId);

    if (agent === null) {
      throw new Error('Agent not found');
    }

    if (agent.status === AgentsStatus.ACTIVE) {
      throw new Error('Agent already active');
    }

    await this.repository.updateAgent(agentId, { status: AgentsStatus.ACTIVE });

    this.logger?.info(LogSource.AGENT, 'Agent started', { metadata: { agentId } });

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
  async stopAgent(agentId: string, force: unknown = false): Promise<void> {
    await this.ensureInitialized();

    const agent = await this.repository.getAgentById(agentId);

    if (agent === null) {
      throw new Error('Agent not found');
    }

    if (agent.status === AgentsStatus.STOPPED) {
      this.logger?.info(LogSource.AGENT, 'Agent already stopped', {
        metadata: { agentId }
      });
      return;
    }

    await this.repository.updateAgent(agentId, { status: AgentsStatus.STOPPED });

    this.logger?.info(LogSource.AGENT, 'Agent stopped', {
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
  async updateAgentStatus(agentId: string, status: unknown): Promise<IAgent> {
    await this.ensureInitialized();

    const agentStatus = status as AgentsStatus;
    if (!Object.values(AgentsStatus).includes(agentStatus)) {
      throw new Error(`Invalid agent status: ${String(status)}`);
    }

    this.logger?.debug(LogSource.AGENT, 'Updating agent status', {
      metadata: {
 agentId,
status: agentStatus,
statusType: typeof agentStatus
}
    });

    const agent = await this.repository.getAgentById(agentId);

    if (agent === null) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    this.logger?.debug(LogSource.AGENT, 'Found agent before update', {
      metadata: {
 agentId,
currentStatus: agent.status
}
    });

    try {
      const success = await this.repository.updateAgent(agentId, { status: agentStatus });
      if (!success) {
        throw new Error('Repository updateAgent returned false');
      }

      this.logger?.debug(LogSource.AGENT, 'Repository update succeeded', {
        metadata: { agentId }
      });
    } catch (error) {
      this.logger?.error(LogSource.AGENT, 'Repository update failed', {
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
      status: agentStatus,
      updated_at: new Date().toISOString(),
      capabilities: [],
      tools: [],
      config: {}
    };

    this.logger?.info(LogSource.AGENT, 'Agent status updated', {
      metadata: {
        agentId,
        oldStatus: agent.status,
        newStatus: status
      }
    });

    this.eventBus.emit(EventNames.AGENT_STATUS_CHANGED, {
      agentId,
      oldStatus: agent.status,
      newStatus: agentStatus
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
      status: AgentsStatus.ACTIVE
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
      status: AgentsStatus.ACTIVE
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
    this.started = true;

    await Promise.resolve();
    this.logger?.info(LogSource.AGENT, 'Agent monitoring started');

    this.monitoringInterval = setInterval((): void => {
      this.performMonitoringCycle().catch((error: unknown): void => {
        this.logger?.error(LogSource.AGENT, 'Monitoring cycle failed', {
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
    this.started = false;

    if (this.monitoringInterval !== undefined) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    await Promise.resolve();
    this.logger?.info(LogSource.AGENT, 'Agent monitoring stopped');
  }

  /**
   * Reset service state for testing purposes.
   * @returns Promise.
   */
  async reset(): Promise<void> {
    await this.stopMonitoring();
    this.initialized = false;
    this.started = false;
  }

  /**
   * Checks if the service is healthy.
   * @returns True if the service is healthy.
   */
  isHealthy(): boolean {
    return this.initialized && this.started && this.isMonitoring;
  }

  /**
   * Gets logs for an agent.
   * @param agentId - ID of the agent.
   * @param limit - Maximum number of logs to return.
   * @returns Promise resolving to array of agent logs.
   */
  async getAgentLogs(agentId: string, limit: number): Promise<IAgentLogsRow[]> {
    await this.ensureInitialized();
    const limitValue = limit <= 0 ? undefined : limit;
    return await this.repository.getAgentLogs(agentId, limitValue);
  }

  /**
   * Updates an agent.
   * @param identifier - Agent ID or name.
   * @param data - Update data.
   * @returns Promise resolving to updated agent or null.
   */
  async updateAgent(identifier: string, data: IAgentUpdateData): Promise<IAgent | null> {
    await this.ensureInitialized();

    let agent = await this.repository.getAgentById(identifier);
    agent ??= await this.repository.getAgentByName(identifier);

    if (agent === null) {
      return null;
    }

    const updated = await this.repository.updateAgent(agent.id, data);
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
    await this.ensureInitialized();

    let agent = await this.repository.getAgentById(identifier);
    agent ??= await this.repository.getAgentByName(identifier);

    if (agent === null) {
      return false;
    }

    const success = await this.repository.deleteAgent(agent.id);

    if (success) {
      this.logger?.info(LogSource.AGENT, `Agent deleted: ${agent.name}`, { agentId: agent.id });
    }

    return success;
  }

  /**
   * Lists all agents with optional status filtering.
   * @param status - Optional status to filter by.
   * @returns Promise resolving to array of extended agents.
   */
  async listAgents(status: string): Promise<IAgent[]> {
    await this.ensureInitialized();
    const statusFilter = status === '' ? undefined : status;
    return await this.repository.listAgentsExtended(statusFilter);
  }

  /**
   * Gets an agent by identifier (ID or name).
   * @param identifier - Agent ID or name.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgent(identifier: string): Promise<IAgent | null> {
    await this.ensureInitialized();

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
  async getAvailableAgents(capability: string): Promise<IAgentsRow[]> {
    await this.ensureInitialized();

    const activeAgents = await this.repository.listAgents(AgentsStatus.ACTIVE);
    const idleAgents = await this.repository.listAgents(AgentsStatus.IDLE);
    const agents = [...activeAgents, ...idleAgents];

    if (capability === '' || capability === undefined) {
      return agents;
    }

    return agents;
  }

  /**
   * Performs a monitoring cycle for all active agents.
   * @returns Promise.
   */
  private async performMonitoringCycle(): Promise<void> {
    const activeAgents = await this.repository.listAgents(AgentsStatus.ACTIVE);

    await Promise.all(
      activeAgents.map(async (agent): Promise<void> => {
        try {
          await this.repository.updateAgent(agent.id, { status: AgentsStatus.ACTIVE });
        } catch (error) {
          this.logger?.error(LogSource.AGENT, 'Failed to monitor agent', {
            metadata: { agentId: agent.id },
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );
  }
}
