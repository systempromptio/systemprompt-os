/**
 * Tasks module delete CLI command.
 * @file Tasks module delete CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { validateCliArgs } from '@/modules/core/tasks/utils/cli-validation';

/**
 * Execute delete command.
 * @param context - CLI context.
 * @returns Promise that resolves when tasks are deleted.
 */
const executeDelete = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const validatedArgs = validateCliArgs('delete', context.args, cliOutput);
    if (!validatedArgs) {
      process.exit(1);
    }

    const {
 type, format, confirm
} = validatedArgs;

    if (!confirm) {
      cliOutput.error('This operation will cancel all tasks of the specified type. Use --confirm true to proceed.');
      cliOutput.info('Example: ./bin/systemprompt tasks delete --type "development" --confirm true');
      process.exit(1);
    }

    const taskService = TaskService.getInstance();

    const tasks = await taskService.listTasks({
      type,
      limit: 1000,
      offset: 0
    });

    const matchingTasksCount = tasks.length;

    if (matchingTasksCount === 0) {
      if (format === 'json') {
        cliOutput.json({
          deleted: 0,
          message: `No tasks found with type '${type}'`
        });
      } else {
        cliOutput.info(`No tasks found with type '${type}' to delete.`);
      }
      process.exit(0);
    }

    cliOutput.section('Deletion Preview');
    cliOutput.keyValue({
      'Task Type': type,
      'Tasks to Delete': matchingTasksCount,
      'Action': 'PERMANENT DELETION'
    });

    let deletedCount = 0;
    const deletePromises = tasks.map(async (task) => {
      try {
        await taskService.cancelTask(task.id);
        deletedCount++;
      } catch (error) {
        logger.error(LogSource.TASKS, `Failed to cancel task ${task.id}`, { error: error instanceof Error ? error : new Error(String(error)) });
      }
    });

    await Promise.allSettled(deletePromises);

    if (format === 'json') {
      cliOutput.json({
        deleted: deletedCount,
        requested: matchingTasksCount,
        type,
        success: deletedCount === matchingTasksCount
      });
    } else {
      if (deletedCount === matchingTasksCount) {
        cliOutput.success(`Successfully deleted all ${deletedCount} tasks of type '${type}'`);
      } else {
        cliOutput.warning(`Deleted ${deletedCount} out of ${matchingTasksCount} tasks of type '${type}'`);
        cliOutput.info('Some tasks may have failed to delete. Check logs for details.');
      }

      cliOutput.section('Summary');
      cliOutput.keyValue({
        'Tasks Deleted': deletedCount,
        'Tasks Requested': matchingTasksCount,
        'Success Rate': `${Math.round(deletedCount / matchingTasksCount * 100)}%`
      });
    }

    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error deleting tasks: ${errorMessage}`);
    logger.error(LogSource.TASKS, 'Delete command failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
};

/**
 * Tasks delete command.
 */
export const command: ICLICommand = {
  description: 'Cancel all tasks of a specific type (requires confirmation)',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Task type to cancel (e.g., "development", "maintenance")',
      required: true
    },
    {
      name: 'confirm',
      alias: 'c',
      type: 'boolean',
      description: 'Confirm deletion (required for safety)',
      default: false,
      required: true
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      default: 'text',
      choices: ['text', 'json']
    }
  ],
  execute: executeDelete
};

export default command;
