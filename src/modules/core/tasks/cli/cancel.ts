/**
 * Tasks module cancel CLI command.
 * @file Tasks module cancel CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';

/**
 * Tasks cancel command.
 */
export const cancel: CLICommand = {
  name: 'cancel',
  description: 'Cancel a pending task',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'number',
      description: 'Task ID',
      required: true
    }
  ],

  execute: async (context: CLIContext): Promise<void> => {
    const taskId = Number(context.args.id);

    if (taskId === 0 || Number.isNaN(taskId)) {
      process.stderr.write('Error: Valid task ID is required\n');
      process.exit(1);
    }

    try {
      const tasksModule = getTasksModule();
      const taskService = tasksModule.exports.service();

      await taskService.updateTask(taskId, { status: TaskStatus.CANCELLED });

      process.stdout.write(`\nTask ${String(taskId)} cancelled successfully!\n`);
    } catch (error) {
      process.stderr.write(`Error: ${String(error)}\n`);
      process.exit(1);
    }
  }
};

export default cancel;
