/**
 * Tasks module - Auto-generated type-safe implementation.
 * @file Tasks module entry point with full Zod validation.
 * @module modules/core/tasks
 */

declare global {
  // eslint-disable-next-line vars-on-top, no-underscore-dangle
  var __MODULE_LOADER__: {
    getModuleRegistry(): Map<string, unknown>;
  };
}

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import {
  TaskExecutionStatus,
  TaskPriority
} from '@/modules/core/tasks/types/manual';
import {
  type ITasksModuleExports,
  type ITasksService,
  TasksModuleExportsSchema,
  TasksServiceSchema
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
      service: (): ITasksService => {
        this.ensureInitialized();
        const validatedService = this.validateServiceStructure(
          this.taskService,
          TasksServiceSchema,
          'TaskService'
        );
        return validatedService;
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
 * Validates that the module has all required exports.
 * @param mod - Module to validate.
 * @returns True if module has all required exports.
 */
const hasRequiredExports = (mod: unknown): mod is TasksModule => {
  if (mod === null || typeof mod !== 'object') {
    return false;
  }

  const moduleObj = mod as Record<string, unknown>;
  const { exports: moduleExports } = moduleObj;

  if (moduleExports === null || moduleExports === undefined) {
    return false;
  }

  if (typeof moduleExports !== 'object' || moduleExports === null) {
    return false;
  }

  const exportsObj = moduleExports as Record<string, unknown>;

  return (
    typeof exportsObj.service === 'function'
    && exportsObj.TaskStatus !== undefined
    && exportsObj.TaskExecutionStatus !== undefined
    && exportsObj.TaskPriority !== undefined
  );
};

/**
 * Helper function to get the global module loader.
 * @returns The global module loader or null if not available.
 */
const getGlobalModuleLoader = (): {
  getModuleRegistry(): Map<string, unknown>;
} | null => {
  const globalWithLoader = globalThis as {
    MODULE_LOADER?: {
      getModuleRegistry(): Map<string, unknown>;
    };
  };
  return globalWithLoader.MODULE_LOADER ?? null;
};

/**
 * Gets the Tasks module with type safety and validation.
 * This should only be used after bootstrap when the module loader is available.
 * @returns The Tasks module with guaranteed typed exports.
 * @throws {Error} If Tasks module is not available or missing required exports.
 */
export const getTasksModule = (): TasksModule => {
  try {
    const moduleLoader = getGlobalModuleLoader();
    if (moduleLoader === null) {
      throw new Error('Module loader not available');
    }

    const registry = moduleLoader.getModuleRegistry();
    const tasksModuleInstance = registry.get('TASKS');

    if (!hasRequiredExports(tasksModuleInstance)) {
      throw new Error('Tasks module missing required exports');
    }

    return tasksModuleInstance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get Tasks module: ${errorMessage}`);
  }
};

export default TasksModule;
