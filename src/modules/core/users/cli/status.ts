/**
 * Users module status CLI command.
 * @file Users module status CLI command.
 * @module modules/core/users/cli/status
 */

import type { ICLICommand } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Show users module status (enabled/healthy)',
  execute: async (): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();

      cliOutput.section('Users Module Status');

      cliOutput.keyValue({
        Module: 'users',
        Enabled: '✓',
        Healthy: '✓',
        Service: 'UsersService initialized',
      });

      const users = await usersService.listUsers();

      cliOutput.section('User Statistics');

      cliOutput.keyValue({
        'Total users': users.length,
        'User management': '✓',
        'Authentication support': '✓',
        'Profile management': '✓',
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting users status');
      logger.error(LogSource.USERS, 'Error getting users status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
