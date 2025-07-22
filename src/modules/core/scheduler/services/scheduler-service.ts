/**
 * @fileoverview Scheduler service for managing scheduled tasks
 * @module modules/core/scheduler/services
 */

import { EventEmitter } from 'events';
import type { 
  ScheduledTask, 
  TaskExecution, 
  CreateTaskDto, 
  UpdateTaskDto,
  TaskStatus,
  ExecutionStatus,
  TaskStats,
  NextRunInfo,
  ExecutionResult,
  TaskEvent
} from '../types/scheduler.types.js';
import type { SchedulerRepository } from '../repositories/scheduler-repository.js';
import type { CronEngine } from './cron-engine.js';

export class SchedulerService extends EventEmitter {
  private cleanupInterval?: NodeJS.Timer;

  constructor(
    private repository: SchedulerRepository,
    private engine: CronEngine,
    private logger?: any
  ) {
    super();
    
    // Subscribe to engine events
    this.engine.on('task-event', this.handleTaskEvent.bind(this));
  }

  async createTask(data: CreateTaskDto): Promise<ScheduledTask> {
    try {
      // Validate schedule format
      this.validateSchedule(data.schedule);

      const task = await this.repository.createTask(data);
      
      // Add to cron engine if active
      if (task.enabled && task.status === 'active') {
        await this.engine.addJob(task);
      }

      this.emit('task-created', { task });
      this.logger?.info('Scheduled task created', { 
        taskId: task.id, 
        name: task.name,
        schedule: task.schedule 
      });
      
      return task;
    } catch (error) {
      this.logger?.error('Failed to create scheduled task', { error, data });
      throw error;
    }
  }

  async getTask(id: string): Promise<ScheduledTask | null> {
    return this.repository.getTask(id);
  }

  async listTasks(status?: TaskStatus): Promise<ScheduledTask[]> {
    return this.repository.listTasks(status);
  }

  async updateTask(id: string, data: UpdateTaskDto): Promise<ScheduledTask | null> {
    try {
      // Validate schedule if provided
      if (data.schedule) {
        this.validateSchedule(data.schedule);
      }

      const task = await this.repository.updateTask(id, data);
      
      if (task) {
        // Update cron job
        await this.engine.removeJob(id);
        if (task.enabled && task.status === 'active') {
          await this.engine.addJob(task);
        }

        this.emit('task-updated', { task });
        this.logger?.info('Scheduled task updated', { taskId: id });
      }
      
      return task;
    } catch (error) {
      this.logger?.error('Failed to update scheduled task', { error, taskId: id });
      throw error;
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      const deleted = await this.repository.deleteTask(id);
      if (!deleted) {
        throw new Error('Task not found');
      }

      // Remove from cron engine
      await this.engine.removeJob(id);

      this.emit('task-deleted', { taskId: id });
      this.logger?.info('Scheduled task deleted', { taskId: id });
    } catch (error) {
      this.logger?.error('Failed to delete scheduled task', { error, taskId: id });
      throw error;
    }
  }

  async pauseTask(id: string): Promise<void> {
    try {
      await this.repository.updateTaskStatus(id, 'paused');
      await this.engine.pauseJob(id);
      
      this.emit('task-paused', { taskId: id });
      this.logger?.info('Scheduled task paused', { taskId: id });
    } catch (error) {
      this.logger?.error('Failed to pause task', { error, taskId: id });
      throw error;
    }
  }

  async resumeTask(id: string): Promise<void> {
    try {
      const task = await this.repository.getTask(id);
      if (!task) {
        throw new Error('Task not found');
      }

      await this.repository.updateTaskStatus(id, 'active');
      await this.engine.resumeJob(id);
      
      // Recalculate next run
      const nextRun = this.calculateNextRun(task);
      if (nextRun) {
        await this.repository.updateTaskNextRun(id, nextRun);
      }

      this.emit('task-resumed', { taskId: id });
      this.logger?.info('Scheduled task resumed', { taskId: id });
    } catch (error) {
      this.logger?.error('Failed to resume task', { error, taskId: id });
      throw error;
    }
  }

  async runTaskNow(id: string): Promise<ExecutionResult> {
    try {
      const task = await this.repository.getTask(id);
      if (!task) {
        throw new Error('Task not found');
      }

      this.logger?.info('Running task immediately', { taskId: id });
      return await this.engine.executeTaskNow(id);
    } catch (error) {
      this.logger?.error('Failed to run task', { error, taskId: id });
      throw error;
    }
  }

