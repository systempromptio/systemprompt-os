/**
 * @file Agent Repository for database operations.
 * @module src/modules/core/agents/repositories
 */

import type {
  Agent,
  AgentLog,
  AgentMetrics,
  AgentTask,
  CreateAgentDto,
  CreateTaskDto,
  TaskStatus,
  UpdateAgentDto
} from '@/modules/core/agents/types/agent.types';
import type { DatabaseConnection } from '@/modules/core/database/interfaces/database.interface';

export class AgentRepository {
  private readonly database: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.database = database;
  }

  async createAgent(data: CreateAgentDto): Promise<Agent> {
    const id = `agent-${Date.now()}-${Math.random().toString(36)
.substr(2, 9)}`;
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
      failed_tasks: 0
    };

    await this.database.execute(
      `INSERT INTO agents (id, name, type, status, config, capabilities, created_at, updated_at, assigned_tasks, completed_tasks, failed_tasks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        agent.failed_tasks
      ]
    );

    return agent;
  }

  async getAgentById(id: string): Promise<Agent | null> {
    const result = await this.database.query(
      'SELECT * FROM agents WHERE id = ?',
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const agent: Agent = {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      config: JSON.parse(row.config || '{}'),
      capabilities: JSON.parse(row.capabilities || '[]'),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      assigned_tasks: row.assigned_tasks,
      completed_tasks: row.completed_tasks,
      failed_tasks: row.failed_tasks
    };

    if (row.last_heartbeat) {
      agent.last_heartbeat = new Date(row.last_heartbeat);
    }

    return agent;
  }

  async listAgents(status?: string): Promise<Agent[]> {
    let query = 'SELECT * FROM agents';
    const params: string[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.query(query, params);

    return result.rows.map((row: any) => {
      const agent: Agent = {
        id: row.id,
        name: row.name,
        type: row.type,
        status: row.status,
        config: JSON.parse(row.config || '{}'),
        capabilities: JSON.parse(row.capabilities || '[]'),
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        assigned_tasks: row.assigned_tasks,
        completed_tasks: row.completed_tasks,
        failed_tasks: row.failed_tasks
      };

      if (row.last_heartbeat) {
        agent.last_heartbeat = new Date(row.last_heartbeat);
      }

      return agent;
    });
  }

  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent | null> {
    const updates: string[] = [];
    const params: (string | Record<string, any>)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
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

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await this.database.execute(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await this.getAgentById(id);
  }

  async updateHeartbeat(agentId: string): Promise<void> {
    await this.database.execute(
      'UPDATE agents SET last_heartbeat = ? WHERE id = ?',
      [new Date().toISOString(), agentId]
    );
  }

  async incrementTaskCount(agentId: string, type: 'assigned' | 'completed' | 'failed'): Promise<void> {
    const column = type === 'assigned' ? 'assigned_tasks'
                 : type === 'completed' ? 'completed_tasks'
                 : 'failed_tasks';

    await this.database.execute(
      `UPDATE agents SET ${column} = ${column} + 1 WHERE id = ?`,
      [agentId]
    );
  }

  async createTask(data: CreateTaskDto): Promise<AgentTask> {
    const id = `task-${Date.now()}-${Math.random().toString(36)
.substr(2, 9)}`;
    const now = new Date();

    const task: AgentTask = {
      id,
      agent_id: data.agent_id,
      name: data.name,
      priority: data.priority || 'medium',
      status: 'pending',
      payload: data.payload,
      created_at: now,
      retry_count: 0,
      max_retries: data.max_retries || 3
    };

    await this.database.execute(
      `INSERT INTO agent_tasks (id, agent_id, name, priority, status, payload, created_at, retry_count, max_retries)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  async updateTaskStatus(taskId: string, status: TaskStatus, errorMessage?: string): Promise<void> {
    const updates = ['status = ?'];
    const params: (string | TaskStatus)[] = [status];

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

    if (errorMessage) {
      updates.push('error_message = ?');
      params.push(errorMessage);
    }

    params.push(taskId);

    await this.database.execute(
      `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  async getAgentTasks(agentId: string, status?: TaskStatus): Promise<AgentTask[]> {
    let query = 'SELECT * FROM agent_tasks WHERE agent_id = ?';
    const params = [agentId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.query(query, params);

    return result.rows.map((row: any) => {
      const task: AgentTask = {
        id: row.id,
        agent_id: row.agent_id,
        name: row.name,
        priority: row.priority,
        status: row.status,
        payload: JSON.parse(row.payload || '{}'),
        created_at: new Date(row.created_at),
        retry_count: row.retry_count,
        max_retries: row.max_retries
      };

      if (row.assigned_at) {
        task.assigned_at = new Date(row.assigned_at);
      }
      if (row.started_at) {
        task.started_at = new Date(row.started_at);
      }
      if (row.completed_at) {
        task.completed_at = new Date(row.completed_at);
      }
      if (row.error_message) {
        task.error_message = row.error_message;
      }

      return task;
    });
  }

  async getAgentLogs(agentId: string, limit?: number): Promise<AgentLog[]> {
    let query = 'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [agentId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const result = await this.database.query(query, params);

    return result.rows.map((row: any) => {
      const log: AgentLog = {
        id: row.id,
        agent_id: row.agent_id,
        level: row.level,
        message: row.message,
        timestamp: new Date(row.timestamp)
      };

      if (row.metadata) {
        log.metadata = JSON.parse(row.metadata);
      }

      return log;
    });
  }

  async createLog(agentId: string, level: string, message: string, metadata?: Record<string, any>): Promise<void> {
    const id = `log-${Date.now()}-${Math.random().toString(36)
.substr(2, 9)}`;

    await this.database.execute(
      'INSERT INTO agent_logs (id, agent_id, level, message, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        agentId,
        level,
        message,
        new Date().toISOString(),
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  }

  async recordMetrics(metrics: AgentMetrics): Promise<void> {
    await this.database.execute(
      'INSERT INTO agent_metrics (agent_id, cpu_usage, memory_usage, active_tasks, timestamp) VALUES (?, ?, ?, ?, ?)',
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
