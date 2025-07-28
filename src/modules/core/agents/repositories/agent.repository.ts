/**
 * Agent Repository for database operations.
 * @file Agent Repository for database operations.
 * @module src/modules/core/agents/repositories
 */

import type {
  IAgent,
  IAgentLog,
  IAgentMetrics,
  IAgentTask,
  ICreateAgentDto,
  ICreateTaskDto,
  IUpdateAgentDto,
  TaskStatus
} from '@/modules/core/agents/types/agent.types';
import type { 
  IAgentsRow
} from '@/modules/core/agents/types/database.generated';
import { AgentBaseRepository } from '@/modules/core/agents/repositories/agent-base.repository';

/**
 * Repository class for agent-related database operations.
 * Provides methods for managing agents, tasks, logs, and metrics.
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
  async createAgent(data: ICreateAgentDto): Promise<IAgent> {
    const id = `agent-${Date.now().toString()}-${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date();

    const agent: IAgent = {
      id,
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      type: data.type,
      status: 'stopped',
      config: data.config ?? {},
      capabilities: data.capabilities ?? [],
      tools: data.tools ?? [],
      created_at: now,
      updated_at: now,
      assigned_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0
    };

    await this.database.execute(
      `INSERT INTO agents (id, name, description, instructions, type, status, config, 
       capabilities, tools, created_at, updated_at, assigned_tasks, completed_tasks, 
       failed_tasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent.id,
        agent.name,
        agent.description,
        agent.instructions,
        agent.type,
        agent.status,
        JSON.stringify(agent.config),
        JSON.stringify(agent.capabilities),
        JSON.stringify(agent.tools),
        agent.created_at.toISOString(),
        agent.updated_at.toISOString(),
        agent.assigned_tasks,
        agent.completed_tasks,
        agent.failed_tasks
      ]
    );

    return agent;
  }

  /**
   * Retrieves an agent by its ID.
   * @param id - The agent ID to retrieve.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgentById(id: string): Promise<IAgent | null> {
    const result = await this.database.query('SELECT * FROM agents WHERE id = ?', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (row === null || row === undefined) {
      return null;
    }

    return this.rowToAgent(row as IAgentsRow);
  }

  /**
   * Retrieves an agent by its name.
   * @param name - The agent name to retrieve.
   * @returns Promise resolving to the agent or null if not found.
   */
  async getAgentByName(name: string): Promise<IAgent | null> {
    const result = await this.database.query('SELECT * FROM agents WHERE name = ?', [name]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (row === null || row === undefined) {
      return null;
    }

    return this.rowToAgent(row as IAgentsRow);
  }

  /**
   * Lists all agents with optional status filtering.
   * @param status - Optional status to filter by.
   * @returns Promise resolving to array of agents.
   */
  async listAgents(status?: string): Promise<IAgent[]> {
    let query = 'SELECT * FROM agents';
    const params: string[] = [];

    if (status !== null && status !== undefined) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.query(query, params);

    return result.rows.map((row: any): IAgent => {
      return this.rowToAgent(row as IAgentsRow);
    });
  }

  /**
   * Updates an existing agent.
   * @param id - The agent ID to update.
   * @param data - The update data.
   * @returns Promise resolving to success status.
   */
  async updateAgent(id: string, data: IUpdateAgentDto): Promise<boolean> {
    const { query: updateQuery, params } = this.buildUpdateQuery(id, data);
    await this.database.execute(updateQuery, params);
    return true;
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
   * Builds update query for agent data.
   * @param id - Agent ID.
   * @param data - Update data.
   * @returns Query and parameters.
   */
  private buildUpdateQuery(id: string, data: IUpdateAgentDto): { query: string; params: any[] } {
    const updates: string[] = [];
    const params: any[] = [];

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

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (data.config !== undefined) {
      updates.push('config = ?');
      params.push(JSON.stringify(data.config));
    }

    if (data.capabilities !== undefined) {
      updates.push('capabilities = ?');
      params.push(JSON.stringify(data.capabilities));
    }

    if (data.tools !== undefined) {
      updates.push('tools = ?');
      params.push(JSON.stringify(data.tools));
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const query = `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`;
    return { query, params };
  }

  /**
   * Increments the task count for an agent.
   * @param agentId - The agent ID to update.
   * @param type - The type of task count to increment.
   */
  async incrementTaskCount(agentId: string, type: 'assigned' | 'completed' | 'failed'): Promise<void> {
    const column = type === 'assigned' ? 'assigned_tasks' : 
                   type === 'completed' ? 'completed_tasks' : 'failed_tasks';
    
    await this.database.execute(
      `UPDATE agents SET ${column} = ${column} + 1, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), agentId]
    );
  }

  /**
   * Creates a new task for an agent.
   * @param data - The task creation data.
   * @returns Promise resolving to the created task.
   */
  async createTask(data: ICreateTaskDto): Promise<IAgentTask> {
    const id = `task-${Date.now().toString()}-${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date();

    const task: IAgentTask = {
      id,
      agent_id: data.agent_id,
      name: data.name,
      priority: data.priority ?? 'medium',
      status: 'pending',
      payload: data.payload,
      created_at: now,
      retry_count: 0,
      max_retries: data.max_retries ?? 3
    };

    await this.database.execute(
      `INSERT INTO agent_tasks (id, agent_id, name, priority, status, payload, 
       created_at, retry_count, max_retries) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.agent_id,
        task.name,
        task.priority,
        task.status,
        JSON.stringify(task.payload),
        task.created_at.toISOString(),
        task.retry_count,
        task.max_retries
      ]
    );

    return task;
  }

  /**
   * Updates the status of a task.
   * @param taskId - The task ID to update.
   * @param status - The new status.
   * @param errorMessage - Optional error message for failed tasks.
   */
  async updateTaskStatus(taskId: string, status: TaskStatus, errorMessage?: string): Promise<void> {
    const updates = ['status = ?'];
    const params: string[] = [status];

    if (status === 'assigned') {
      updates.push('assigned_at = ?');
      params.push(new Date().toISOString());
    } else if (status === 'running') {
      updates.push('started_at = ?');
      params.push(new Date().toISOString());
    } else if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = ?');
      params.push(new Date().toISOString());
    }

    if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      updates.push('error_message = ?');
      params.push(errorMessage);
    }

    params.push(taskId);

    await this.database.execute(
      `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Retrieves tasks for a specific agent.
   * @param agentId - The agent ID to get tasks for.
   * @param status - Optional status filter.
   * @returns Promise resolving to array of tasks.
   */
  async getAgentTasks(agentId: string, status?: TaskStatus): Promise<IAgentTask[]> {
    let query = 'SELECT * FROM agent_tasks WHERE agent_id = ?';
    const params: string[] = [agentId];

    if (status !== undefined) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.query(query, params);

    return result.rows.map((row: any): IAgentTask => {
      const task: IAgentTask = {
        id: row.id,
        agent_id: row.agent_id,
        name: row.name,
        priority: this.validateTaskPriority(row.priority),
        status: this.validateTaskStatus(row.status),
        payload: JSON.parse(row.payload),
        created_at: new Date(row.created_at),
        retry_count: row.retry_count,
        max_retries: row.max_retries
      };

      if (typeof row.assigned_at === 'string' && row.assigned_at.length > 0) {
        task.assigned_at = new Date(row.assigned_at);
      }
      if (typeof row.started_at === 'string' && row.started_at.length > 0) {
        task.started_at = new Date(row.started_at);
      }
      if (typeof row.completed_at === 'string' && row.completed_at.length > 0) {
        task.completed_at = new Date(row.completed_at);
      }
      if (typeof row.error_message === 'string' && row.error_message.length > 0) {
        task.error_message = row.error_message;
      }

      return task;
    });
  }

  /**
   * Retrieves logs for a specific agent.
   * @param agentId - The agent ID to get logs for.
   * @param limit - Optional limit on number of logs to return.
   * @returns Promise resolving to array of logs.
   */
  async getAgentLogs(agentId: string, limit?: number): Promise<IAgentLog[]> {
    let query = 'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [agentId];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const result = await this.database.query(query, params);

    return result.rows.map((row: any): IAgentLog => {
      const log: IAgentLog = {
        id: row.id,
        agent_id: row.agent_id,
        level: row.level,
        message: row.message,
        timestamp: new Date(row.timestamp)
      };

      if (typeof row.metadata === 'string' && row.metadata.length > 0) {
        log.metadata = JSON.parse(row.metadata);
      }

      return log;
    });
  }

  /**
   * Creates a new log entry for an agent.
   * @param agentId - The agent ID.
   * @param level - The log level.
   * @param message - The log message.
   * @param metadata - Optional metadata object.
   */
  async createLog(agentId: string, level: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    const id = `log-${Date.now().toString()}-${Math.random().toString(36).substring(2, 11)}`;
    
    await this.database.execute(
      'INSERT INTO agent_logs (id, agent_id, level, message, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        agentId,
        level,
        message,
        new Date().toISOString(),
        metadata !== null && metadata !== undefined ? JSON.stringify(metadata) : null
      ]
    );
  }

  /**
   * Records performance metrics for an agent.
   * @param metrics - The metrics data to record.
   */
  async recordMetrics(metrics: IAgentMetrics): Promise<void> {
    await this.database.execute(
      `INSERT INTO agent_metrics (agent_id, cpu_usage, memory_usage, active_tasks, 
       timestamp) VALUES (?, ?, ?, ?, ?)`,
      [
        metrics.agent_id,
        metrics.cpu_usage,
        metrics.memory_usage,
        metrics.active_tasks,
        metrics.timestamp.toISOString()
      ]
    );
  }
}