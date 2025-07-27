/**
 * Update user CLI command.
 * @file Update user CLI command.
 * @module modules/core/users/cli/update
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { UserStatusEnum } from '@/modules/core/users/types/index';

export const command: ICLICommand = {
  description: 'Update user information',
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

      const updateData: any = {};

      if (args.email) {
        updateData.email = args.email as string;
      }

      if (args.status) {
        const status = args.status as string;
        const validStatuses = ['active', 'inactive', 'suspended'];
        if (!validStatuses.includes(status)) {
          cliOutput.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
          process.exit(1);
        }
        updateData.status = status as UserStatusEnum;
      }

      if (Object.keys(updateData).length === 0) {
        cliOutput.error('No update data provided. Use --email or --status');
        process.exit(1);
      }

      cliOutput.section('Updating User');

      const user = await usersService.updateUser(args.id as string, updateData);

      cliOutput.success(`User updated successfully`);

      if (args.format === 'json') {
        console.log(JSON.stringify(user, null, 2));
      } else {
        cliOutput.keyValue({
          "ID": user.id,
          "Username": user.username,
          "Email": user.email,
          "Status": user.status,
          'Updated At': user.updatedAt.toISOString()
        });
      }

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error updating user');
      logger.error(LogSource.USERS, 'Error updating user', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
