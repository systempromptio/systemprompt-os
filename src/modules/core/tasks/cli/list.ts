/**
 * Tasks module list CLI command.
 * @file Tasks module list CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import {
  type ITaskFilter,
  type ITaskRow,
  TaskStatus
} from '@/modules/core/tasks/types/index';

/**
 * Type guard to check if string is a valid TaskStatus.
 * @param value - String to check.
 * @returns True if value is a valid TaskStatus.
 */
const isValidTaskStatus = (value: string): value is TaskStatus => {
  const validValues: string[] = Object.values(TaskStatus as Record<string, string>);
  return validValues.includes(value);
};

/**
 * Builds task filter from CLI arguments.
 * @param args - CLI context arguments.
 * @returns Task filter object.
 */
const buildTaskFilter = (args: CLIContext['args']): ITaskFilter => {
  const filter: ITaskFilter = {};

  if (args.status !== undefined && typeof args.status === 'string') {
    filter.status = args.status as TaskStatus;
  }

  if (args.type !== undefined && typeof args.type === 'string') {
    filter.type = args.type;
  }

  if (args.moduleId !== undefined && typeof args.moduleId === 'string') {
    filter.module_id = args.moduleId;
  } else if (args['module-id'] !== undefined && typeof args['module-id'] === 'string') {
    filter.module_id = args['module-id'];
  }

  if (args.limit !== undefined && typeof args.limit === 'number') {
    filter.limit = args.limit;
  }

  if (args.offset !== undefined && typeof args.offset === 'number') {
    filter.offset = args.offset;
  }

  return filter;
};

/**
 * Display tasks in table format.
 * @param tasks - Array of tasks to display.
 */
const displayTableOutput = (tasks: ITaskRow[]): void => {
  if (tasks.length === 0) {
    process.stdout.write('No tasks found\n');
    return;
  }

  process.stdout.write('ID\tType\tModule\tStatus\tPriority\n');
  process.stdout.write('--\t----\t------\t------\t--------\n');

  for (const task of tasks) {
    displayTaskRow(task);
  }
};

/**
 * Display a single task row.
 * @param task - Task to display.
 */
const displayTaskRow = (task: ITaskRow): void => {
  const {
    id,
    type,
    module_id,
    status = TaskStatus.PENDING,
    priority = 0
  } = task;

  const truncateString = (str: string, maxLength: number): string => {
    if (str.length > maxLength) {
      return `${str.substring(0, maxLength - 3)}...`;
    }
    return str;
  };

  const idStr = String(id);
  const typeStr = truncateString(type, 20);
  const moduleStr = truncateString(module_id, 15);
  const statusStr = truncateString(String(status), 15);
  const priorityStr = String(priority);

  const row = `${idStr}\t${typeStr}\t${moduleStr}\t${statusStr}\t${priorityStr}\n`;
  process.stdout.write(row);
};

/**
 * Display tasks in JSON format.
 * @param tasks - Array of tasks to display.
 */
const displayJsonOutput = (tasks: ITaskRow[]): void => {
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
      choices: Object.values(TaskStatus as Record<string, string>)
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
