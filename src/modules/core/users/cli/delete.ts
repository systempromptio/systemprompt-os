/**
 * Delete user CLI command.
 * @file Delete user CLI command.
 * @module modules/core/users/cli/delete
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Delete a user',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();

      if (!args.id) {
        cliOutput.error('User ID is required (--id)');
        process.exit(1);
      }

      const userId = args.id as string;

      const user = await usersService.getUser(userId);
      if (!user) {
        cliOutput.error(`User not found: ${userId}`);
        process.exit(1);
      }

      if (!args.force) {
        cliOutput.section('Warning');
        cliOutput.error(`This will permanently delete user: ${user.username} (${user.email})`);
        cliOutput.info('Use --force flag to confirm deletion');
        process.exit(1);
      }

      cliOutput.section('Deleting User');
      cliOutput.keyValue({
        ID: user.id,
        Username: user.username,
        Email: user.email
      });

      await usersService.deleteUser(userId);

      cliOutput.success(`User deleted successfully`);

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error deleting user');
      logger.error(LogSource.USERS, 'Error deleting user', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
