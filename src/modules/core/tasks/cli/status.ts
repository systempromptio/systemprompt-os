/**
 * Tasks module status CLI command.
 * @file Tasks module status CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { type StatusArgs, validateCliArgs } from '@/modules/core/tasks/utils/cli-validation';

/**
 * Execute status command.
 * @param context - CLI context.
 * @returns Promise that resolves when status is displayed.
 */
const executeStatus = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const validatedArgs = validateCliArgs('status', context.args, cliOutput);
    if (!validatedArgs) {
      process.exit(1);
    }

    const { format, detailed } = validatedArgs;

    const taskService = TaskService.getInstance();
    const stats = await taskService.getStatistics();

    const statusData = {
      module: 'tasks',
      status: 'healthy',
      healthy: true,
      statistics: stats,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ...detailed && {
        config: {
          maxConcurrentTasks: 5,
          defaultRetryCount: 3,
          taskTimeout: 300000,
          pollInterval: 1000
        }
      }
    };

    if (format === 'json') {
      cliOutput.json(statusData);
    } else {
      cliOutput.section('Tasks Module Status');
      cliOutput.keyValue({
        Module: 'tasks',
        Status: '✓ Healthy',
        Service: 'TaskService initialized',
        Uptime: `${Math.floor(process.uptime())}s`
      });

      cliOutput.section('Queue Statistics');
      cliOutput.keyValue({
        'Total Tasks': stats.total,
        'Pending': stats.pending,
        'In Progress': stats.inProgress,
        'Completed': stats.completed,
        'Failed': stats.failed,
        'Cancelled': stats.cancelled
      });

      if (detailed && stats.tasksByType) {
        cliOutput.section('Tasks by Type');
        cliOutput.keyValue(stats.tasksByType);
      }

      if (detailed && stats.averageExecutionTime) {
        cliOutput.section('Performance');
        cliOutput.keyValue({
          'Average Execution Time': `${stats.averageExecutionTime}ms`
        });
      }
    }

    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error getting tasks status: ${errorMessage}`);
    logger.error(LogSource.TASKS, 'Status command failed', { error });
    process.exit(1);
  }
};

/**
 * Tasks status command.
 */
export const command: ICLICommand = {
  description: 'Show task module status and queue statistics',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
    {
      name: 'detailed',
      alias: 'd',
      type: 'boolean',
      description: 'Show detailed status information',
      default: false
    }
  ],
  execute: executeStatus
};

export default command;
