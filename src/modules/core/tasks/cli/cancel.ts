/**
 * Tasks module cancel CLI command.
 * @file Tasks module cancel CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import { validateCliArgs } from '@/modules/core/tasks/utils/cli-validation';

/**
 * Execute cancel command.
 * @param context - CLI context.
 * @returns Promise that resolves when task is cancelled.
 */
const executeCancel = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const validatedArgs = validateCliArgs('cancel', context.args, cliOutput);
    if (!validatedArgs) {
      process.exit(1);
    }

    const {
 id, format, reason
} = validatedArgs;

    const taskService = TaskService.getInstance();

    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      cliOutput.error(`Task ${id} not found`);
      process.exit(1);
    }

    const cancellableStatuses = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS];
    if (!cancellableStatuses.includes(existingTask.status as TaskStatus)) {
      cliOutput.error(`Task ${id} cannot be cancelled. Current status: ${existingTask.status}`);
      cliOutput.info('Only pending and in-progress tasks can be cancelled.');
      process.exit(1);
    }

    const updateData: Record<string, unknown> = {
      status: TaskStatus.CANCELLED
    };

    if (reason) {
      updateData.error = `Cancelled: ${reason}`;
    }

    const cancelledTask = await taskService.updateTask(id, updateData);

    if (format === 'json') {
      cliOutput.json(cancelledTask);
    } else {
      cliOutput.success(`Task ${id} cancelled successfully`);
      cliOutput.keyValue({
        'ID': cancelledTask.id,
        'Type': cancelledTask.type,
        'Previous Status': existingTask.status || 'pending',
        'New Status': cancelledTask.status || 'cancelled',
        'Module': cancelledTask.module_id,
        'Cancelled': cancelledTask.updated_at ? new Date(cancelledTask.updated_at).toLocaleString() : 'Now',
        ...reason && { Reason: reason }
      });

      if (cancelledTask.error && cancelledTask.error.startsWith('Cancelled:')) {
        cliOutput.section('Cancellation Details');
        cliOutput.info(cancelledTask.error);
      }
    }

    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error cancelling task: ${errorMessage}`);
    logger.error(LogSource.TASKS, 'Cancel command failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
};

/**
 * Tasks cancel command.
 */
export const command: ICLICommand = {
  description: 'Cancel a pending or in-progress task',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'number',
      description: 'Task ID to cancel',
      required: true
    },
    {
      name: 'reason',
      alias: 'r',
      type: 'string',
      description: 'Reason for cancellation (optional)'
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
  execute: executeCancel
};

export default command;
