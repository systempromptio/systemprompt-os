/**
 * @fileoverview Agent service for managing agent lifecycle and operations
 * @module modules/core/agents/services
 */

import { EventEmitter } from 'events';
import type { 
  Agent, 
  AgentTask, 
  CreateAgentDto, 
  UpdateAgentDto, 
  AssignTaskDto,
  AgentStatus,
  AgentEvent
} from '../types/agent.types.js';
import type { AgentRepository } from '../repositories/agent-repository.js';

export class AgentService extends EventEmitter {
  private monitoringInterval?: NodeJS.Timer;
  private activeAgents: Map<string, Agent> = new Map();
  private isMonitoring: boolean = false;

  constructor(
    private repository: AgentRepository,
    private logger?: any
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
        data: { agent }
      });

      this.logger?.info('Agent created', { agentId: agent.id, name: agent.name });
      return agent;
    } catch (error) {
      this.logger?.error('Failed to create agent', { error, data });
      throw error;
    }
  }

  async startAgent(id: string): Promise<void> {
    try {
      const agent = await this.repository.getAgent(id);
      if (!agent) {
        throw new Error('Agent not found');
      }

      if (agent.status === 'active') {
        throw new Error('Agent is already active');
      }

      await this.repository.updateAgentStatus(id, 'active');
      this.activeAgents.set(id, { ...agent, status: 'active' });

      this.emitEvent({
        type: 'started',
        agent_id: id,
        timestamp: new Date()
      });

      this.logger?.info('Agent started', { agentId: id });
    } catch (error) {
      this.logger?.error('Failed to start agent', { error, agentId: id });
      throw error;
    }
  }

  async stopAgent(id: string, force: boolean = false): Promise<void> {
    try {
      const agent = await this.repository.getAgent(id);
      if (!agent) {
        throw new Error('Agent not found');
      }

      if (agent.status === 'stopped') {
        return;
      }

      // Check for running tasks
      if (!force) {
        const runningTasks = await this.repository.listTasks(id, 'running');
        if (runningTasks.length > 0) {
          throw new Error('Agent has running tasks. Use force=true to stop anyway.');
        }
      }

      await this.repository.updateAgentStatus(id, 'stopped');
      this.activeAgents.delete(id);

      this.emitEvent({
        type: 'stopped',
        agent_id: id,
        timestamp: new Date(),
        data: { forced: force }
      });

      this.logger?.info('Agent stopped', { agentId: id, forced: force });
    } catch (error) {
      this.logger?.error('Failed to stop agent', { error, agentId: id });
      throw error;
    }
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.repository.getAgent(id);
  }

  async listAgents(status?: AgentStatus): Promise<Agent[]> {
    return this.repository.listAgents(status);
  }

  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent | null> {
    try {
      const agent = await this.repository.updateAgent(id, data);
      if (agent && this.activeAgents.has(id)) {
        this.activeAgents.set(id, agent);
      }
      
      this.logger?.info('Agent updated', { agentId: id });
      return agent;
    } catch (error) {
      this.logger?.error('Failed to update agent', { error, agentId: id });
      throw error;
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      // Stop agent if active
      const agent = await this.repository.getAgent(id);
      if (agent && agent.status === 'active') {
        await this.stopAgent(id, true);
      }

      const deleted = await this.repository.deleteAgent(id);
      if (!deleted) {
        throw new Error('Agent not found');
      }

      this.logger?.info('Agent deleted', { agentId: id });
    } catch (error) {
      this.logger?.error('Failed to delete agent', { error, agentId: id });
      throw error;
    }
  }

  async assignTask(data: AssignTaskDto): Promise<AgentTask> {
    try {
      const agent = await this.repository.getAgent(data.agent_id);
      if (!agent) {
        throw new Error('Agent not found');
      }

      if (agent.status !== 'active') {
        throw new Error('Agent is not active');
      }

      const task = await this.repository.createTask(data);

      this.emitEvent({
        type: 'task_assigned',
        agent_id: data.agent_id,
        timestamp: new Date(),
        data: { task }
      });

      this.logger?.info('Task assigned to agent', { 
        agentId: data.agent_id, 
        taskId: task.id,
        taskName: task.name 
      });

      // Trigger task execution (in a real system, this would notify the agent)
      this.processTask(task);

      return task;
    } catch (error) {
      this.logger?.error('Failed to assign task', { error, data });
      throw error;
    }
  }

  async getTask(id: string): Promise<AgentTask | null> {
    return this.repository.getTask(id);
  }

  async listTasks(agentId?: string): Promise<AgentTask[]> {
    return this.repository.listTasks(agentId);
  }

  async getAgentLogs(agentId: string, limit: number = 100): Promise<any[]> {
    return this.repository.getLogs(agentId, limit);
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Load active agents
    const activeAgents = await this.repository.listAgents('active');
    activeAgents.forEach(agent => {
      this.activeAgents.set(agent.id, agent);
    });

    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.monitorAgents();
    }, 5000); // Check every 5 seconds

    this.logger?.info('Agent monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.activeAgents.clear();
    this.logger?.info('Agent monitoring stopped');
  }

  isHealthy(): boolean {
    return this.isMonitoring;
  }

  private async monitorAgents(): Promise<void> {
    try {
      for (const [id, agent] of this.activeAgents) {
        // Update heartbeat
        await this.repository.updateHeartbeat(id);

        // Check for stale tasks
        const staleTasks = await this.checkStaleTasks(id);
        if (staleTasks.length > 0) {
          this.logger?.warn('Agent has stale tasks', { 
            agentId: id, 
            staleCount: staleTasks.length 
          });
        }

        // Emit heartbeat event
        this.emitEvent({
          type: 'heartbeat',
          agent_id: id,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger?.error('Error monitoring agents', { error });
    }
  }

  private async checkStaleTasks(agentId: string): Promise<AgentTask[]> {
    const tasks = await this.repository.listTasks(agentId, 'running');
    const now = Date.now();
    const staleTasks: AgentTask[] = [];

    for (const task of tasks) {
      if (task.timeout && task.started_at) {
        const elapsed = now - task.started_at.getTime();
        if (elapsed > task.timeout) {
          staleTasks.push(task);
          // Mark task as failed due to timeout
          await this.repository.updateTaskStatus(
            task.id, 
            'failed', 
            undefined, 
            'Task timed out'
          );
        }
      }
    }

    return staleTasks;
  }

  private async processTask(task: AgentTask): Promise<void> {
    try {
      // Update task status to running
      await this.repository.updateTaskStatus(task.id, 'running');

      // In a real implementation, this would send the task to the actual agent
      // For now, we'll simulate task processing
      setTimeout(async () => {
        try {
          // Simulate task completion (50% success rate for demo)
          if (Math.random() > 0.5) {
            await this.repository.updateTaskStatus(
              task.id, 
              'completed',
              { success: true, message: 'Task completed successfully' }
            );

            this.emitEvent({
              type: 'task_completed',
              agent_id: task.agent_id,
              timestamp: new Date(),
              data: { taskId: task.id }
            });
          } else {
            throw new Error('Simulated task failure');
          }
        } catch (error) {
          await this.repository.updateTaskStatus(
            task.id,
            'failed',
            undefined,
            error instanceof Error ? error.message : 'Unknown error'
          );

          this.emitEvent({
            type: 'task_failed',
            agent_id: task.agent_id,
            timestamp: new Date(),
            data: { taskId: task.id, error: error instanceof Error ? error.message : 'Unknown error' }
          });
        }
      }, Math.random() * 5000 + 1000); // Random delay 1-6 seconds
    } catch (error) {
      this.logger?.error('Error processing task', { error, taskId: task.id });
    }
  }

  private emitEvent(event: AgentEvent): void {
    this.emit('agent-event', event);
    
    // Log event to agent logs
    if (event.agent_id) {
      this.repository.addLog(
        event.agent_id,
        'info',
        `Event: ${event.type}`,
        event.data
      ).catch(error => {
        this.logger?.error('Failed to log agent event', { error });
      });
    }
  }
}