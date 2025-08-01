/**
 * Tasks module add CLI command.
 * @file Tasks module add CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import type { ITask } from '@/modules/core/tasks/types/tasks.module.generated';

/**
 * Extracts and validates CLI arguments for task creation.
 * @param options - CLI context options.
 * @returns Parsed task parameters.
 */
const extractTaskParameters = (options: CLIContext): {
  type: string;
  module_id: string;
  instructions: string | null;
  priority: number;
  status: string;
  max_executions: number;
  format: string;
} => {
  const { args } = options;
  const type = typeof args.type === 'string' ? args.type : '';

  const { 'module-id': moduleIdKebab } = args;
  const module_id = typeof moduleIdKebab === 'string' ? moduleIdKebab : '';

  const { instructions: instructionsArg } = args;
  const instructions = typeof instructionsArg === 'string' ? instructionsArg : null;

  const priorityValue = Number(args.priority);
  const priority = Number.isNaN(priorityValue) ? 0 : priorityValue;

  const { status: statusArg } = args;
  const status = typeof statusArg === 'string' ? statusArg : 'pending';

  const maxExecutionsValue = Number(args['max-executions']);
  const max_executions = Number.isNaN(maxExecutionsValue) ? 3 : maxExecutionsValue;

  const format = typeof args.format === 'string' ? args.format : 'table';

  return {
    type,
    module_id,
    instructions,
    priority,
    status,
    max_executions,
    format
  };
};

/**
 * Validates required task parameters.
 * @param type - Task type.
 * @param module_id - Module ID.
 */
const validateRequiredParameters = (type: string, module_id: string): void => {
  if (type.length === 0 || module_id.length === 0) {
    process.stderr.write('Error: Task type and module-id are required\n');
    process.exit(1);
  }
};

/**
 * Validates task status against allowed values.
 * @param status - Status to validate.
 * @returns True if status is valid.
 */
const validateStatus = (status: string): status is TaskStatus => {
  const validStatuses = Object.values(TaskStatus);
  const hasValidStatus = validStatuses.some(
    (validStatus): boolean => { return String(validStatus) === status }
  );

  if (!hasValidStatus) {
    process.stderr.write(`Error: Invalid status. Valid values are: ${validStatuses.join(', ')}\n`);
    process.exit(1);
  }

  return hasValidStatus;
};

/**
 * Output task result.
 * @param task - Created task.
 * @param format - Output format.
 */
const outputResult = (task: ITask, format: string): void => {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(task, null, 2)}\n`);
    return;
  }

  if ('type' in task && 'module_id' in task) {
    process.stdout.write('\nTask added successfully!\n');
    process.stdout.write(`ID: ${String(task.id)}\n`);
    process.stdout.write(`Type: ${task.type}\n`);
    process.stdout.write(`Module: ${task.module_id}\n`);
    process.stdout.write(`Status: ${String(task.status ?? 'pending')}\n`);
    process.stdout.write(`Priority: ${String(task.priority ?? 0)}\n`);
    process.stdout.write(`Max Executions: ${String(task.max_executions ?? 3)}\n`);
  } else {
    process.stderr.write('Error: Invalid task data returned\n');
    process.exit(1);
  }
};

/**
 * Main execution function for task addition.
 * @param options - CLI context options.
 * @returns Promise that resolves when task is added.
 */
const executeAddTask = async (options: CLIContext): Promise<void> => {
  const params = extractTaskParameters(options);

  validateRequiredParameters(params.type, params.module_id);

  if (!validateStatus(params.status)) {
    return
  }

  try {
    const tasksModule = getTasksModule();
    const taskService = tasksModule.exports.service();

    const task = await taskService.addTask({
      type: params.type,
      module_id: params.module_id,
      instructions: params.instructions,
      priority: params.priority,
      status: params.status,
      max_executions: params.max_executions
    });

    outputResult(task, params.format);
  } catch (error) {
    process.stderr.write(`Error: ${String(error)}\n`);
    process.exit(1);
  }
};

/**
 * Tasks add command.
 */
export const add: CLICommand = {
  name: 'add',
  description: 'Add a new task to the queue',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Task type',
      required: true
    },
    {
      name: 'module-id',
      alias: 'm',
      type: 'string',
      description: 'Module ID',
      required: true
    },
    {
      name: 'instructions',
      alias: 'i',
      type: 'string',
      description: 'Task instructions (JSON string)'
    },
    {
      name: 'priority',
      alias: 'p',
      type: 'number',
      description: 'Task priority (default: 0)',
      default: 0
    },
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Initial task status',
      default: 'pending',
      choices: Object.values(TaskStatus)
    },
    {
      name: 'max-executions',
      type: 'number',
      description: 'Maximum number of execution attempts',
      default: 3
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      default: 'table',
      choices: ['table', 'json']
    }
  ],
  execute: executeAddTask
};

export default add;
