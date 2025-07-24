/**
 * @fileoverview Agent repository for database operations
 * @module modules/core/agents/repositories
 */

import { BaseRepository } from '../../permissions/repositories/base.repository.js';
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

export class AgentRepository extends BaseRepository {
  
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
      ...(data.metadata !== undefined && { metadata: data.metadata })
    };

    await this.db.execute(
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
        agent.created_at.toISOString(),
        agent.updated_at.toISOString(),
        agent.assigned_tasks,
        agent.completed_tasks,
        agent.failed_tasks,
        JSON.stringify(agent.metadata || {})
      ]
    );

    return agent;
  }

  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(data.config));
    }
    if (data.capabilities !== undefined) {
      updates.push('capabilities = ?');
      values.push(JSON.stringify(data.capabilities));
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    await this.db.execute(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.getAgentById(id);
  }

  async getAgentById(id: string): Promise<Agent | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM agents WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {return null;}

    return this.mapRowToAgent(rows[0]);
  }

  async listAgents(filter?: {
    status?: AgentStatus;
    type?: string;
  }): Promise<Agent[]> {
    let query = 'SELECT * FROM agents WHERE 1=1';
    const values: any[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      values.push(filter.status);
    }
    if (filter?.type) {
      query += ' AND type = ?';
      values.push(filter.type);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.db.query<any>(query, values);
    return rows.map(row => this.mapRowToAgent(row));
  }

  async updateHeartbeat(id: string): Promise<void> {
    await this.db.execute(
      'UPDATE agents SET last_heartbeat = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  }

  async incrementTaskCount(id: string, field: 'assigned' | 'completed' | 'failed'): Promise<void> {
    const column = `${field}_tasks`;
    await this.db.execute(
      `UPDATE agents SET ${column} = ${column} + 1 WHERE id = ?`,
      [id]
    );
  }

  // Task methods

  async createTask(data: AssignTaskDto): Promise<AgentTask> {
    const id = crypto.randomUUID();
    const now = new Date();

    const task: AgentTask = {
      id,
      agent_id: data.agent_id,
      name: data.name,
      ...(data.description !== undefined && { description: data.description }),
      priority: data.priority || 'medium',
      status: 'pending',
      payload: data.payload || {},
      created_at: now,
      ...(data.timeout !== undefined && { timeout: data.timeout }),
      retry_count: 0,
      max_retries: data.max_retries || 3
    };

    await this.db.execute(
      `INSERT INTO agent_tasks (id, agent_id, name, description, priority, status, payload, 
       created_at, timeout, retry_count, max_retries)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.agent_id,
        task.name,
        task.description,
        task.priority,
        task.status,
        JSON.stringify(task.payload),
        task.created_at.toISOString(),
        task.timeout,
        task.retry_count,
        task.max_retries
      ]
    );

    return task;
  }

  async updateTaskStatus(
    id: string, 
    status: TaskStatus, 
    result?: any, 
    error?: string
  ): Promise<void> {
    const updates: string[] = ['status = ?'];
    const values: any[] = [status];
    const now = new Date().toISOString();

    if (status === 'assigned') {
      updates.push('assigned_at = ?');
      values.push(now);
    } else if (status === 'running') {
      updates.push('started_at = ?');
      values.push(now);
    } else if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = ?');
      values.push(now);
    }

    if (result !== undefined) {
      updates.push('result = ?');
      values.push(JSON.stringify(result));
    }
    if (error !== undefined) {
      updates.push('error = ?');
      values.push(error);
    }

    values.push(id);

    await this.db.execute(
      `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  async getAgentTasks(agentId: string, limit = 50): Promise<AgentTask[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM agent_tasks 
       WHERE agent_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [agentId, limit]
    );

    return rows.map(row => this.mapRowToTask(row));
  }

  // Log methods

  async createLog(log: Omit<AgentLog, 'id' | 'timestamp'>): Promise<void> {
    const id = crypto.randomUUID();
    
    await this.db.execute(
      `INSERT INTO agent_logs (id, agent_id, level, message, context, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        log.agent_id,
        log.level,
        log.message,
        JSON.stringify(log.context || {}),
        new Date().toISOString()
      ]
    );
  }

  async getAgentLogs(agentId: string, limit = 100): Promise<AgentLog[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM agent_logs 
       WHERE agent_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [agentId, limit]
    );

    return rows.map(row => ({
      id: row.id,
      agent_id: row.agent_id,
      level: row.level,
      message: row.message,
      context: JSON.parse(row.context || '{}'),
      timestamp: new Date(row.timestamp)
    }));
  }

  // Metrics methods

  async recordMetrics(agentId: string, metrics: {
    cpu_usage?: number;
    memory_usage?: number;
    task_throughput?: number;
    average_task_duration?: number;
    error_rate?: number;
    uptime?: number;
  }): Promise<void> {
    const fields: string[] = ['agent_id'];
    const values: any[] = [agentId];
    const placeholders: string[] = ['?'];

    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(key);
        values.push(value);
        placeholders.push('?');
      }
    });

    await this.db.execute(
      `INSERT INTO agent_metrics (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );
  }

  async getAgentMetrics(agentId: string, since?: Date): Promise<any[]> {
    let query = 'SELECT * FROM agent_metrics WHERE agent_id = ?';
    const values: any[] = [agentId];

    if (since) {
      query += ' AND timestamp >= ?';
      values.push(since.toISOString());
    }

    query += ' ORDER BY timestamp DESC';

    return this.db.query(query, values);
  }

  // Helper methods

  private mapRowToAgent(row: any): Agent {
    const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      config: JSON.parse(row.config || '{}'),
      capabilities: JSON.parse(row.capabilities || '[]'),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      ...(row.last_heartbeat !== null && { last_heartbeat: new Date(row.last_heartbeat) }),
      assigned_tasks: row.assigned_tasks,
      completed_tasks: row.completed_tasks,
      failed_tasks: row.failed_tasks,
      ...(metadata !== undefined && { metadata })
    };
  }

  private mapRowToTask(row: any): AgentTask {
    return {
      id: row.id,
      agent_id: row.agent_id,
      name: row.name,
      ...(row.description !== null && { description: row.description }),
      priority: row.priority,
      status: row.status,
      payload: JSON.parse(row.payload || '{}'),
      ...(row.result !== null && { result: JSON.parse(row.result) }),
      ...(row.error !== null && { error: row.error }),
      created_at: new Date(row.created_at),
      ...(row.assigned_at !== null && { assigned_at: new Date(row.assigned_at) }),
      ...(row.started_at !== null && { started_at: new Date(row.started_at) }),
      ...(row.completed_at !== null && { completed_at: new Date(row.completed_at) }),
      ...(row.timeout !== null && { timeout: row.timeout }),
      retry_count: row.retry_count,
      max_retries: row.max_retries
    };
  }
}