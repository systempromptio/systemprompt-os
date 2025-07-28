/**
 * Core tasks module - provides task queue and execution system.
 * @file Core tasks module - provides task queue and execution system.
 * @module modules/core/tasks
 */

import { type IModule, ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { TaskService } from '@/modules/core/tasks/services/task.service';
import { TaskRepository } from '@/modules/core/tasks/repositories/task.repository';
import {
  type ITaskService,
  type ITasksModuleExports,
  TaskExecutionStatusEnum,
  TaskPriorityEnum,
  TaskStatusEnum
} from '@/modules/core/tasks/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Tasks module implementation.
 * @class TasksModule
 */
export class TasksModule implements IModule<ITasksModuleExports> {
  public readonly name = 'tasks';
  public readonly type = 'core' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Task queue and execution system for SystemPrompt OS';
  public readonly dependencies = ['logger', 'database'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private taskService!: TaskService;
  private logger!: ILogger;
  private database!: DatabaseService;
  private initialized = false;
  private started = false;
  /**
   * Gets the module exports.
   * @returns Module exports object.
   */
  get exports(): ITasksModuleExports {
    return {
      service: (): ITaskService => {
        return this.taskService;
      },
      TaskStatus: TaskStatusEnum,
      TaskExecutionStatus: TaskExecutionStatusEnum,
      TaskPriority: TaskPriorityEnum
    };
  }

  /**
   * Initialize the tasks module.
   * @throws {Error} If module already initialized or initialization fails.
   */
  async initialize(): Promise<void> {
    this.database = DatabaseService.getInstance();
    this.logger = LoggerService.getInstance();

    await this.database.initialize();
    if (this.initialized) {
      throw new Error('Tasks module already initialized');
    }

    try {
      const taskRepository = new TaskRepository(this.database);
      this.taskService = TaskService.getInstance();

      this.taskService.initialize(this.logger, taskRepository);

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Tasks module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize tasks module: ${errorMessage}`);
    }
  }

  /**
   * Start the tasks module.
   * @throws {Error} If module not initialized or already started.
   */
  start(): void {
    if (!this.initialized) {
      throw new Error('Tasks module not initialized');
    }

    if (this.started) {
      throw new Error('Tasks module already started');
    }

    const { RUNNING } = ModuleStatusEnum;
    this.status = RUNNING;
    this.started = true;

    this.logger.info(LogSource.MODULES, 'Tasks module started');
  }

  /**
   * Stop the tasks module.
   */
  stop(): void {
    if (this.started) {
      const { STOPPED } = ModuleStatusEnum;
      this.status = STOPPED;
      this.started = false;
      this.logger.info(LogSource.MODULES, 'Tasks module stopped');
    }
  }

  /**
   * Perform health check on the tasks module.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
  }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Tasks module not initialized',
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Tasks module not started',
      };
    }

    try {
      await this.taskService.getStatistics();
      return {
        healthy: true,
        message: 'Tasks module is healthy',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Tasks module unhealthy: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Get the task service.
   * @returns {ITaskService} Task service instance.
   * @throws {Error} If module not initialized.
   */
  getService(): ITaskService {
    if (!this.initialized) {
      throw new Error('Tasks module not initialized');
    }
    return this.taskService;
  }
}

/**
 * Factory function for creating the module.
 * @returns {TasksModule} Tasks module instance.
 */
export const createModule = (): TasksModule => {
  return new TasksModule();
};

/**
 * Initialize function for core module pattern.
 * @returns {Promise<TasksModule>} Initialized tasks module.
 */
export const initialize = async (): Promise<TasksModule> => {
  const tasksModule = new TasksModule();
  await tasksModule.initialize();
  return tasksModule;
};

/**
 * Gets the Tasks module with type safety and validation.
 * @returns The Tasks module with guaranteed typed exports.
 */
export const getTasksModule = (): IModule<ITasksModuleExports> => {
  return {
    name: 'tasks',
    type: 'core',
    version: '1.0.0',
    dependencies: ['logger', 'database'],
    status: ModuleStatusEnum.STOPPED,
    exports: {
      service: (): ITaskService => {
        return TaskService.getInstance();
      },
      TaskStatus: TaskStatusEnum,
      TaskExecutionStatus: TaskExecutionStatusEnum,
      TaskPriority: TaskPriorityEnum
    },
    initialize: async (): Promise<void> => {
      await Promise.resolve();
    },
    start: async (): Promise<void> => {
      await Promise.resolve();
    },
    stop: async (): Promise<void> => {
      await Promise.resolve();
    },
    healthCheck: async (): Promise<{ healthy: boolean }> => {
      return await Promise.resolve({ healthy: true });
    }
  };
};

export default TasksModule;
