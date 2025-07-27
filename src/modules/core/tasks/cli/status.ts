/**
 * Tasks module status CLI command.
 * @file Tasks module status CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { TaskService } from '@/modules/core/tasks/services/task.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

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

  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const taskService = TaskService.getInstance();

      cliOutput.section('Tasks Module Status');

      cliOutput.keyValue({
        Module: 'tasks',
        Enabled: '✓',
        Healthy: '✓',
        Service: 'TaskService initialized',
      });

      const stats = await taskService.getStatistics();

      cliOutput.section('Task Queue Statistics');

      cliOutput.keyValue({
        'Total tasks': stats.total,
        'Pending': stats.pending,
        'In Progress': stats.inProgress,
        'Completed': stats.completed,
        'Failed': stats.failed,
      });

      if (context.args.format === 'json') {
        cliOutput.output({
          module: 'tasks',
          enabled: true,
          healthy: true,
          statistics: stats
        }, { format: 'json' });
      }

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting tasks status');
      logger.error(LogSource.TASKS, 'Error getting tasks status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  }
};

export default status;
