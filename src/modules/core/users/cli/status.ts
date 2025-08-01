/**
 * Users module status CLI command.
 * @file Users module status CLI command.
 * @module modules/core/users/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { validateCliArgs } from '../utils/cli-validation';

export const command: ICLICommand = {
  description: 'Show users module status (enabled/healthy)',
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
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      // Validate arguments with utility function
      const validatedArgs = validateCliArgs('status', args, cliOutput);
      if (!validatedArgs) {
        process.exit(1);
      }

      const usersService = UsersService.getInstance();

      const users = await usersService.listUsers();
      const statusData = {
        module: 'users',
        status: {
          enabled: true,
          healthy: true,
          service: 'UsersService initialized'
        },
        statistics: {
          totalUsers: users.length,
          userManagement: true,
          authenticationSupport: true,
          profileManagement: true
        },
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(statusData);
      } else {
        cliOutput.section('Users Module Status');
        cliOutput.keyValue({
          Module: 'users',
          Enabled: '✓',
          Healthy: '✓',
          Service: 'UsersService initialized',
        });

        cliOutput.section('User Statistics');
        cliOutput.keyValue({
          'Total users': users.length,
          'User management': '✓',
          'Authentication support': '✓',
          'Profile management': '✓',
        });
      }

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
