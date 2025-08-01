/**
 * Tasks module list CLI command.
 * @file Tasks module list CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import { type ITaskFilter } from '@/modules/core/tasks/types/manual';
import type { ITask } from '@/modules/core/tasks/types/tasks.module.generated';

/**
 * Type guard to check if string is a valid TaskStatus.
 * @param value - String to check.
 * @returns True if value is a valid TaskStatus.
 */
const isValidTaskStatus = (value: string): value is TaskStatus => {
  const validValues = Object.values(TaskStatus);
  return validValues.includes(value as any);
};

/**
 * Type guard to check if ITask is a task row (not task metadata).
 * @param task - Task to check.
 * @returns True if task is a task row.
 */
const isTaskRow = (task: ITask): task is ITask & {
  type: string;
  module_id: string;
  status: TaskStatus | null;
  priority: number | null;
} => {
  return 'type' in task && 'module_id' in task;
};

/**
 * Builds task filter from CLI arguments.
 * @param args - CLI context arguments.
 * @returns Task filter object.
 */
const buildTaskFilter = (args: CLIContext['args']): ITaskFilter => {
  const {
    status,
    type,
    moduleId,
    'module-id': moduleIdKebab,
    limit,
    offset
  } = args;

  const moduleIdValue = moduleId ?? moduleIdKebab;
  const filter: ITaskFilter = {};

  if (typeof status === 'string' && isValidTaskStatus(status)) { filter.status = status; }
  if (typeof type === 'string') { filter.type = type; }
  if (typeof moduleIdValue === 'string') { filter.module_id = moduleIdValue; }
  if (typeof limit === 'number') { filter.limit = limit; }
  if (typeof offset === 'number') { filter.offset = offset; }

  return filter;
};

/**
 * Truncates a string to the specified maximum length.
 * @param str - String to truncate.
 * @param maxLength - Maximum allowed length.
 * @returns Truncated string.
 */
const truncateString = (str: string, maxLength: number): string => {
  if (str.length > maxLength) {
    return `${str.substring(0, maxLength - 3)}...`;
  }
  return str;
};

/**
 * Display a single task row.
 * @param task - Task to display.
 */
const displayTaskRow = (task: ITask): void => {
  if (!isTaskRow(task)) {
    return;
  }

  const taskRow = task
  const {
    id,
    type,
    module_id,
    status = TaskStatus.PENDING,
    priority = 0
  } = taskRow;

  const idStr = String(id);
  const typeStr = truncateString(type, 20);
  const moduleStr = truncateString(module_id, 15);
  const statusStr = truncateString(String(status), 15);
  const priorityStr = String(priority);

  const row = `${idStr}\t${typeStr}\t${moduleStr}\t${statusStr}\t${priorityStr}\n`;
  process.stdout.write(row);
};

/**
 * Display tasks in table format.
 * @param tasks - Array of tasks to display.
 */
const displayTableOutput = (tasks: ITask[]): void => {
  const taskRows = tasks.filter(isTaskRow);

  if (taskRows.length === 0) {
    process.stdout.write('No tasks found\n');
    return;
  }

  process.stdout.write('ID\tType\tModule\tStatus\tPriority\n');
  process.stdout.write('--\t----\t------\t------\t--------\n');

  for (const task of taskRows) {
    displayTaskRow(task);
  }
};

/**
 * Display tasks in JSON format.
 * @param tasks - Array of tasks to display.
 */
const displayJsonOutput = (tasks: ITask[]): void => {
  const output = JSON.stringify(tasks, null, 2);
  process.stdout.write(`${output}\n`);
};

/**
 * Validate task status argument.
 * @param status - Status value to validate.
 */
const validateStatus = (status: unknown): void => {
  if (status !== undefined && typeof status === 'string' && !isValidTaskStatus(status)) {
    process.stderr.write(`Error: Invalid status value: ${status}\n`);
    process.stderr.write(`Valid values: ${Object.values(TaskStatus).join(', ')}\n`);
    process.exit(1);
  }
};

/**
 * Execute the list command.
 * @param args - CLI context.
 * @returns Promise that resolves when command completes.
 */
const executeTasks = async (args: CLIContext): Promise<void> => {
  validateStatus(args.args.status);

  const filter = buildTaskFilter(args.args);

  try {
    const tasksModule = getTasksModule();
    const taskService = tasksModule.exports.service();
    const tasks = await taskService.listTasks(filter);

    if (args.args.format === 'json') {
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
  description: 'List tasks in the system',
  options: [
    {
      name: 'status',
      description: 'Filter by task status',
      type: 'string',
      choices: Object.values(TaskStatus)
    },
    {
      name: 'type',
      description: 'Filter by task type',
      type: 'string'
    },
    {
      name: 'module-id',
      description: 'Filter by module ID',
      type: 'string'
    },
    {
      name: 'limit',
      description: 'Maximum number of tasks to return',
      type: 'number',
      default: 100
    },
    {
      name: 'offset',
      description: 'Number of tasks to skip',
      type: 'number',
      default: 0
    },
    {
      name: 'format',
      description: 'Output format',
      type: 'string',
      choices: ['table', 'json'],
      default: 'table'
    }
  ],
  execute: executeTasks
};

export default list;
