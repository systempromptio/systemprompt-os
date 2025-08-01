/**
 * Tasks module get CLI command.
 * @file Tasks module get CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import type { ITaskRow } from '@/modules/core/tasks/types/database.generated';
import { getTasksModule } from '@/modules/core/tasks';

/**
 * Validate task ID parameter.
 * @param id - Task ID to validate.
 */
const validateTaskId = (id: unknown): number => {
  if (id === undefined || typeof id !== 'number') {
    process.stderr.write('Error: Task ID is required and must be a number\n');
    process.exit(1);
  }
  return id;
};

/**
 * Display basic task information.
 * @param task - Task to display.
 */
const displayBasicTaskInfo = (task: ITaskRow): void => {
  process.stdout.write('\nTask Details\n');
  process.stdout.write('============\n\n');
  process.stdout.write(`ID: ${String(task.id)}\n`);
  process.stdout.write(`Type: ${String(task.type)}\n`);
  process.stdout.write(`Status: ${String(task.status)}\n`);
  process.stdout.write(`Priority: ${String(task.priority)}\n`);
  process.stdout.write(`Module: ${String(task.module_id)}\n`);
};

/**
 * Display optional task fields.
 * @param task - Task to display.
 */
const displayOptionalTaskFields = (task: ITaskRow): void => {
  if (task.instructions !== null) {
    process.stdout.write(`Instructions: ${task.instructions}\n`);
  }

  if (task.result !== null) {
    process.stdout.write(`Result: ${task.result}\n`);
  }

  if (task.error !== null) {
    process.stdout.write(`Error: ${task.error}\n`);
  }
};

/**
 * Display task timestamps.
 * @param task - Task to display.
 */
const displayTaskTimestamps = (task: ITaskRow): void => {
  process.stdout.write(`Created: ${String(task.created_at)}\n`);

  if (task.updated_at !== null) {
    process.stdout.write(`Updated: ${task.updated_at}\n`);
  }

  if (task.scheduled_at !== null) {
    process.stdout.write(`Scheduled: ${task.scheduled_at}\n`);
  }
};

const executeGet = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const id = validateTaskId(args.id);

  try {
    const tasksModule = getTasksModule();
    const taskService = tasksModule.exports.service();
    const task = await taskService.getTaskById(id);

    if (task === null) {
      process.stderr.write(`Task ${String(id)} not found\n`);
      process.exit(1);
    }

    const validTask = task as ITaskRow;
    displayBasicTaskInfo(validTask);
    displayOptionalTaskFields(validTask);
    displayTaskTimestamps(validTask);
    process.stdout.write('\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${errorMessage}\n`);
    process.exit(1);
  }
};

/**
 * Get command definition.
 */
const get: ICLICommand = {
  name: 'get',
  description: 'Get a specific task by ID',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'number',
      description: 'Task ID to retrieve',
      required: true
    }
  ],
  execute: executeGet
};

export default get;
