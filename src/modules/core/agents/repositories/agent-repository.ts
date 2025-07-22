/**
 * @fileoverview Agent repository for database operations
 * @module modules/core/agents/repositories
 */

import type { 
  Agent, 
  AgentTask, 
  AgentLog, 
  CreateAgentDto, 
  UpdateAgentDto, 
  AssignTaskDto,
  AgentStatus,
  TaskStatus 
} from '../types/agent.types.js';

export class AgentRepository {
  constructor(private database: any) {}

  async createAgent(data: CreateAgentDto): Promise<Agent> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const agent: Agent = {
      id,
      name: data.name,
      type: data.type,
      status: 'idle',
      config: data.config || {},
      capabilities: data.capabilities || [],
      created_at: now,
      updated_at: now,
      assigned_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      metadata: data.metadata
    };

    await this.database.execute(
      `INSERT INTO agents (id, name, type, status, config, capabilities, created_at, updated_at, 
       assigned_tasks, completed_tasks, failed_tasks, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent.id,
        agent.name,
        agent.type,
        agent.status,
        JSON.stringify(agent.config),
        JSON.stringify(agent.capabilities),
        agent.created_at,
        agent.updated_at,
        agent.assigned_tasks,
        agent.completed_tasks,
        agent.failed_tasks,
        JSON.stringify(agent.metadata)
      ]
    );

    return agent;
  }

  async getAgent(id: string): Promise<Agent | null> {
    const results = await this.database.query(
      'SELECT * FROM agents WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToAgent(results[0]);
  }

  async listAgents(status?: AgentStatus): Promise<Agent[]> {
    let query = 'SELECT * FROM agents';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const results = await this.database.query(query, params);
    return results.map((row: any) => this.mapToAgent(row));
  }

  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent | null> {
    const agent = await this.getAgent(id);
    if (!agent) {
      return null;
    }

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [new Date()];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.config !== undefined) {
      updates.push('config = ?');
      params.push(JSON.stringify(data.config));
    }

    if (data.capabilities !== undefined) {
      updates.push('capabilities = ?');
      params.push(JSON.stringify(data.capabilities));
    }

    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }

    params.push(id);

    await this.database.execute(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.getAgent(id);
  }

  async updateAgentStatus(id: string, status: AgentStatus): Promise<void> {
    await this.database.execute(
      'UPDATE agents SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date(), id]
    );
  }

  async updateHeartbeat(id: string): Promise<void> {
    await this.database.execute(
      'UPDATE agents SET last_heartbeat = ?, updated_at = ? WHERE id = ?',
      [new Date(), new Date(), id]
    );
  }

  async deleteAgent(id: string): Promise<boolean> {
    const result = await this.database.execute(
      'DELETE FROM agents WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  async createTask(data: AssignTaskDto): Promise<AgentTask> {
    const id = crypto.randomUUID();
    const now = new Date();

    const task: AgentTask = {
      id,
      agent_id: data.agent_id,
      name: data.name,
      description: data.description,
      priority: data.priority || 'medium',
      status: 'assigned',
      payload: data.payload,
      created_at: now,
      assigned_at: now,
      timeout: data.timeout,
      retry_count: 0,
      max_retries: data.max_retries || 3
    };

    await this.database.transaction(async (trx: any) => {
      // Insert task
      await trx.execute(
        `INSERT INTO agent_tasks (id, agent_id, name, description, priority, status, payload, 
         created_at, assigned_at, timeout, retry_count, max_retries)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.agent_id,
          task.name,
          task.description,
          task.priority,
          task.status,
          JSON.stringify(task.payload),
          task.created_at,
          task.assigned_at,
          task.timeout,
          task.retry_count,
          task.max_retries
        ]
      );

      // Update agent assigned tasks count
      await trx.execute(
        'UPDATE agents SET assigned_tasks = assigned_tasks + 1 WHERE id = ?',
        [data.agent_id]
      );
    });

    return task;
  }

  async getTask(id: string): Promise<AgentTask | null> {
    const results = await this.database.query(
      'SELECT * FROM agent_tasks WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToTask(results[0]);
  }

  async listTasks(agentId?: string, status?: TaskStatus): Promise<AgentTask[]> {
    let query = 'SELECT * FROM agent_tasks';
    const conditions: string[] = [];
    const params: any[] = [];

    if (agentId) {
      conditions.push('agent_id = ?');
      params.push(agentId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const results = await this.database.query(query, params);
    return results.map((row: any) => this.mapToTask(row));
  }

  async updateTaskStatus(
    id: string, 
    status: TaskStatus, 
    result?: Record<string, any>, 
    error?: string
  ): Promise<void> {
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, new Date()];

    if (status === 'running') {
      updates.push('started_at = ?');
      params.push(new Date());
    } else if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = ?');
      params.push(new Date());
    }

    if (result !== undefined) {
      updates.push('result = ?');
      params.push(JSON.stringify(result));
    }

    if (error !== undefined) {
      updates.push('error = ?');
      params.push(error);
    }

    params.push(id);

    await this.database.transaction(async (trx: any) => {
      await trx.execute(
        `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      // Update agent task counts
      const task = await this.getTask(id);
      if (task) {
        if (status === 'completed') {
          await trx.execute(
            'UPDATE agents SET completed_tasks = completed_tasks + 1 WHERE id = ?',
            [task.agent_id]
          );
        } else if (status === 'failed') {
          await trx.execute(
            'UPDATE agents SET failed_tasks = failed_tasks + 1 WHERE id = ?',
            [task.agent_id]
          );
        }
      }
    });
  }

  async addLog(agentId: string, level: string, message: string, context?: Record<string, any>): Promise<void> {
    await this.database.execute(
      `INSERT INTO agent_logs (id, agent_id, level, message, context, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        agentId,
        level,
        message,
        JSON.stringify(context),
        new Date()
      ]
    );
  }

  async getLogs(agentId: string, limit: number = 100): Promise<AgentLog[]> {
    const results = await this.database.query(
      'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?',
      [agentId, limit]
    );

    return results.map((row: any) => ({
      id: row.id,
      agent_id: row.agent_id,
      level: row.level,
      message: row.message,
      context: JSON.parse(row.context || '{}'),
      timestamp: new Date(row.timestamp)
    }));
  }

  private mapToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      config: JSON.parse(row.config || '{}'),
      capabilities: JSON.parse(row.capabilities || '[]'),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_heartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
      assigned_tasks: row.assigned_tasks,
      completed_tasks: row.completed_tasks,
      failed_tasks: row.failed_tasks,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private mapToTask(row: any): AgentTask {
    return {
      id: row.id,
      agent_id: row.agent_id,
      name: row.name,
      description: row.description,
      priority: row.priority,
      status: row.status,
      payload: JSON.parse(row.payload || '{}'),
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      created_at: new Date(row.created_at),
      assigned_at: row.assigned_at ? new Date(row.assigned_at) : undefined,
      started_at: row.started_at ? new Date(row.started_at) : undefined,
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      timeout: row.timeout,
      retry_count: row.retry_count,
      max_retries: row.max_retries
    };
  }
}