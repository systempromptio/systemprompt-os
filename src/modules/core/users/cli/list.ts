/**
 * List users CLI command.
 * @file List users CLI command.
 * @module modules/core/users/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'List all users',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();
      const users = await usersService.listUsers();

      if (args.format === 'json') {
        console.log(JSON.stringify(users, null, 2));
      } else {
        cliOutput.section('Users');

        if (users.length === 0) {
          cliOutput.info('No users found');
        } else {
          const tableData = users.map(user => { return {
            "ID": user.id,
            "Username": user.username,
            "Email": user.email,
            "Status": user.status,
            'Email Verified': user.email_verified ? 'Yes' : 'No',
            'Created At': user.created_at || 'N/A'
          } });

          console.table(tableData);
          cliOutput.info(`Total: ${users.length} users`);
        }
      }

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error listing users');
      logger.error(LogSource.USERS, 'Error listing users', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
