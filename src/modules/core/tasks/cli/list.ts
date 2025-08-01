/**
 * Tasks module list CLI command.
 * @file Tasks module list CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import { type ListTasksArgs, validateCliArgs } from '@/modules/core/tasks/utils/cli-validation';
import type { ITaskFilter } from '@/modules/core/tasks/types/manual';
import type { ITask } from '@/modules/core/tasks/types/tasks.module.generated';

/**
 * Execute the list command.
 * @param context - CLI context.
 * @returns Promise that resolves when command completes.
 */
const executeList = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const validatedArgs = validateCliArgs('list', context.args, cliOutput);
    if (!validatedArgs) {
      process.exit(1);
    }

    const {
      format,
      status,
      type,
      module_id,
      limit,
      offset,
      page,
      sortBy,
      sortOrder
    } = validatedArgs;

    const filter: ITaskFilter = {
      ...status && { status },
      ...type && { type },
      ...module_id && { module_id },
      limit,
      offset: offset || (page - 1) * limit,
      sortBy,
      sortOrder
    };

    const taskService = TaskService.getInstance();
    const tasks = await taskService.listTasks(filter);

    if (format === 'json') {
      cliOutput.json(tasks);
    } else {
      if (tasks.length === 0) {
        cliOutput.info('No tasks found');
        process.exit(0);
      }

      cliOutput.section(`Tasks (${tasks.length} found)`);

      const taskRows = tasks.filter((task: ITask): boolean => {
        return 'type' in task && 'module_id' in task;
      });

      cliOutput.table(taskRows, [
        {
          key: 'id',
          header: 'ID',
          width: 6,
          format: (v) => { return String(v || '') }
        },
        {
          key: 'type',
          header: 'Type',
          width: 20,
          format: (v) => { return String(v || '') }
        },
        {
          key: 'module_id',
          header: 'Module',
          width: 15,
          format: (v) => { return String(v || '') }
        },
        {
          key: 'status',
          header: 'Status',
          width: 12,
          format: (v) => { return String(v || 'pending') }
        },
        {
          key: 'priority',
          header: 'Priority',
          width: 8,
          format: (v) => { return String(v || '0') }
        },
        {
          key: 'progress',
          header: 'Progress',
          width: 10,
          format: (v) => { return v ? `${v}%` : '-' }
        },
        {
          key: 'created_at',
          header: 'Created',
          width: 12,
          format: (v) => {
            return v ? new Date(v).toLocaleDateString() : '-';
          }
        }
      ]);
    }

    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error listing tasks: ${errorMessage}`);
    logger.error(LogSource.TASKS, 'List command failed', { error });
    process.exit(1);
  }
};

/**
 * Tasks list command.
 */
export const command: ICLICommand = {
  description: 'List tasks in the queue',
  options: [
    {
      name: 'status',
      alias: 's',
      description: 'Filter by task status',
      type: 'string',
      choices: Object.values(TaskStatus)
    },
    {
      name: 'type',
      alias: 't',
      description: 'Filter by task type',
      type: 'string'
    },
    {
      name: 'module_id',
      alias: 'm',
      description: 'Filter by module ID',
      type: 'string'
    },
    {
      name: 'limit',
      alias: 'l',
      description: 'Maximum number of tasks to return',
      type: 'number',
      default: 20
    },
    {
      name: 'offset',
      alias: 'o',
      description: 'Number of tasks to skip',
      type: 'number',
      default: 0
    },
    {
      name: 'page',
      alias: 'p',
      description: 'Page number (alternative to offset)',
      type: 'number',
      default: 1
    },
    {
      name: 'sortBy',
      description: 'Sort by field',
      type: 'string',
      choices: ['created_at', 'updated_at', 'priority', 'status'],
      default: 'created_at'
    },
    {
      name: 'sortOrder',
      description: 'Sort order',
      type: 'string',
      choices: ['asc', 'desc'],
      default: 'desc'
    },
    {
      name: 'format',
      alias: 'f',
      description: 'Output format',
      type: 'string',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: executeList
};

export default command;
