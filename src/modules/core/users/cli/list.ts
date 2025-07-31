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
import type { IUser } from '@/modules/core/users/types/users.module.generated';

/**
 * Formats user data for table display.
 * @param user - User to format.
 * @returns Formatted user data object.
 */
const formatUserForTable = (user: IUser): Record<string, string> => { return {
  "ID": user.id,
  "Username": user.username,
  "Email": user.email,
  "Status": user.status,
  'Email Verified': user.email_verified === true ? 'Yes' : 'No',
  'Created At': user.created_at ?? 'N/A'
} };

/**
 * Displays users in table format.
 * @param users - Users to display.
 * @param logger - Logger service instance.
 * @param cliOutput - CLI output service instance.
 */
const displayUsersTable = (
  users: IUser[],
  logger: LoggerService,
  cliOutput: CliOutputService
): void => {
  if (users.length === 0) {
    cliOutput.info('No users found');
    return;
  }

  const tableData = users.map(formatUserForTable);
  logger.info(LogSource.USERS, 'Users table', { tableData });
  cliOutput.info(`Total: ${String(users.length)} users`);
};

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
        logger.info(LogSource.USERS, 'Users listed', { users });
      } else {
        cliOutput.section('Users');
        displayUsersTable(users, logger, cliOutput);
      }

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error listing users');
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.error(LogSource.USERS, 'Error listing users', { error: logError });
      process.exit(1);
    }
  },
};
