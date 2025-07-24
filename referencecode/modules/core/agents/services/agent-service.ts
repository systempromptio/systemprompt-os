/**
 * @fileoverview Agent service for managing agent lifecycle and operations
 * @module modules/core/agents/services
 */

import { EventEmitter } from 'events';
import type { Logger } from '../../../types.js';
import type {
  Agent,
  AgentTask,
  CreateAgentDto,
  UpdateAgentDto,
  AssignTaskDto,
  AgentStatus,
  AgentEvent,
} from '../types/agent.types.js';
import type { AgentRepository } from '../repositories/agent-repository.js';

export class AgentService extends EventEmitter {
  private monitoringInterval?: NodeJS.Timeout;
  private readonly activeAgents: Map<string, Agent> = new Map();
  private isMonitoring: boolean = false;

  constructor(
    private readonly repository: AgentRepository,
    private readonly logger: Logger,
  ) {
    super();
  }

  async createAgent(data: CreateAgentDto): Promise<Agent> {
    try {
      const agent = await this.repository.createAgent(data);

      this.emitEvent({
        type: 'created',
        agent_id: agent.id,
        timestamp: new Date(),
        data: { agent },
      });

      this.logger.info('Agent created', { agentId: agent.id, name: agent.name });
      return agent;
    } catch (error) {
      this.logger.error('Failed to create agent', { error, data });
      throw error;
    }
  }

  async startAgent(id: string): Promise<void> {
    try {
      const agent = await this.repository.getAgentById(id);
      if (!agent) {
        throw new Error(`Agent not found: ${id}`);
      }

      if (agent.status === 'active') {
        throw new Error(`Agent already active: ${id}`);
      }

      await this.repository.updateAgent(id, { status: 'active' });
      this.activeAgents.set(id, { ...agent, status: 'active' });

      this.emitEvent({
        type: 'started',
        agent_id: id,
        timestamp: new Date(),
      });

      this.logger.info('Agent started', { agentId: id });
    } catch (error) {
      this.logger.error('Failed to start agent', { error, agentId: id });
      throw error;
    }
  }

  async stopAgent(id: string, force = false): Promise<void> {
    try {
      const agent = await this.repository.getAgentById(id);
      if (!agent) {
        throw new Error(`Agent not found: ${id}`);
      }

      if (agent.status === 'stopped' && !force) {
        return;
      }

      await this.repository.updateAgent(id, { status: 'stopped' });
      this.activeAgents.delete(id);

      this.emitEvent({
        type: 'stopped',
        agent_id: id,
        timestamp: new Date(),
        data: { force },
      });

      this.logger.info('Agent stopped', { agentId: id, force });
    } catch (error) {
      this.logger.error('Failed to stop agent', { error, agentId: id });
      throw error;
    }
  }

  async getAgentStatus(id: string): Promise<Agent | null> {
    return this.repository.getAgentById(id);
  }

  async listAgents(filter?: { status?: AgentStatus; type?: string }): Promise<Agent[]> {
    return this.repository.listAgents(filter);
  }

  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent | null> {
    try {
      const agent = await this.repository.updateAgent(id, data);

      if (agent && this.activeAgents.has(id)) {
        this.activeAgents.set(id, agent);
      }

      this.emitEvent({
        type: 'updated',
        agent_id: id,
        timestamp: new Date(),
        data: { updates: data },
      });

      return agent;
    } catch (error) {
      this.logger.error('Failed to update agent', { error, agentId: id });
      throw error;
    }
  }

  async assignTask(data: AssignTaskDto): Promise<AgentTask> {
    try {
      const agent = await this.repository.getAgentById(data.agent_id);
      if (!agent) {
        throw new Error(`Agent not found: ${data.agent_id}`);
      }

      if (agent.status !== 'active' && agent.status !== 'idle') {
        throw new Error(`Agent not available: ${data.agent_id} (status: ${agent.status})`);
      }

      const task = await this.repository.createTask(data);
      await this.repository.incrementTaskCount(data.agent_id, 'assigned');
      await this.repository.updateTaskStatus(task.id, 'assigned');

      this.emitEvent({
        type: 'task_assigned',
        agent_id: data.agent_id,
        timestamp: new Date(),
        data: { task },
      });

      this.logger.info('Task assigned to agent', {
        agentId: data.agent_id,
        taskId: task.id,
        taskName: task.name,
      });

      return task;
    } catch (error) {
      this.logger.error('Failed to assign task', { error, data });
      throw error;
    }
  }

