/**
 * Tasks module add CLI command.
 * @file Tasks module add CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import { TaskStatusEnum } from '@/modules/core/tasks/types/index';

/**
 * Extracts and validates CLI arguments for task creation.
 * @param options - CLI context options.
 * @returns Parsed task parameters.
 */
const extractTaskParameters = (options: CLIContext): {
  type: string;
  moduleId: string;
  instructionsStr: string | undefined;
  priority: number;
  status: string;
  maxExecutions: number;
  format: string;
} => {
  const { args } = options;
  const type = typeof args.type === 'string' ? args.type : '';

  const { moduleId: moduleIdArg, 'module-id': moduleIdKebab } = args;
  let moduleId = '';
  if (typeof moduleIdArg === 'string') {
    moduleId = moduleIdArg;
  } else if (typeof moduleIdKebab === 'string') {
    moduleId = moduleIdKebab;
  }

  const instructionsStr = typeof args.instructions === 'string'
    ? args.instructions
    : undefined;

  const priorityValue = Number(args.priority);
  const priority = Number.isNaN(priorityValue) ? 0 : priorityValue;

  const status = typeof args.status === 'string' ? args.status : 'pending';

  const maxExecutionsValue = Number(args.maxExecutions ?? args['max-executions']);
  const maxExecutions = Number.isNaN(maxExecutionsValue) ? 3 : maxExecutionsValue;

  const format = typeof args.format === 'string' ? args.format : 'table';

  return {
    type,
    moduleId,
    instructionsStr,
    priority,
    status,
    maxExecutions,
    format
  };
};

/**
 * Validates required task parameters.
 * @param type - Task type.
 * @param moduleId - Module ID.
 */
const validateRequiredParameters = (type: string, moduleId: string): void => {
  if (type.length === 0 || moduleId.length === 0) {
    process.stderr.write('Error: Task type and module-id are required\n');
    process.exit(1);
  }
};

/**
 * Parses and validates JSON instructions.
 * @param instructionsStr - Raw instructions string.
 * @returns Parsed instructions or undefined.
 */
const parseInstructions = (instructionsStr: string | undefined): unknown => {
  if (instructionsStr === undefined || instructionsStr.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(instructionsStr);
  } catch {
    process.stderr.write('Error: Instructions must be valid JSON\n');
    process.exit(1);
  }
};

/**
 * Validates task status against allowed values.
 * @param status - Status to validate.
 */
const validateStatus = (status: string): void => {
  const validStatuses = Object.values(TaskStatusEnum as Record<string, string>);
  const hasValidStatus = validStatuses.some((validStatus): boolean => {
    return String(validStatus) === String(status);
  });

  if (!hasValidStatus) {
    const validStatusList = validStatuses.join(', ');
    process.stderr.write(`Error: Invalid status. Valid values are: ${validStatusList}\n`);
    process.exit(1);
  }
};

/**
 * Outputs task creation result.
 * @param task - Created task.
 * @param task.id - Task ID.
 * @param task.type - Task type.
 * @param task.moduleId - Module ID.
 * @param task.status - Task status.
 * @param task.priority - Task priority.
 * @param task.maxExecutions - Maximum executions.
 * @param format - Output format.
 */
const outputResult = (task: {
  id?: number;
  type: string;
  moduleId: string;
  status: string;
  priority: number;
  maxExecutions: number;
}, format: string): void => {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(task, null, 2)}\n`);
    return;
  }

  process.stdout.write('\nTask added successfully!\n');
  process.stdout.write(`ID: ${String(task.id ?? 'N/A')}\n`);
  process.stdout.write(`Type: ${task.type}\n`);
  process.stdout.write(`Module: ${task.moduleId}\n`);
  process.stdout.write(`Status: ${task.status}\n`);
  process.stdout.write(`Priority: ${String(task.priority)}\n`);
  process.stdout.write(`Max Executions: ${String(task.maxExecutions)}\n`);
};

/**
 * Main execution function for task addition.
 * @param options - CLI context options.
 */
const executeAddTask = async (options: CLIContext): Promise<void> => {
  const params = extractTaskParameters(options);

  validateRequiredParameters(params.type, params.moduleId);

  const instructions = parseInstructions(params.instructionsStr);

  validateStatus(params.status);

  try {
    const tasksModule = getTasksModule();
    const taskService = tasksModule.exports.service();

    const taskStatus = Object.values(TaskStatusEnum as Record<string, string>).find(
      (validStatus): boolean => {
        return String(validStatus) === String(params.status);
      }
    );
    if (taskStatus === undefined) {
      throw new Error(`Invalid status: ${params.status}`);
    }

    const task = await taskService.addTask({
      type: params.type,
      moduleId: params.moduleId,
      instructions,
      priority: params.priority,
      status: taskStatus,
      maxExecutions: params.maxExecutions
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
      name: 'instructions',
      alias: 'i',
      type: 'string',
      description: 'Task instructions (JSON format)'
    },
    {
      name: 'module-id',
      alias: 'm',
      type: 'string',
      description: 'Module ID',
      required: true
    },
    {
      name: 'priority',
      alias: 'r',
      type: 'number',
      description: 'Task priority (higher = more important)',
      default: 0
    },
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Initial task status',
      default: 'pending'
    },
    {
      name: 'max-executions',
      alias: 'e',
      type: 'number',
      description: 'Maximum number of executions',
      default: 3
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (table or json)',
      default: 'table'
    }
  ],
  execute: executeAddTask
};

export default add;
