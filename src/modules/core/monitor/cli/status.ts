/**
 * Monitor module status CLI command.
 * @file Monitor module status CLI command.
 * @module modules/core/monitor/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { MetricService } from '@/modules/core/monitor/services/metric.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Show monitor module status and system metrics',
  execute: async (_context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();

    try {
      cliOutput.section('Monitor Module Status');
      cliOutput.keyValue({
        Module: 'Monitor',
        Status: 'Active',
        Description: 'System monitoring and metrics collection',
      });

      const metricService = MetricService.getInstance();
      const systemMetrics = await metricService.getSystemMetrics();

      cliOutput.section('System Metrics');
      cliOutput.keyValue({
        'CPU Cores': systemMetrics.cpu.cores.toString(),
        'Memory Total': `${Math.round(systemMetrics.memory.total / 1024 / 1024)} MB`,
        'Memory Free': `${Math.round(systemMetrics.memory.free / 1024 / 1024)} MB`,
        'Memory Used': `${Math.round(systemMetrics.memory.used / 1024 / 1024)} MB`,
        'Uptime': `${Math.round(systemMetrics.uptime)} seconds`,
      });

      process.exit(0);
    } catch (error) {
      const logger = LoggerService.getInstance();
      cliOutput.error('Error getting monitor status');
      logger.error(
        LogSource.MONITOR,
        'Error getting monitor status',
        {
          error: error instanceof Error ? error : new Error(String(error)),
        }
      );
      process.exit(1);
    }
  },
};
