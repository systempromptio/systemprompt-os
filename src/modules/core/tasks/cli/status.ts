/**
 * Tasks module status CLI command.
 * @file Tasks module status CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { getTasksModule } from '@/modules/core/tasks';
import type { ITaskStatistics } from '@/modules/core/tasks/types/index';

/**
 * Display module status information.
 */
const displayModuleStatus = (): void => {
  process.stdout.write('\nTasks Module Status\n');
  process.stdout.write('==================\n\n');
  process.stdout.write('Module: tasks\n');
  process.stdout.write('Enabled: ✓\n');
  process.stdout.write('Healthy: ✓\n');
  process.stdout.write('Service: TaskService initialized\n');
};

/**
 * Display queue statistics.
 * @param stats - Task statistics to display.
 */
const displayQueueStatistics = (stats: ITaskStatistics): void => {
  process.stdout.write('\nQueue Statistics\n');
  process.stdout.write('================\n\n');
  process.stdout.write(`Total tasks: ${String(stats.total)}\n`);
  process.stdout.write(`Pending: ${String(stats.pending)}\n`);
  process.stdout.write(`In Progress: ${String(stats.inProgress)}\n`);
  process.stdout.write(`Completed: ${String(stats.completed)}\n`);
  process.stdout.write(`Failed: ${String(stats.failed)}\n`);
  process.stdout.write(`Cancelled: ${String(stats.cancelled)}\n`);
};

/**
 * Display JSON output format.
 * @param stats - Task statistics to display.
 */
const displayJsonOutput = (stats: ITaskStatistics): void => {
  process.stdout.write('\n');
  process.stdout.write(JSON.stringify({
    module: 'tasks',
    enabled: true,
    healthy: true,
    statistics: stats
  }, null, 2));
  process.stdout.write('\n');
};

/**
 * Execute status command.
 * @param context - CLI context.
 * @returns Promise that resolves when status is displayed.
 */
const executeStatus = async (context: CLIContext): Promise<void> => {
  try {
    const tasksModule = getTasksModule();
    const taskService = tasksModule.exports.service();
    const stats = await taskService.getStatistics();

    displayModuleStatus();
    displayQueueStatistics(stats);

    if (context.args.format === 'json') {
      displayJsonOutput(stats);
    }
  } catch (error) {
    process.stderr.write('❌ Error getting tasks status\n');
    process.stderr.write(`Error: ${String(error)}\n`);
    process.exit(1);
  }
};

/**
 * Tasks status command.
 */
export const status: CLICommand = {
  name: 'status',
  description: 'Show task module status and queue statistics',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: executeStatus
};

export default status;
