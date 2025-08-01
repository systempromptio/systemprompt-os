/**
 * List users CLI command.
 * @file List users CLI command.
 * @module modules/core/users/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { z } from 'zod';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { UsersStatusSchema } from '@/modules/core/users/types/database.generated';
import type { IUser } from '@/modules/core/users/types/users.module.generated';

// List command arguments schema
const listUsersArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  status: UsersStatusSchema.optional(),
  limit: z.coerce.number().positive()
.max(100)
.default(20),
  page: z.coerce.number().positive()
.default(1)
});

export const command: ICLICommand = {
  description: 'List all users',
  options: [
    {
 name: 'format',
alias: 'f',
type: 'string',
choices: ['text', 'json'],
default: 'text',
description: 'Output format'
},
    {
 name: 'status',
type: 'string',
choices: ['active', 'inactive', 'suspended'],
description: 'Filter by status'
},
    {
 name: 'limit',
alias: 'l',
type: 'number',
description: 'Maximum number of users to return',
default: 20
},
    {
 name: 'page',
alias: 'p',
type: 'number',
description: 'Page number for pagination',
default: 1
}
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = listUsersArgsSchema.parse(args);

      const usersService = UsersService.getInstance();
      const users = await usersService.listUsers();

      let filteredUsers = users;
      if (validatedArgs.status) {
        filteredUsers = users.filter(user => { return user.status === validatedArgs.status });
      }

      const startIndex = (validatedArgs.page - 1) * validatedArgs.limit;
      const paginatedUsers = filteredUsers.slice(startIndex, startIndex + validatedArgs.limit);

      if (validatedArgs.format === 'json') {
        cliOutput.json(paginatedUsers);
      } else {
        if (paginatedUsers.length === 0) {
          cliOutput.info('No users found');
          process.exit(0);
        }

        cliOutput.section('Users');
        cliOutput.table(paginatedUsers, [
          {
 key: 'id',
header: 'ID',
width: 36
},
          {
 key: 'username',
header: 'Username',
width: 20
},
          {
 key: 'email',
header: 'Email',
width: 30
},
          {
 key: 'status',
header: 'Status',
width: 15
},
          {
 key: 'email_verified',
header: 'Verified',
width: 10,
format: (v) => { return v ? 'Yes' : 'No' }
},
          {
 key: 'created_at',
header: 'Created',
width: 20,
format: (v) => { return v ? new Date(v).toLocaleDateString() : 'N/A' }
}
        ]);

        cliOutput.info(`Showing ${paginatedUsers.length} of ${filteredUsers.length} users (page ${validatedArgs.page})`);
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

      cliOutput.error('Error listing users');
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.error(LogSource.USERS, 'Error listing users', { error: logError });
      process.exit(1);
    }
  },
};
