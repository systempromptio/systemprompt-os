/**
 * @fileoverview Cron engine for executing scheduled tasks
 * @module modules/core/scheduler/services
 */

import { EventEmitter } from 'events';
import type { 
  ScheduledTask, 
  CronJob,
  ExecutionResult,
  TaskEvent
} from '../types/scheduler.types.js';
import type { SchedulerRepository } from '../repositories/scheduler-repository.js';

export class CronEngine extends EventEmitter {
  private cronJobs: Map<string, CronJob> = new Map();
  private tickInterval?: NodeJS.Timer;
  private isRunning: boolean = false;
  private executingTasks: Set<string> = new Set();

  constructor(
    private repository: SchedulerRepository,
    private logger?: any
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Start the tick interval
    this.tickInterval = setInterval(() => {
      this.tick().catch(error => {
        this.logger?.error('Error in cron tick', { error });
      });
    }, 1000); // Check every second

    this.logger?.info('Cron engine started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear tick interval
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }

    // Clear all cron jobs
    this.cronJobs.clear();
    
    // Wait for executing tasks to complete
    const timeout = setTimeout(() => {
      if (this.executingTasks.size > 0) {
        this.logger?.warn('Force stopping cron engine with running tasks', {
          runningTasks: Array.from(this.executingTasks)
        });
      }
    }, 10000);

    while (this.executingTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    clearTimeout(timeout);

    this.logger?.info('Cron engine stopped');
  }

  isHealthy(): boolean {
    return this.isRunning;
  }

  async addJob(task: ScheduledTask): Promise<void> {
    if (!task.enabled || task.status !== 'active') {
      return;
    }

    const job: CronJob = {
      id: task.id,
      expression: task.schedule,
      handler: () => this.executeTask(task),
      nextRun: task.next_run || new Date(),
      active: true
    };

    this.cronJobs.set(task.id, job);
    this.logger?.debug('Added cron job', { taskId: task.id, schedule: task.schedule });
  }

  async removeJob(taskId: string): Promise<void> {
    this.cronJobs.delete(taskId);
    this.logger?.debug('Removed cron job', { taskId });
  }

  async pauseJob(taskId: string): Promise<void> {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.active = false;
      this.logger?.info('Paused cron job', { taskId });
    }
  }

  async resumeJob(taskId: string): Promise<void> {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.active = true;
      this.logger?.info('Resumed cron job', { taskId });
    }
  }

  async executeTaskNow(taskId: string): Promise<ExecutionResult> {
    const task = await this.repository.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    return this.executeTask(task);
  }

  private async tick(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const now = new Date();
    
    // Check for tasks due to run
    const dueTasks = await this.repository.getTasksDueForExecution();
    
    for (const task of dueTasks) {
      // Skip if already executing
      if (this.executingTasks.has(task.id)) {
        continue;
      }

      // Add to cron jobs if not already there
      if (!this.cronJobs.has(task.id)) {
        await this.addJob(task);
      }

      const job = this.cronJobs.get(task.id);
      if (job && job.active && job.nextRun <= now) {
        // Execute the task
        this.executeTaskAsync(task);
        
        // Calculate and update next run
        const nextRun = this.calculateNextRun(task, now);
        if (nextRun) {
          job.nextRun = nextRun;
          await this.repository.updateTaskNextRun(task.id, nextRun);
        } else {
          // Task completed (one-time task)
          await this.repository.updateTaskStatus(task.id, 'completed');
          this.removeJob(task.id);
        }
      }
    }
  }

  private async executeTaskAsync(task: ScheduledTask): Promise<void> {
    // Execute task asynchronously
    setImmediate(async () => {
      try {
        await this.executeTask(task);
      } catch (error) {
        this.logger?.error('Task execution error', { 
          taskId: task.id,
          error 
        });
      }
    });
  }

  private async executeTask(task: ScheduledTask): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.executingTasks.add(task.id);

    // Create execution record
    const execution = await this.repository.createExecution(task.id, 'running');
    
    // Update last run
    await this.repository.updateTaskLastRun(task.id, new Date());

    this.emitEvent({
      type: 'executed',
      task_id: task.id,
      execution_id: execution.id,
      timestamp: new Date()
    });

    this.logger?.info('Executing scheduled task', { 
      taskId: task.id,
      taskName: task.name,
      executionId: execution.id 
    });

    let result: ExecutionResult;
    let retryCount = 0;

    while (retryCount <= task.retries) {
      try {
        // Execute the command
        result = await this.runCommand(task);
        
        // Update execution record
        await this.repository.updateExecution(
          execution.id,
          'completed',
          result.output
        );

        // Update task counters
        await this.repository.incrementTaskCounters(task.id, true);

        this.emitEvent({
          type: 'completed',
          task_id: task.id,
          execution_id: execution.id,
          timestamp: new Date(),
          data: { result }
        });

        this.logger?.info('Task execution completed', {
          taskId: task.id,
          executionId: execution.id,
          duration: result.duration
        });

        break;
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (retryCount > task.retries) {
          // Max retries exceeded
          result = {
            success: false,
            error: errorMessage,
            duration: Date.now() - startTime
          };

          await this.repository.updateExecution(
            execution.id,
            'failed',
            undefined,
            errorMessage
          );

          await this.repository.incrementTaskCounters(task.id, false);

          this.emitEvent({
            type: 'failed',
            task_id: task.id,
            execution_id: execution.id,
            timestamp: new Date(),
            data: { error: errorMessage }
          });

          this.logger?.error('Task execution failed', {
            taskId: task.id,
            executionId: execution.id,
            error: errorMessage,
            retries: retryCount - 1
          });

          throw error;
        } else {
          // Retry after delay
          this.logger?.warn('Task execution failed, retrying', {
            taskId: task.id,
            executionId: execution.id,
            error: errorMessage,
            retryCount,
            maxRetries: task.retries
          });

          await new Promise(resolve => setTimeout(resolve, task.retry_delay));
        }
      }
    }

    this.executingTasks.delete(task.id);
    return result!;
  }

  private async runCommand(task: ScheduledTask): Promise<ExecutionResult> {
    const startTime = Date.now();

    // In a real implementation, this would execute the actual command
    // For now, we'll simulate execution
    return new Promise((resolve, reject) => {
      const timeout = task.timeout || 60000;
      
      const timer = setTimeout(() => {
        reject(new Error('Task execution timeout'));
      }, timeout);

      // Simulate command execution
      setTimeout(() => {
        clearTimeout(timer);
        
        // Simulate 90% success rate
        if (Math.random() > 0.1) {
          resolve({
            success: true,
            output: {
              command: task.command,
              data: task.data,
              timestamp: new Date()
            },
            duration: Date.now() - startTime
          });
        } else {
          reject(new Error('Simulated task failure'));
        }
      }, Math.random() * 2000 + 500); // Random execution time 0.5-2.5s
    });
  }

  private calculateNextRun(task: ScheduledTask, fromTime: Date): Date | null {
    if (task.type === 'once') {
      return null; // One-time tasks don't repeat
    }

    if (task.type === 'interval') {
      // Parse interval
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

      return new Date(fromTime.getTime() + intervalMs);
    }

    if (task.type === 'cron') {
      // In a real implementation, we would use a cron parser
      // For now, return next minute
      const next = new Date(fromTime);
      next.setMinutes(next.getMinutes() + 1);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }

    return null;
  }

  private emitEvent(event: TaskEvent): void {
    this.emit('task-event', event);
  }
}