  async completeTask(taskId: string, result: any): Promise<void> {
    try {
      const tasks = await this.repository.getAgentTasks('', 1); // Get task by ID
      const task = tasks.find((t) => t.id === taskId);

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      await this.repository.updateTaskStatus(taskId, 'completed', result);
      await this.repository.incrementTaskCount(task.agent_id, 'completed');

      this.emitEvent({
        type: 'task_completed',
        agent_id: task.agent_id,
        timestamp: new Date(),
        data: { taskId, result },
      });

      this.logger.info('Task completed', { taskId, agentId: task.agent_id });
    } catch (error) {
      this.logger.error('Failed to complete task', { error, taskId });
      throw error;
    }
  }

  async failTask(taskId: string, error: string): Promise<void> {
    try {
      const tasks = await this.repository.getAgentTasks('', 1); // Get task by ID
      const task = tasks.find((t) => t.id === taskId);

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      await this.repository.updateTaskStatus(taskId, 'failed', undefined, error);
      await this.repository.incrementTaskCount(task.agent_id, 'failed');

      this.emitEvent({
        type: 'task_failed',
        agent_id: task.agent_id,
        timestamp: new Date(),
        data: { taskId, error },
      });

      this.logger.error('Task failed', { taskId, agentId: task.agent_id, error });
    } catch (err) {
      this.logger.error('Failed to mark task as failed', { error: err, taskId });
      throw err;
    }
  }

  async getAgentTasks(agentId: string, limit = 50): Promise<AgentTask[]> {
    return this.repository.getAgentTasks(agentId, limit);
  }

  async getAgentLogs(agentId: string, limit = 100): Promise<any[]> {
    return this.repository.getAgentLogs(agentId, limit);
  }

  async logAgentActivity(
    agentId: string,
    level: string,
    message: string,
    context?: any,
  ): Promise<void> {
    await this.repository.createLog({
      agent_id: agentId,
      level: level as any,
      message,
      context,
    });
  }

  // Monitoring methods

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {return;}

    this.isMonitoring = true;

    // Monitor active agents every 5 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.monitorAgents();
    }, 5000);

    this.logger.info('Agent monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {return;}

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      delete this.monitoringInterval;
    }

    this.logger.info('Agent monitoring stopped');
  }

  isHealthy(): boolean {
    return this.isMonitoring;
  }

  private async monitorAgents(): Promise<void> {
    try {
      const activeAgents = await this.repository.listAgents({ status: 'active' });

      for (const agent of activeAgents) {
        // Update heartbeat
        await this.repository.updateHeartbeat(agent.id);

        // Check if agent is still responsive
        if (agent.last_heartbeat) {
          const lastHeartbeat = new Date(agent.last_heartbeat);
          const now = new Date();
          const diff = now.getTime() - lastHeartbeat.getTime();

          // If no heartbeat for more than 30 seconds, mark as error
          if (diff > 30000) {
            await this.repository.updateAgent(agent.id, { status: 'error' });
            this.activeAgents.delete(agent.id);

            this.emitEvent({
              type: 'error',
              agent_id: agent.id,
              timestamp: now,
              data: { error: 'Agent unresponsive' },
            });

            this.logger.error('Agent unresponsive', { agentId: agent.id });
          }
        }

        // Record metrics
        await this.recordAgentMetrics(agent.id);
      }
    } catch (error) {
      this.logger.error('Error monitoring agents', error);
    }
  }

  private async recordAgentMetrics(agentId: string): Promise<void> {
    try {
      // Get recent tasks for metrics
      const tasks = await this.repository.getAgentTasks(agentId, 100);
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      const failedTasks = tasks.filter((t) => t.status === 'failed');

      // Calculate metrics
      const errorRate = tasks.length > 0 ? failedTasks.length / tasks.length : 0;

      const avgDuration =
        completedTasks.length > 0
          ? completedTasks.reduce((sum, task) => {
              if (task.started_at && task.completed_at) {
                return sum + (task.completed_at.getTime() - task.started_at.getTime());
              }
              return sum;
            }, 0) / completedTasks.length
          : 0;

      // Record metrics
      await this.repository.recordMetrics(agentId, {
        error_rate: errorRate,
        average_task_duration: avgDuration,
        task_throughput: completedTasks.length,
      });
    } catch (error) {
      this.logger.error('Failed to record agent metrics', { error, agentId });
    }
  }

  private emitEvent(event: AgentEvent): void {
    this.emit('agent:event', event);
    this.emit(`agent:${event.type}`, event);
  }
}
