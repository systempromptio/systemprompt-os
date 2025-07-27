/**
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
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

// Database row types
interface AgentRow {
  id: string;
  name: string;
  type: string;
  status: string;
  config: string;
  capabilities: string;
  created_at: string;
  updated_at: string;
  assigned_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  last_heartbeat?: string;
}

interface TaskRow {
  id: string;
  agent_id: string;
  name: string;
  priority: string;
  status: string;
  payload: string;
  created_at: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
  error_message?: string;
}

interface LogRow {
  id: string;
  agent_id: string;
  level: string;
  message: string;
  timestamp: string;
  metadata?: string;
}

export class AgentRepository {
  private readonly database: IDatabaseConnection;

  constructor(database: IDatabaseConnection) {
    this.database = database;
  }

  async createAgent(data: ICreateAgentDto): Promise<IAgent> {
    const id = `agent-${Date.now()}-${Math.random().toString(36)
.substr(2, 9)}`;
    const now = new Date();

    const agent: IAgent = {
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

  async getAgentById(id: string): Promise<IAgent | null> {
    const result = await this.database.query<AgentRow>(
      'SELECT * FROM agents WHERE id = ?',
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as AgentRow;
    const agent: IAgent = {
      id: row.id,
      name: row.name,
      type: row.type as IAgent['type'],
      status: row.status as IAgent['status'],
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

  async listAgents(status?: string): Promise<IAgent[]> {
    let query = 'SELECT * FROM agents';
    const params: string[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.query<AgentRow>(query, params);

    return result.rows.map((row: AgentRow) => {
      const agent: IAgent = {
        id: row.id,
        name: row.name,
        type: row.type as IAgent['type'],
        status: row.status as IAgent['status'],
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

  async updateAgent(id: string, data: IUpdateAgentDto): Promise<IAgent | null> {
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

  async createTask(data: ICreateTaskDto): Promise<IAgentTask> {
    const id = `task-${Date.now()}-${Math.random().toString(36)
.substr(2, 9)}`;
    const now = new Date();

    const task: IAgentTask = {
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

  async getAgentTasks(agentId: string, status?: TaskStatus): Promise<IAgentTask[]> {
    let query = 'SELECT * FROM agent_tasks WHERE agent_id = ?';
    const params = [agentId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.query<TaskRow>(query, params);

    return result.rows.map((row: TaskRow) => {
      const task: IAgentTask = {
        id: row.id,
        agent_id: row.agent_id,
        name: row.name,
        priority: row.priority as IAgentTask['priority'],
        status: row.status as IAgentTask['status'],
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

  async getAgentLogs(agentId: string, limit?: number): Promise<IAgentLog[]> {
    let query = 'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [agentId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const result = await this.database.query<LogRow>(query, params);

    return result.rows.map((row: LogRow) => {
      const log: IAgentLog = {
        id: row.id,
        agent_id: row.agent_id,
        level: row.level as IAgentLog['level'],
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

  async recordMetrics(metrics: IAgentMetrics): Promise<void> {
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
