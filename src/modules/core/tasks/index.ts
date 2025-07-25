/**
 * Core tasks module - provides task queue and execution system.
 * @file Core tasks module - provides task queue and execution system.
 * @module modules/core/tasks
 */

import { TaskService } from '@/modules/core/tasks/services/task.service';
import type { ITaskService, ITasksModuleExports } from '@/modules/core/tasks/types/index';
import {
 TaskExecutionStatus, TaskPriority, TaskStatus
} from '@/modules/core/tasks/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
/**
 * Module interface to avoid circular dependency.
 */
interface ITasksModule<T = unknown> {
  readonly name: string;
  readonly version: string;
  readonly type?: string;
  readonly dependencies?: readonly string[];
  status: string;
  readonly exports?: T;
  setDependencies?(modules: Map<string, ITasksModule>): void;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Tasks module implementation.
 * @class TasksModule
 */
export class TasksModule implements ITasksModule<ITasksModuleExports> {
  public readonly name = 'tasks';
  public readonly type = 'core' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Task queue and execution system for SystemPrompt OS';
  public readonly dependencies: string[] = ['logger', 'database'];
  public status = 'stopped';
  private taskService!: TaskService;
  private logger!: ILogger;
  private database!: DatabaseService;
  private initialized = false;
  private started = false;
  get exports(): ITasksModuleExports {
    return {
      service: () => { return this.taskService },
      TaskStatus,
      TaskExecutionStatus,
      TaskPriority
    };
  }

  /**
   * Set module dependencies.
   * @param modules - Map of available modules.
   */
  setDependencies(modules: Map<string, ITasksModule>): void {
    const loggerModule = modules.get('logger');
    const databaseModule = modules.get('database');

    if (!loggerModule) {
      throw new Error('Logger module not found');
    }

    if (!databaseModule) {
      throw new Error('Database module not found');
    }

    const loggerExports = loggerModule.exports as any;
    const databaseExports = databaseModule.exports as any;

    this.logger = loggerExports.service();
    this.database = databaseExports.service();
  }

  /**
   * Initialize the tasks module.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    this.database = DatabaseService.getInstance();
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Tasks module already initialized');
    }

    try {
      this.taskService = TaskService.getInstance();

      if (!this.logger || !this.database) {
        throw new Error('Dependencies not set. Call setDependencies first.');
      }

      await this.taskService.initialize(this.logger, this.database);

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Tasks module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize tasks module: ${errorMessage}`);
    }
  }

  /**
   * Start the tasks module.
   * @returns {Promise<void>} Promise that resolves when started.
   * @throws {Error} If module not initialized or already started.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Tasks module not initialized');
    }

    if (this.started) {
      throw new Error('Tasks module already started');
    }

    this.status = 'running';
    this.started = true;

    this.logger.info(LogSource.MODULES, 'Tasks module started');
  }

  /**
   * Stop the tasks module.
   * @returns {Promise<void>} Promise that resolves when stopped.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = 'stopping';
      this.started = false;
      this.status = 'stopped';
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
        message: `Tasks module unhealthy: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  return tasksModule;
};

/**
 * Default export of initialize for module pattern.
 */
export default initialize;
