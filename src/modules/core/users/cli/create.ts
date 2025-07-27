/**
 * Create user CLI command.
 * @file Create user CLI command.
 * @module modules/core/users/cli/create
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IUserCreateData } from '@/modules/core/users/types/index';

export const command: ICLICommand = {
  description: 'Create a new user',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();

      if (!args.username || !args.email) {
        cliOutput.error('Username and email are required');
        process.exit(1);
      }

      const userData: IUserCreateData = {
        username: args.username as string,
        email: args.email as string
      };

      if (args.password) {
        userData.password = args.password as string;
      }

      if (args.role) {
        userData.role = args.role as string;
      }

      cliOutput.section('Creating User');

      const user = await usersService.createUser(userData);

      cliOutput.success(`User created successfully`);

      if (args.format === 'json') {
        console.log(JSON.stringify(user, null, 2));
      } else {
        cliOutput.keyValue({
          "ID": user.id,
          "Username": user.username,
          "Email": user.email,
          "Status": user.status,
          'Created At': user.createdAt.toISOString()
        });
      }

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error creating user');
      logger.error(LogSource.USERS, 'Error creating user', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};

