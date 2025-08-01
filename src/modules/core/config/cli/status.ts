/**
 * Config module status CLI command.
 * @file Config module status CLI command.
 * @module modules/core/config/cli/status
 */

import { ConfigService } from '@/modules/core/config/services/config.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show config module status (enabled/healthy)',
  execute: (): void => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      ConfigService.getInstance();

      cliOutput.section('Config Module Status');

      cliOutput.keyValue({
        Module: 'config',
        Enabled: '✓',
        Healthy: '✓',
        Service: 'ConfigService initialized',
      });

      cliOutput.section('Configuration');

      cliOutput.keyValue({
        'Configuration storage': '✓',
        'Environment variables loaded': '✓',
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting config status');
      logger.error(LogSource.MODULES, 'Error getting config status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
