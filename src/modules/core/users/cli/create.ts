/**
 * Create user CLI command.
 * @file Create user CLI command.
 * @module modules/core/users/cli/create
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { z } from 'zod';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import {
  type IUser,
  type IUserCreateData
} from '@/modules/core/users/types/users.module.generated';
import { UsersStatus } from '@/modules/core/users/types/database.generated';
import { validateCliArgs } from '../utils/cli-validation';

export const command: ICLICommand = {
  description: 'Create a new user',
  options: [
    {
 name: 'username',
alias: 'u',
type: 'string',
description: 'Username',
required: true
},
    {
 name: 'email',
alias: 'e',
type: 'string',
description: 'Email address',
required: true
},
    {
 name: 'display_name',
alias: 'd',
type: 'string',
description: 'Display name'
},
    {
 name: 'avatar_url',
type: 'string',
description: 'Avatar URL'
},
    {
 name: 'bio',
type: 'string',
description: 'User bio'
},
    {
 name: 'timezone',
type: 'string',
description: 'Timezone',
default: 'UTC'
},
    {
 name: 'language',
type: 'string',
description: 'Language',
default: 'en'
},
    {
 name: 'status',
type: 'string',
description: 'User status',
choices: ['active', 'inactive', 'suspended'],
default: 'active'
},
    {
 name: 'emailVerified',
type: 'string',
description: 'Email verified status',
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
      // Validate arguments with utility function
      const validatedArgs = validateCliArgs('create', args, cliOutput);
      if (!validatedArgs) {
        process.exit(1);
      }

      const usersService = UsersService.getInstance();
      const userData: IUserCreateData = {
        username: validatedArgs.username,
        email: validatedArgs.email,
        display_name: validatedArgs.display_name,
        avatar_url: validatedArgs.avatar_url,
        bio: validatedArgs.bio,
        timezone: validatedArgs.timezone || 'UTC',
        language: validatedArgs.language || 'en',
        status: validatedArgs.status || UsersStatus.ACTIVE,
        email_verified: validatedArgs.email_verified,
        preferences: validatedArgs.preferences,
        metadata: validatedArgs.metadata
      };

      const user = await usersService.createUser(userData);

      if (validatedArgs.format === 'json') {
        cliOutput.json(user);
      } else {
        cliOutput.success('User created successfully');
        cliOutput.keyValue({
          'ID': user.id,
          'Username': user.username,
          'Email': user.email,
          'Status': user.status,
          'Created At': user.created_at ?? 'N/A'
        });
      }

      process.exit(0);
    } catch (error) {

      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error creating user: ${errorMessage}`);
      logger.error(LogSource.USERS, 'Error creating user', { error: error instanceof Error ? error : new Error(String(error)) });
      process.exit(1);
    }
  },
};
