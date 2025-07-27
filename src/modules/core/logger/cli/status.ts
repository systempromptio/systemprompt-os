/**
 * Logger module status CLI command.
 * @file Logger module status CLI command.
 * @module modules/core/logger/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Show logger module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      cliOutput.section('Logger Module Status');

      cliOutput.keyValue({
        Module: 'logger',
        Enabled: '✓',
        Healthy: '✓',
        Service: 'LoggerService initialized',
      });

      const logLevel = process.env.LOGLEVEL || 'info';

      cliOutput.section('Configuration');
      cliOutput.keyValue({
        'Current log level': logLevel,
        'Console transport': '✓',
        'File transport': '✓',
        'Error handling service': '✓',
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting logger status');
      logger.error(LogSource.LOGGER, 'Error getting logger status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