  async pauseAll(): Promise<void> {
    try {
      const tasks = await this.repository.listTasks('active', true);
      
      for (const task of tasks) {
        await this.pauseTask(task.id);
      }

      this.logger?.info('All tasks paused', { count: tasks.length });
    } catch (error) {
      this.logger?.error('Failed to pause all tasks', { error });
      throw error;
    }
  }

  async resumeAll(): Promise<void> {
    try {
      const tasks = await this.repository.listTasks('paused', true);
      
      for (const task of tasks) {
        await this.resumeTask(task.id);
      }

      this.logger?.info('All tasks resumed', { count: tasks.length });
    } catch (error) {
      this.logger?.error('Failed to resume all tasks', { error });
      throw error;
    }
  }

  async getExecution(id: string): Promise<TaskExecution | null> {
    return this.repository.getExecution(id);
  }

  async listExecutions(
    taskId?: string, 
    status?: ExecutionStatus,
    limit?: number
  ): Promise<TaskExecution[]> {
    return this.repository.listExecutions(taskId, status, limit);
  }

  async getNextRuns(limit?: number, taskId?: string): Promise<NextRunInfo[]> {
    return this.repository.getNextRuns(limit || 10, taskId);
  }

  async getTaskStats(): Promise<TaskStats> {
    return this.repository.getTaskStats();
  }

  async loadScheduledTasks(): Promise<void> {
    try {
      const tasks = await this.repository.listTasks('active', true);
      
      for (const task of tasks) {
        await this.engine.addJob(task);
      }

      // Start cleanup interval
      const cleanupIntervalMs = 3600000; // 1 hour
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldExecutions().catch(error => {
          this.logger?.error('Error cleaning up old executions', { error });
        });
      }, cleanupIntervalMs);

      this.logger?.info('Loaded scheduled tasks', { count: tasks.length });
    } catch (error) {
      this.logger?.error('Failed to load scheduled tasks', { error });
      throw error;
    }
  }

  async stopAllTasks(): Promise<void> {
    try {
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      this.logger?.info('Stopped all scheduled tasks');
    } catch (error) {
      this.logger?.error('Error stopping all tasks', { error });
      throw error;
    }
  }

  private validateSchedule(schedule: string): void {
    // Basic validation
    if (!schedule || schedule.trim().length === 0) {
      throw new Error('Schedule cannot be empty');
    }

    // Validate interval format
    if (schedule.match(/^\d+[smhd]$/)) {
      return; // Valid interval
    }

    // Validate cron format (simplified)
    const cronParts = schedule.split(' ');
    if (cronParts.length >= 5) {
      // Basic cron validation
      // In a real implementation, we'd use a cron parser
      return;
    }

    // Check for special values
    if (['@yearly', '@monthly', '@weekly', '@daily', '@hourly'].includes(schedule)) {
      return;
    }

    throw new Error('Invalid schedule format');
  }

  private calculateNextRun(task: ScheduledTask): Date | null {
    const now = new Date();
    
    if (task.type === 'once' && task.last_run) {
      return null; // Already executed
    }

    if (task.type === 'interval') {
      const match = task.schedule.match(/^(\d+)([smhd])$/);
      if (!match) return null;

      const value = parseInt(match[1]);
      const unit = match[2];

      let intervalMs = 0;
      switch (unit) {
        case 's': intervalMs = value * 1000; break;
        case 'm': intervalMs = value * 60 * 1000; break;
        case 'h': intervalMs = value * 60 * 60 * 1000; break;
        case 'd': intervalMs = value * 24 * 60 * 60 * 1000; break;
      }

      return new Date(now.getTime() + intervalMs);
    }

    // For cron, return next minute as placeholder
    const next = new Date(now);
    next.setMinutes(next.getMinutes() + 1);
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next;
  }

  private async cleanupOldExecutions(): Promise<void> {
    try {
      const retentionDays = 30; // From config
      const deleted = await this.repository.cleanupOldExecutions(retentionDays);
      
      if (deleted > 0) {
        this.logger?.info('Cleaned up old executions', { 
          deleted,
          retentionDays 
        });
      }
    } catch (error) {
      this.logger?.error('Failed to cleanup old executions', { error });
    }
  }

  private handleTaskEvent(event: TaskEvent): void {
    // Re-emit task events
    this.emit('task-event', event);
    
    // Log important events
    switch (event.type) {
      case 'failed':
        this.logger?.warn('Task execution failed', {
          taskId: event.task_id,
          executionId: event.execution_id,
          error: event.data?.error
        });
        break;
      
      case 'completed':
        this.logger?.debug('Task execution completed', {
          taskId: event.task_id,
          executionId: event.execution_id
        });
        break;
    }
  }
}