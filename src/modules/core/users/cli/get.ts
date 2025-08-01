/**
 * Get user CLI command.
 * @file Get user CLI command.
 * @module modules/core/users/cli/get
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { z } from 'zod';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IUser } from '@/modules/core/users/types/users.module.generated';

// Get command arguments schema
const getUserArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  id: z.string().uuid()
.optional(),
  username: z.string().optional()
}).refine(data => { return data.id || data.username }, {
  message: 'Either id or username must be provided'
});

export const command: ICLICommand = {
  description: 'Get user information by ID or username',
  options: [
    {
 name: 'id',
type: 'string',
description: 'User ID (UUID)'
},
    {
 name: 'username',
alias: 'u',
type: 'string',
description: 'Username'
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
      const validatedArgs = getUserArgsSchema.parse(args);

      const usersService = UsersService.getInstance();
      let user: IUser | null = null;

      if (validatedArgs.id) {
        user = await usersService.getUser(validatedArgs.id);
      } else if (validatedArgs.username) {
        user = await usersService.getUserByUsername(validatedArgs.username);
      }

      if (!user) {
        cliOutput.error('User not found');
        process.exit(1);
      }

      if (validatedArgs.format === 'json') {
        cliOutput.json(user);
      } else {
        cliOutput.section('User Information');
        cliOutput.keyValue({
          'ID': user.id,
          'Username': user.username,
          'Email': user.email,
          'Display Name': user.display_name || 'N/A',
          'Status': user.status,
          'Email Verified': user.email_verified ? 'Yes' : 'No',
          'Bio': user.bio || 'N/A',
          'Timezone': user.timezone || 'N/A',
          'Language': user.language || 'N/A',
          'Created At': user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A',
          'Updated At': user.updated_at ? new Date(user.updated_at).toLocaleString() : 'N/A'
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

      cliOutput.error('Error getting user');
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.error(LogSource.USERS, 'Error getting user', { error: logError });
      process.exit(1);
    }
  },
};
