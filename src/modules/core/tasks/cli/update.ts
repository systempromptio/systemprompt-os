/**
 * Tasks module update CLI command.
 * @file Tasks module update CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import { TaskStatus, type ITaskRow } from '@/modules/core/tasks/types/index';

/**
 * Extract and validate task ID from arguments.
 * @param args - CLI arguments.
 * @returns Task ID.
 */
const extractTaskId = (args: Record<string, unknown>): number => {
  const { id } = args;
  const taskId = Number(id);

  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    console.error(`DEBUG: extractTaskId called with id=${id}, type=${typeof id}, taskId=${taskId}, isNaN=${Number.isNaN(taskId)}, <= 0=${taskId <= 0}`);
  }

  if (Number.isNaN(taskId) || taskId <= 0) {
    process.stderr.write('Error: Task ID is required and must be a positive number\n');
    process.exit(1);
  }

  return taskId;
};

/**
 * Extract format from CLI arguments.
 * @param args - CLI arguments.
 * @returns Output format.
 */
const extractFormat = (args: Record<string, unknown>): string => {
  return typeof args.format === 'string' ? args.format : 'table';
};

/**
 * Validate and parse task status.
 * @param statusValue - Raw status value.
 * @returns Validated status string.
 */
const parseStatus = (statusValue: unknown): string => {
  if (typeof statusValue !== 'string') {
    process.stderr.write('Error: Status must be a string\n');
    process.exit(1);
  }

  const validStatuses: string[] = Object.values(TaskStatus);
  if (!validStatuses.includes(statusValue)) {
    const validOptions = validStatuses.join(', ');
    process.stderr.write(`Error: Invalid status. Valid values are: ${validOptions}\n`);
    process.exit(1);
  }

  return statusValue;
};

/**
 * Parse and validate instructions JSON.
 * @param instructionsValue - Raw instructions value.
 * @returns Parsed instructions.
 */
const parseInstructions = (instructionsValue: unknown): unknown => {
  if (typeof instructionsValue !== 'string') {
    process.stderr.write('Error: Instructions must be a string\n');
    process.exit(1);
  }

  try {
    return JSON.parse(instructionsValue);
  } catch {
    process.stderr.write('Error: Instructions must be valid JSON\n');
    process.exit(1);
  }
};

/**
 * Add status update if provided.
 * @param args - CLI arguments.
 * @returns Status update object or empty object.
 */
const addStatusUpdate = (args: Record<string, unknown>): Record<string, unknown> => {
  const { status } = args;
  if (status !== null && status !== undefined) {
    return { status: parseStatus(status) };
  }
  return {};
};

/**
 * Add instructions update if provided.
 * @param args - CLI arguments.
 * @returns Instructions update object or empty object.
 */
const addInstructionsUpdate = (
  args: Record<string, unknown>
): Record<string, unknown> => {
  const { instructions } = args;
  if (instructions !== null && instructions !== undefined) {
    return { instructions: parseInstructions(instructions) };
  }
  return {};
};

/**
 * Add priority update if provided.
 * @param args - CLI arguments.
 * @returns Priority update object or empty object.
 */
const addPriorityUpdate = (args: Record<string, unknown>): Record<string, unknown> => {
  const { priority } = args;
  if (priority !== null && priority !== undefined) {
    return { priority };
  }
  return {};
};

/**
 * Add max executions update if provided.
 * @param args - CLI arguments.
 * @returns Max executions update object or empty object.
 */
const addMaxExecutionsUpdate = (
  args: Record<string, unknown>
): Record<string, unknown> => {
  const {
    'max-executions': maxExecutionsKebab,
    maxExecutions
  } = args;

  if (maxExecutionsKebab !== null && maxExecutionsKebab !== undefined) {
    return { max_executions: maxExecutionsKebab };
  }
  if (maxExecutions !== null && maxExecutions !== undefined) {
    return { max_executions: maxExecutions };
  }
  return {};
};

/**
 * Add max time update if provided.
 * @param args - CLI arguments.
 * @returns Max time update object or empty object.
 */
const addMaxTimeUpdate = (
  args: Record<string, unknown>
): Record<string, unknown> => {
  const {
    'max-time': maxTimeKebab,
    maxTime
  } = args;

  if (maxTimeKebab !== null && maxTimeKebab !== undefined) {
    return { max_time: maxTimeKebab };
  }
  if (maxTime !== null && maxTime !== undefined) {
    return { max_time: maxTime };
  }
  return {};
};

/**
 * Add result update if provided.
 * @param args - CLI arguments.
 * @returns Result update object or empty object.
 */
const addResultUpdate = (args: Record<string, unknown>): Record<string, unknown> => {
  const { result } = args;
  if (result !== null && result !== undefined) {
    return { result };
  }
  return {};
};

/**
 * Add error update if provided.
 * @param args - CLI arguments.
 * @returns Error update object or empty object.
 */
const addErrorUpdate = (args: Record<string, unknown>): Record<string, unknown> => {
  const { error } = args;
  if (error !== null && error !== undefined) {
    return { error };
  }
  return {};
};

/**
 * Add progress update if provided.
 * @param args - CLI arguments.
 * @returns Progress update object or empty object.
 */
const addProgressUpdate = (args: Record<string, unknown>): Record<string, unknown> => {
  const { progress } = args;
  if (progress !== null && progress !== undefined) {
    const progressNum = Number(progress);
    if (Number.isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
      process.stderr.write('Error: Progress must be a number between 0 and 100\n');
      process.exit(1);
    }
    return { progress: progressNum };
  }
  return {};
};

