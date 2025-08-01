/**
 * Agent Repository for database operations.
 * @file Agent Repository for database operations.
 * @module src/modules/core/agents/repositories
 */

import type {
  IAgent,
  IAgentCreateDataExtended,
  IAgentUpdateData
} from '../types/manual';
import type { IAgentCreateData } from '../types/agents.module.generated';
import {
  AgentsStatus,
  type IAgentLogsRow,
  type IAgentsRow
} from '../types/database.generated';
import { AgentBaseRepository } from './agent-base.repository';

/**
 * Repository class for agent-related database operations.
 * Provides methods for managing agents.
 */
export class AgentsRepository extends AgentBaseRepository {
  private static instance: AgentsRepository | null = null;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    super();
  }

  /**
   * Get singleton instance of AgentRepository.
   * @returns The AgentRepository instance.
   */
  static getInstance(): AgentsRepository {
    AgentsRepository.instance ??= new AgentsRepository();
    return AgentsRepository.instance;
  }

  /**
   * Initialize the repository.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    await Promise.resolve();
  }

  /**
   * Creates a new agent in the database.
   * @param data - The agent creation data.
   * @returns Promise resolving to the created agent.
   */
  async createAgent(data: IAgentCreateData): Promise<IAgentsRow> {
    const id = this.generateAgentId();
    const now = new Date().toISOString();

    const agent: IAgentsRow = {
      id,
      name: data.name,
      description: data.description,
      instructions: data.instructions,  
      type: data.type,
      status: data.status ?? AgentsStatus.STOPPED,
      created_at: now,
      updated_at: now,
      assigned_tasks: data.assigned_tasks ?? 0,
      completed_tasks: data.completed_tasks ?? 0,
      failed_tasks: data.failed_tasks ?? 0
    };

    await this.insertAgentRecord(agent);
    await this.insertAgentRelatedData(agent.id, data);

    return agent;
  }

  /**
   * Creates a new agent and returns the full agent object.
   * @param data - The agent creation data.
   * @returns Promise resolving to the created agent with extended data.
   */
  async createAgentExtended(data: IAgentCreateDataExtended): Promise<IAgent> {
    const agentRow = await this.createAgent(data);
    const capabilities = data.capabilities ?? [];
    const tools = data.tools ?? [];
    const config = data.config ?? {};

    return {
      ...agentRow,
      capabilities,
      tools,
      config
    };
  }

  /**
   * Retrieves an agent by its ID.
   * @param id - The agent ID to retrieve.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgentById(id: string): Promise<IAgentsRow | null> {
    const result = await this.database.query<IAgentsRow>('SELECT * FROM agents WHERE id = ?', [id]);

    if (result.length === 0) {
      return null;
    }

    return result[0] ?? null;
  }

  /**
   * Retrieves an agent by its name.
   * @param name - The agent name to retrieve.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgentByName(name: string): Promise<IAgentsRow | null> {
    const result = await this.database.query<IAgentsRow>('SELECT * FROM agents WHERE name = ?', [name]);

    if (result.length === 0) {
      return null;
    }

    return result[0] ?? null;
  }

  /**
   * Lists all agents with optional status filtering.
   * @param status - Optional status to filter by.
   * @returns Promise resolving to array of agents.
   */
  async listAgents(status?: string): Promise<IAgentsRow[]> {
    let query = 'SELECT * FROM agents';
    const params: string[] = [];

    if (status !== undefined) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.query<IAgentsRow>(query, params);

    return result;
  }

  /**
   * Gets capabilities for an agent.
   * @param agentId - The agent ID.
   * @returns Promise resolving to array of capabilities.
   */
  private async getAgentCapabilities(agentId: string): Promise<string[]> {
    const result = await this.database.query<{ capability: string }>(
      'SELECT capability FROM agent_capabilities WHERE agent_id = ?',
      [agentId]
    );
    return result.map((row: { capability: string }): string => { return row.capability });
  }

  /**
   * Gets tools for an agent.
   * @param agentId - The agent ID.
   * @returns Promise resolving to array of tools.
   */
  private async getAgentTools(agentId: string): Promise<string[]> {
    const result = await this.database.query<{ tool: string }>(
      'SELECT tool FROM agent_tools WHERE agent_id = ?',
      [agentId]
    );
    return result.map((row: { tool: string }): string => { return row.tool });
  }

  /**
   * Gets config for an agent.
   * @param agentId - The agent ID.
   * @returns Promise resolving to config object.
   */
  private async getAgentConfig(agentId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<{ config_key: string; config_value: string }>('SELECT config_key, config_value FROM agent_config WHERE agent_id = ?', [agentId]);
    const config: Record<string, unknown> = {};
    for (const row of result) {
      config[row.config_key] = row.config_value;
    }
    return config;
  }

  /**
   * Retrieves an agent by its ID with extended data.
   * @param id - The agent ID to retrieve.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgentByIdExtended(id: string): Promise<IAgent | null> {
    const agentRow = await this.getAgentById(id);
    if (agentRow === null) {
      return null;
    }

    const [capabilities, tools, config] = await Promise.all([
      this.getAgentCapabilities(id),
      this.getAgentTools(id),
      this.getAgentConfig(id)
    ]);

    return {
      ...agentRow,
      capabilities,
      tools,
      config
    };
  }

  /**
   * Lists all agents with extended data.
   * @param status - Optional status to filter by.
   * @returns Promise resolving to array of extended agents.
   */
  async listAgentsExtended(status?: string): Promise<IAgent[]> {
    const agentRows = await this.listAgents(status);
    return await this.enrichAgentsWithExtendedData(agentRows);
  }

  /**
   * Updates an existing agent.
   * @param id - The agent ID to update.
   * @param data - The update data.
   * @returns Promise resolving to success status.
   */
  async updateAgent(id: string, data: IAgentUpdateData): Promise<boolean> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.instructions !== undefined) {
      updates.push('instructions = ?');
      params.push(data.instructions);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(data.type);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length === 0) {
      return true;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const query = `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`;

    try {
      await this.database.execute(query, params);
      return true;
    } catch (error) {
      throw new Error(`Failed to update agent ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deletes an agent by ID.
   * @param id - The agent ID to delete.
   * @returns Promise resolving to success status.
   */
  async deleteAgent(id: string): Promise<boolean> {
    await this.database.execute('DELETE FROM agents WHERE id = ?', [id]);
    return true;
  }

  /**
   * Retrieves logs for a specific agent.
   * @param agentId - The agent ID to get logs for.
   * @param limit - Optional limit on number of logs to return.
   * @returns Promise resolving to array of logs.
   */
  async getAgentLogs(agentId: string, limit?: number): Promise<IAgentLogsRow[]> {
    const { query, params } = this.buildLogQuery(agentId, limit);
    const result = await this.database.query<IAgentLogsRow>(query, params);
    return result;
  }

  /**
   * Generates a unique agent ID.
   * @returns Generated agent ID.
   */
  private generateAgentId(): string {
    return `agent-${Date.now().toString()}-${Math.random().toString(36)
.substring(2, 11)}`;
  }

  /**
   * Inserts agent record into database.
   * @param agent - Agent record to insert.
   * @returns Promise that resolves when insert is complete.
   */
  private async insertAgentRecord(agent: IAgentsRow): Promise<void> {
    await this.database.execute(
      `INSERT INTO agents (id, name, description, instructions, type, status, 
       created_at, updated_at, assigned_tasks, completed_tasks, failed_tasks) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent.id,
        agent.name,
        agent.description,
        agent.instructions,
        agent.type,
        agent.status,
        agent.created_at,
        agent.updated_at,
        agent.assigned_tasks,
        agent.completed_tasks,
        agent.failed_tasks
      ]
    );
  }

  /**
   * Inserts agent related data (capabilities, tools, config).
   * @param agentId - Agent ID.
   * @param data - Agent creation data.
   * @returns Promise that resolves when all related data is inserted.
   */
  private async insertAgentRelatedData(agentId: string, data: IAgentCreateDataExtended): Promise<void> {
    await Promise.all([
      this.insertAgentCapabilities(agentId, data.capabilities),
      this.insertAgentTools(agentId, data.tools),
      this.insertAgentConfig(agentId, data.config)
    ]);
  }

  /**
   * Inserts agent capabilities.
   * @param agentId - Agent ID.
   * @param capabilities - Array of capabilities.
   * @returns Promise that resolves when capabilities are inserted.
   */
  private async insertAgentCapabilities(agentId: string, capabilities?: string[]): Promise<void> {
    if (!capabilities || capabilities.length === 0) {
      return;
    }

    await Promise.all(
      capabilities.map(async capability => { await this.database.execute(
          'INSERT INTO agent_capabilities (agent_id, capability) VALUES (?, ?)',
          [agentId, capability]
        ); })
    );
  }

  /**
   * Inserts agent tools.
   * @param agentId - Agent ID.
   * @param tools - Array of tools.
   * @returns Promise that resolves when tools are inserted.
   */
  private async insertAgentTools(agentId: string, tools?: string[]): Promise<void> {
    if (!tools || tools.length === 0) {
      return;
    }

    await Promise.all(
      tools.map(async tool => { await this.database.execute(
          'INSERT INTO agent_tools (agent_id, tool) VALUES (?, ?)',
          [agentId, tool]
        ); })
    );
  }

  /**
   * Inserts agent config.
   * @param agentId - Agent ID.
   * @param config - Config object.
   * @returns Promise that resolves when config is inserted.
   */
  private async insertAgentConfig(agentId: string, config?: Record<string, unknown>): Promise<void> {
    if (!config) {
      return;
    }

    await Promise.all(
      Object.entries(config).map(async ([key, value]) => { await this.database.execute(
          'INSERT INTO agent_config (agent_id, config_key, config_value) VALUES (?, ?, ?)',
          [agentId, key, value]
        ); })
    );
  }

  /**
   * Enriches agent rows with extended data.
   * @param agentRows - Array of agent rows.
   * @returns Promise resolving to array of extended agents.
   */
  private async enrichAgentsWithExtendedData(agentRows: IAgentsRow[]): Promise<IAgent[]> {
    return await Promise.all(
      agentRows.map(async (agentRow): Promise<IAgent> => {
        const [capabilities, tools, config] = await Promise.all([
          this.getAgentCapabilities(agentRow.id),
          this.getAgentTools(agentRow.id),
          this.getAgentConfig(agentRow.id)
        ]);

        return {
          ...agentRow,
          capabilities,
          tools,
          config
        };
      })
    );
  }

  /**
   * Builds query for agent logs.
   * @param agentId - Agent ID.
   * @param limit - Optional limit.
   * @returns Query and parameters.
   */
  private buildLogQuery(agentId: string, limit?: number): { query: string; params: (string | number)[] } {
    let query = 'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [agentId];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    return {
 query,
params
};
  }
}
