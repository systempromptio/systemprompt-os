/**
 * Delete user CLI command.
 * @file Delete user CLI command.
 * @module modules/core/users/cli/delete
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { z } from 'zod';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IUser } from '@/modules/core/users/types/users.module.generated';

// Delete command arguments schema
const deleteUserArgsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
  force: z.enum(['true', 'false']).transform(v => { return v === 'true' })
.default('false'),
  format: z.enum(['text', 'json']).default('text')
});

export const command: ICLICommand = {
  description: 'Delete a user',
  options: [
    {
 name: 'id',
type: 'string',
description: 'User ID (UUID)',
required: true
},
    {
 name: 'force',
type: 'string',
description: 'Force deletion without confirmation',
choices: ['true', 'false'],
default: 'false'
},
    {
 name: 'format',
alias: 'f',
type: 'string',
choices: ['text', 'json'],
default: 'text',
description: 'Output format'
}
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = deleteUserArgsSchema.parse(args);

      const usersService = UsersService.getInstance();

      const user = await usersService.getUser(validatedArgs.id);
      if (!user) {
        cliOutput.error(`User not found: ${validatedArgs.id}`);
        process.exit(1);
      }

      if (!validatedArgs.force) {
        if (validatedArgs.format === 'json') {
          cliOutput.json({
            error: 'Deletion requires confirmation',
            message: 'Use --force true to confirm deletion',
            user: {
              id: user.id,
              username: user.username,
              email: user.email
            }
          });
        } else {
          cliOutput.section('Warning');
          cliOutput.error(`This will permanently delete user: ${user.username} (${user.email})`);
          cliOutput.info('Use --force true to confirm deletion');
        }
        process.exit(1);
      }

      await usersService.deleteUser(validatedArgs.id);

      if (validatedArgs.format === 'json') {
        cliOutput.json({
          success: true,
          message: 'User deleted successfully',
          deletedUser: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        });
      } else {
        cliOutput.success('User deleted successfully');
        cliOutput.keyValue({
          'Deleted User ID': user.id,
          'Username': user.username,
          'Email': user.email
        });
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error deleting user: ${errorMessage}`);
      logger.error(LogSource.USERS, 'Error deleting user', { error: error instanceof Error ? error : new Error(String(error)) });
      process.exit(1);
    }
  },
};
