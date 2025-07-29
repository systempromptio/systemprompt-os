/**
 * Agent Repository for database operations.
 * @file Agent Repository for database operations.
 * @module src/modules/core/agents/repositories
 */

import type { AgentsType, IAgent } from '@/modules/core/agents/types/agent.types';
import {
  AgentsStatus,
  type IAgentLogsRow,
  type IAgentsRow
} from '@/modules/core/agents/types/database.generated';
import { AgentBaseRepository } from '@/modules/core/agents/repositories/agent-base.repository';

// Minimal DTOs for input only
interface CreateAgentInput {
  id?: string | undefined;
  name: string;
  description: string;
  instructions: string;
  type: AgentsType;
  capabilities?: string[] | undefined;
  tools?: string[] | undefined;
  config?: Record<string, unknown> | undefined;
}

interface UpdateAgentInput {
  name?: string;
  description?: string;
  instructions?: string;
  type?: AgentsType;
  status?: AgentsStatus;
}

/**
 * Repository class for agent-related database operations.
 * Provides methods for managing agents.
 */
export class AgentRepository extends AgentBaseRepository {
  private static instance: AgentRepository | null = null;

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
  static getInstance(): AgentRepository {
    AgentRepository.instance ??= new AgentRepository();
    return AgentRepository.instance;
  }

  /**
   * Creates a new agent in the database.
   * @param data - The agent creation data.
   * @returns Promise resolving to the created agent.
   */
  async createAgent(data: CreateAgentInput): Promise<IAgentsRow> {
    const id = data.id ?? `agent-${Date.now().toString()}-${Math.random().toString(36)
.substring(2, 11)}`;
    const now = new Date().toISOString();

    const agent: IAgentsRow = {
      id,
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      type: data.type,
      status: AgentsStatus.STOPPED,
      created_at: now,
      updated_at: now,
      assigned_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0
    };

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

    if (data.capabilities && data.capabilities.length > 0) {
      for (const capability of data.capabilities) {
        await this.database.execute(
          'INSERT INTO agent_capabilities (agent_id, capability) VALUES (?, ?)',
          [agent.id, capability]
        );
      }
    }

    if (data.tools && data.tools.length > 0) {
      for (const tool of data.tools) {
        await this.database.execute(
          'INSERT INTO agent_tools (agent_id, tool) VALUES (?, ?)',
          [agent.id, tool]
        );
      }
    }

    if (data.config) {
      for (const [key, value] of Object.entries(data.config)) {
        await this.database.execute(
          'INSERT INTO agent_config (agent_id, config_key, config_value) VALUES (?, ?, ?)',
          [agent.id, key, value]
        );
      }
    }

    return agent;
  }

  /**
   * Creates a new agent and returns the full agent object.
   * @param data - The agent creation data.
   * @returns Promise resolving to the created agent with extended data.
   */
  async createAgentExtended(data: CreateAgentInput): Promise<IAgent> {
    const agentRow = await this.createAgent(data);
    const capabilities = data.capabilities || [];
    const tools = data.tools || [];
    const config = data.config || {};

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

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] ?? null;
  }

  /**
   * Retrieves an agent by its name.
   * @param name - The agent name to retrieve.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgentByName(name: string): Promise<IAgentsRow | null> {
    const result = await this.database.query<IAgentsRow>('SELECT * FROM agents WHERE name = ?', [name]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] ?? null;
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

    return result.rows;
  }

  /**
   * Gets capabilities for an agent.
   * @param agentId - The agent ID.
   * @returns Promise resolving to array of capabilities.
   */
  private async getAgentCapabilities(agentId: string): Promise<string[]> {
    const result = await this.database.query<{ capability: string }>('SELECT capability FROM agent_capabilities WHERE agent_id = ?', [agentId]);
    return result.rows.map(row => { return row.capability });
  }

  /**
   * Gets tools for an agent.
   * @param agentId - The agent ID.
   * @returns Promise resolving to array of tools.
   */
  private async getAgentTools(agentId: string): Promise<string[]> {
    const result = await this.database.query<{ tool: string }>('SELECT tool FROM agent_tools WHERE agent_id = ?', [agentId]);
    return result.rows.map(row => { return row.tool });
  }

  /**
   * Gets config for an agent.
   * @param agentId - The agent ID.
   * @returns Promise resolving to config object.
   */
  private async getAgentConfig(agentId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<{ config_key: string; config_value: string }>('SELECT config_key, config_value FROM agent_config WHERE agent_id = ?', [agentId]);
    const config: Record<string, unknown> = {};
    for (const row of result.rows) {
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
    if (!agentRow) {
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
    const agents: IAgent[] = [];

    for (const agentRow of agentRows) {
      const [capabilities, tools, config] = await Promise.all([
        this.getAgentCapabilities(agentRow.id),
        this.getAgentTools(agentRow.id),
        this.getAgentConfig(agentRow.id)
      ]);

      agents.push({
        ...agentRow,
        capabilities,
        tools,
        config
      });
    }

    return agents;
  }

  /**
   * Updates an existing agent.
   * @param id - The agent ID to update.
   * @param data - The update data.
   * @returns Promise resolving to success status.
   */
  async updateAgent(id: string, data: UpdateAgentInput): Promise<boolean> {
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
    let query = 'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [agentId];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const result = await this.database.query<IAgentLogsRow>(query, params);

    return result.rows;
  }
}
