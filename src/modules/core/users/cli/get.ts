/**
 * Get user CLI command.
 * @file Get user CLI command.
 * @module modules/core/users/cli/get
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Get user information by ID or username',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();

      if (!args.id && !args.username) {
        cliOutput.error('Either --id or --username is required');
        process.exit(1);
      }

      let user = null;

      if (args.id) {
        user = await usersService.getUser(args.id as string);
      } else if (args.username) {
        user = await usersService.getUserByUsername(args.username as string);
      }

      if (!user) {
        cliOutput.error('User not found');
        process.exit(1);
      }

      if (args.format === 'json') {
        console.log(JSON.stringify(user, null, 2));
      } else {
        cliOutput.section('User Information');

        cliOutput.keyValue({
          "ID": user.id,
          "Username": user.username,
          "Email": user.email,
          "Status": user.status,
          'Login Attempts': user.loginAttempts,
          'Last Login': user.lastLoginAt ? user.lastLoginAt.toISOString() : 'Never',
          'Created At': user.createdAt.toISOString(),
          'Updated At': user.updatedAt.toISOString()
        });
      }

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting user');
      logger.error(LogSource.USERS, 'Error getting user', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};