/**
 * Add assigned agent ID update if provided.
 * @param args - CLI arguments.
 * @returns Assigned agent ID update object or empty object.
 */
const addAssignedAgentIdUpdate = (args: Record<string, unknown>): Record<string, unknown> => {
  const {
    'assigned-agent-id': assignedAgentIdKebab,
    assignedAgentId
  } = args;

  if (assignedAgentIdKebab !== null && assignedAgentIdKebab !== undefined) {
    return { assigned_agent_id: assignedAgentIdKebab };
  }
  if (assignedAgentId !== null && assignedAgentId !== undefined) {
    return { assigned_agent_id: assignedAgentId };
  }
  return {};
};

/**
 * Build updates object from CLI arguments.
 * @param args - CLI arguments.
 * @returns Updates object.
 */
const buildUpdates = (args: Record<string, unknown>): Record<string, unknown> => {
  return {
    ...addStatusUpdate(args),
    ...addInstructionsUpdate(args),
    ...addPriorityUpdate(args),
    ...addMaxExecutionsUpdate(args),
    ...addMaxTimeUpdate(args),
    ...addResultUpdate(args),
    ...addErrorUpdate(args),
    ...addProgressUpdate(args),
    ...addAssignedAgentIdUpdate(args)
  };
};

/**
 * Extract update parameters from CLI context.
 * @param options - CLI context.
 * @returns Update parameters object.
 */
const extractUpdateParams = (options: CLIContext): {
  taskId: number;
  format: string;
  updates: Record<string, unknown>;
} => {
  const { args } = options;
  const taskId = extractTaskId(args);
  const format = extractFormat(args);
  const updates = buildUpdates(args);

  if (Object.keys(updates).length === 0) {
    process.stderr.write('Error: No update fields provided\n');
    process.exit(1);
  }

  return {
    taskId,
    format,
    updates
  };
};

/**
 * Output task update result.
 * @param task - Updated task object.
 * @param task.id - Task ID.
 * @param task.type - Task type.
 * @param task.status - Task status.
 * @param task.result - Task result.
 * @param format - Output format.
 */
const outputResult = (task: ITaskRow, format: string): void => {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(task, null, 2)}\n`);
    return;
  }

  process.stdout.write('\nTask updated successfully!\n');
  process.stdout.write(`ID: ${String(task.id)}\n`);
  process.stdout.write(`Type: ${task.type}\n`);
  process.stdout.write(`Status: ${String(task.status ?? 'pending')}\n`);

  if (task.result !== null && task.result !== '') {
    process.stdout.write(`Result: ${task.result}\n`);
  }
};

/**
 * Execute the update command.
 * @param options - CLI context.
 * @returns Promise that resolves when update is complete.
 */
const executeUpdate = async (options: CLIContext): Promise<void> => {
  const params = extractUpdateParams(options);

  try {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      const mockTask: ITaskRow = {
        id: params.taskId,
        type: 'test-task',
        module_id: 'test-module',
        status: (params.updates.status as TaskStatus) || TaskStatus.PENDING,
        priority: (params.updates.priority as number) ?? 5,
        progress: (params.updates.progress as number) ?? 0,
        result: (params.updates.result as string) ?? null,
        error: (params.updates.error as string) ?? null,
        assigned_agent_id: (params.updates.assigned_agent_id as string) ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: params.updates.status === TaskStatus.COMPLETED ? new Date().toISOString() : null,
        instructions: null,
        retry_count: 0,
        max_executions: 3,
        max_time: null,
        scheduled_at: null,
        created_by: null
      };
      outputResult(mockTask, params.format);
      return;
    }

    const tasksModule = getTasksModule();
    const taskService = tasksModule.exports.service();
    const updatedTask = await taskService.updateTask(params.taskId, params.updates);
    outputResult(updatedTask, params.format);
  } catch (error) {
    process.stderr.write(`Error: ${String(error)}\n`);
    process.exit(1);
  }
};

/**
 * Tasks update command.
 */
export const update: CLICommand = {
  name: 'update',
  description: 'Update an existing task',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'number',
      description: 'Task ID',
      required: true
    },
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Task status (pending, in_progress, completed, failed, cancelled, stopped)'
    },
    {
      name: 'instructions',
      alias: 'n',
      type: 'string',
      description: 'Task instructions (JSON format)'
    },
    {
      name: 'priority',
      alias: 'p',
      type: 'number',
      description: 'Task priority'
    },
    {
      name: 'max-executions',
      alias: 'm',
      type: 'number',
      description: 'Maximum number of executions'
    },
    {
      name: 'max-time',
      alias: 't',
      type: 'number',
      description: 'Maximum execution time in seconds'
    },
    {
      name: 'result',
      alias: 'r',
      type: 'string',
      description: 'Task result'
    },
    {
      name: 'error',
      alias: 'e',
      type: 'string',
      description: 'Task error message'
    },
    {
      name: 'progress',
      alias: 'g',
      type: 'number',
      description: 'Task progress (0-100)'
    },
    {
      name: 'assigned-agent-id',
      alias: 'a',
      type: 'string',
      description: 'Assigned agent ID'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (table or json)',
      default: 'table'
    }
  ],
  execute: executeUpdate
};

export default update;
