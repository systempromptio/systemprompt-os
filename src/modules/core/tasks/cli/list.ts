/**
 * Tasks module list CLI command.
 * @file Tasks module list CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import {
  type ITask,
  type ITaskFilter,
  TaskStatusEnum
} from '@/modules/core/tasks/types/index';

/**
 * Type guard to check if string is a valid TaskStatusEnum.
 * @param value - String to check.
 * @returns True if value is a valid TaskStatusEnum.
 */
const isValidTaskStatus = (value: string): value is TaskStatusEnum => {
  const validValues: string[] = Object.values(TaskStatusEnum as Record<string, string>);
  return validValues.includes(value);
};

/**
 * Extract and validate command arguments.
 * @param context - CLI context.
 * @returns Parsed arguments.
 */
const extractListArgs = (context: CLIContext): {
  limit: number;
  status: string | undefined;
  format: string;
} => {
  const { args } = context;

  const limit = typeof args.limit === 'number' ? args.limit : 
                typeof args.limit === 'string' ? parseInt(args.limit, 10) : 10;
  const status = typeof args.status === 'string' ? args.status : undefined;
  const format = typeof args.format === 'string' ? args.format : 'table';

  return {
    limit,
    status,
    format
  };
};

/**
 * Build task filter from arguments.
 * @param args - Parsed arguments.
 * @param args.limit - Maximum number of tasks.
 * @param args.status - Status filter.
 * @param args.format - Output format.
 * @returns Task filter object.
 */
const buildTaskFilter = (args: {
  limit: number;
  status: string | undefined;
  format: string;
}): ITaskFilter => {
  const filter: ITaskFilter = { limit: args.limit };

  const { status } = args;
  if (status !== undefined && isValidTaskStatus(status)) {
    filter.status = status;
  }

  return filter;
};

/**
 * Display tasks in JSON format.
 * @param tasks - Array of tasks to display.
 */
const displayJsonOutput = (tasks: ITask[]): void => {
  process.stdout.write(`${JSON.stringify(tasks, null, 2)}\n`);
};

/**
 * Display table header.
 */
const displayTableHeader = (): void => {
  process.stdout.write('\nTask Queue\n');
  process.stdout.write('==========\n\n');
  process.stdout.write('ID\tType\t\tModule\t\tStatus\t\tPriority\n');
  process.stdout.write('--\t----\t\t------\t\t------\t\t--------\n');
};

/**
 * Display a single task row.
 * @param task - Task to display.
 */
const displayTaskRow = (task: ITask): void => {
  const {
    id,
    type,
    moduleId,
    status,
    priority
  } = task;

  const idStr = String(id ?? 'N/A');
  const priorityStr = String(priority);
  const row = `${idStr}\t${type}\t${moduleId}\t${status}\t${priorityStr}\n`;
  process.stdout.write(row);
};

/**
 * Display tasks in table format.
 * @param tasks - Array of tasks to display.
 */
const displayTableOutput = (tasks: ITask[]): void => {
  displayTableHeader();

  if (tasks.length === 0) {
    process.stdout.write('No tasks found.\n');
    return;
  }

  for (const task of tasks) {
    displayTaskRow(task);
  }
};

/**
 * Execute list command.
 * @param context - CLI context.
 * @returns Promise that resolves when listing is complete.
 */
const executeList = async (context: CLIContext): Promise<void> => {
  const args = extractListArgs(context);
  const filter = buildTaskFilter(args);

  try {
    const tasksModule = getTasksModule();
    const taskService = tasksModule.exports.service();
    const tasks = await taskService.listTasks(filter);

    if (args.format === 'json') {
      displayJsonOutput(tasks);
    } else {
      displayTableOutput(tasks);
    }
  } catch (error) {
    process.stderr.write(`Error: ${String(error)}\n`);
    process.exit(1);
  }
};

/**
 * Tasks list command.
 */
export const list: CLICommand = {
  name: 'list',
  description: 'List tasks in the queue',
  options: [
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Filter by task status',
      choices: Object.values(TaskStatusEnum as Record<string, string>)
    },
    {
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Number of tasks to show',
      default: 10
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (table or json)',
      default: 'table'
    }
  ],
  execute: executeList
};

export default list;
