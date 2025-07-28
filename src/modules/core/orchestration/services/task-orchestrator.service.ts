/**
 * Task Orchestrator Service
 * Coordinates task assignment and execution between Task and Agent modules
 */

import type { ITask } from '@/modules/core/tasks/types/index';
import type { ITaskModuleAPI, IAgentModuleAPI, ITaskOrchestrator } from '@/modules/core/api/types/index';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { EventNames } from '@/modules/core/events/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

export class TaskOrchestratorService implements ITaskOrchestrator {
  private static instance: TaskOrchestratorService | null = null;
  private readonly logger: ILogger;
  private readonly eventBus: EventBusService;
  private taskAPI!: ITaskModuleAPI;
  private agentAPI!: IAgentModuleAPI;

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.eventBus = EventBusService.getInstance();
    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TaskOrchestratorService {
    TaskOrchestratorService.instance ??= new TaskOrchestratorService();
    return TaskOrchestratorService.instance;
  }

  /**
   * Initialize with module APIs
   */
  initialize(taskAPI: ITaskModuleAPI, agentAPI: IAgentModuleAPI): void {
    this.taskAPI = taskAPI;
    this.agentAPI = agentAPI;
    this.logger.info(LogSource.MODULES, 'Task orchestrator initialized');
  }

  /**
   * Setup event listeners for coordination
   */
  private setupEventListeners(): void {
    // When an agent becomes available, try to assign work
    this.eventBus.on(EventNames.AGENT_AVAILABLE, async ({ agentId }) => {
      await this.assignNextAvailableTask(agentId);
    });

    // When an agent becomes idle, try to assign more work
    this.eventBus.on(EventNames.AGENT_IDLE, async ({ agentId }) => {
      await this.assignNextAvailableTask(agentId);
    });

    // When a new task is created, try to assign it
    this.eventBus.on(EventNames.TASK_CREATED, async ({ taskId }) => {
      await this.assignTaskToOptimalAgent(taskId);
    });

    // When a task is completed, update agent status
    this.eventBus.on(EventNames.TASK_COMPLETED, async ({ agentId }) => {
      await this.agentAPI.reportAgentIdle(agentId, true);
    });

    // When a task fails, update agent status
    this.eventBus.on(EventNames.TASK_FAILED, async ({ agentId }) => {
      await this.agentAPI.reportAgentIdle(agentId, false);
    });
  }

  /**
   * Assign next available task to an agent
   */
  async assignNextAvailableTask(agentId: string): Promise<ITask | null> {
    try {
      const agent = await this.agentAPI.getAgent(agentId);
      if (!agent || agent.status !== 'active') {
        return null;
      }

      const task = await this.taskAPI.getNextAvailableTask(agent.capabilities);
      if (!task || !task.id) {
        return null;
      }

      await this.taskAPI.assignTaskToAgent(task.id, agentId);
      await this.agentAPI.reportAgentBusy(agentId, task.id);

      this.logger.info(LogSource.MODULES, 'Task assigned to agent', {
        taskId: task.id,
        agentId
      });

      return task;
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to assign task to agent', {
        error: error instanceof Error ? error.message : String(error),
        agentId
      });
      return null;
    }
  }

  /**
   * Assign task to optimal agent
   */
  async assignTaskToOptimalAgent(taskId: number): Promise<string | null> {
    try {
      const task = await this.taskAPI.getTask(taskId);
      if (!task) {
        return null;
      }

      // Get available agents
      const agents = await this.agentAPI.getAvailableAgents();
      if (agents.length === 0) {
        return null;
      }

      // Simple algorithm: pick first available agent
      // TODO: Implement smarter assignment based on capabilities, workload, etc.
      const agent = agents[0];
      if (!agent) {
        return null;
      }

      await this.taskAPI.assignTaskToAgent(taskId, agent.id);
      await this.agentAPI.reportAgentBusy(agent.id, taskId);

      this.logger.info(LogSource.MODULES, 'Task assigned to optimal agent', {
        taskId,
        agentId: agent.id
      });

      return agent.id;
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to assign task to optimal agent', {
        error: error instanceof Error ? error.message : String(error),
        taskId
      });
      return null;
    }
  }

  /**
   * Execute a task with an agent
   */
  async executeTask(agentId: string, taskId: number): Promise<void> {
    try {
      const [agent, task] = await Promise.all([
        this.agentAPI.getAgent(agentId),
        this.taskAPI.getTask(taskId)
      ]);

      if (!agent || !task) {
        throw new Error('Agent or task not found');
      }

      // Update task status to running
      await this.taskAPI.updateTaskStatus(taskId, 'in_progress' as any);

      // Simulate task execution
      // In real implementation, this would delegate to agent-specific handlers
      this.logger.info(LogSource.MODULES, 'Executing task', {
        taskId,
        agentId,
        taskType: task.type
      });

      // Simulate progress updates
      for (let progress = 0; progress <= 100; progress += 25) {
        await this.taskAPI.updateTaskProgress(taskId, progress);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Complete the task
      await this.taskAPI.completeTask(taskId, {
        executedBy: agentId,
        executionTime: 400,
        output: `Task ${task.type} completed successfully`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error(LogSource.MODULES, 'Task execution failed', {
        error: errorMessage,
        taskId,
        agentId
      });

      await this.taskAPI.failTask(taskId, errorMessage);
      throw error;
    }
  }

  /**
   * Retry a failed task
   */
  async retryFailedTask(taskId: number): Promise<void> {
    try {
      const task = await this.taskAPI.getTask(taskId);
      if (!task || task.status !== 'failed') {
        throw new Error('Task not found or not in failed state');
      }

      // Reset task status
      await this.taskAPI.updateTaskStatus(taskId, 'pending' as any);
      
      // Try to assign to an agent
      await this.assignTaskToOptimalAgent(taskId);

    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to retry task', {
        error: error instanceof Error ? error.message : String(error),
        taskId
      });
      throw error;
    }
  }

  /**
   * Get agent workload
   */
  async getAgentWorkload(agentId: string): Promise<number> {
    const tasks = await this.taskAPI.getTasksByAgent(agentId);
    return tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').length;
  }

  /**
   * Get task queue status
   */
  async getTaskQueueStatus(): Promise<{ pending: number; running: number; completed: number }> {
    const [pending, running, completed] = await Promise.all([
      this.taskAPI.getTasksByStatus('pending' as any),
      this.taskAPI.getTasksByStatus('in_progress' as any),
      this.taskAPI.getTasksByStatus('completed' as any)
    ]);

    return {
      pending: pending.length,
      running: running.length,
      completed: completed.length
    };
  }
}