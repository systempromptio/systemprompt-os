/**
 * Tasks module - Auto-generated type-safe implementation.
 * @file Tasks module entry point with full Zod validation.
 * @module modules/core/tasks
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import {
  TaskExecutionStatus,
  TaskPriority
} from '@/modules/core/tasks/types/manual';
import {
  type ITasksModuleExports,
  TasksModuleExportsSchema
} from '@/modules/core/tasks/types/tasks.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Tasks module implementation using BaseModule.
 * Provides task management services with full Zod validation.
 */
export class TasksModule extends BaseModule<ITasksModuleExports> {
  public readonly name = 'tasks' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Task queue and execution system for SystemPrompt OS';
  public readonly dependencies = ['logger', 'database', 'events'] as const;
  private taskService!: TaskService;
  get exports(): ITasksModuleExports {
    return {
      service: () => {
        this.ensureInitialized();
        return this.taskService as any;
      },
      TaskStatus,
      TaskExecutionStatus,
      TaskPriority
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return TasksModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.taskService = TaskService.getInstance();

    await this.taskService.initialize();
  }
}

/**
 * Create and return a new tasks module instance.
 * @returns A new tasks module instance.
 */
export const createModule = (): TasksModule => {
  return new TasksModule();
};

/**
 * Export module instance.
 */
export const tasksModule = new TasksModule();

/**
 * Initialize the tasks module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await tasksModule.initialize();
};

/**
 * Gets the Tasks module with type safety and validation.
 * This should only be used after bootstrap when the module loader is available.
 * @returns The Tasks module with guaranteed typed exports.
 * @throws {Error} If Tasks module is not available or missing required exports.
 */
export function getTasksModule(): TasksModule {
  const { getModuleRegistry } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/module-names.types');

  const registry = getModuleRegistry();
  const tasksModule = registry.get(ModuleName.TASKS);

  if (!tasksModule.exports?.service || typeof tasksModule.exports.service !== 'function') {
    throw new Error('Tasks module missing required service export');
  }

  if (!tasksModule.exports?.TaskStatus) {
    throw new Error('Tasks module missing required TaskStatus export');
  }

  if (!tasksModule.exports?.TaskExecutionStatus) {
    throw new Error('Tasks module missing required TaskExecutionStatus export');
  }

  if (!tasksModule.exports?.TaskPriority) {
    throw new Error('Tasks module missing required TaskPriority export');
  }

  return tasksModule as TasksModule;
}

export default TasksModule;
