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
import type { IUserCreateData } from '@/modules/core/users/types/users.module.generated';
import { UsersStatus } from '@/modules/core/users/types/database.generated';

/**
 * Validates required CLI arguments for user creation.
 * @param args - CLI arguments object.
 * @param cliOutput - CLI output service instance.
 * @returns Validated username and email.
 */
const validateRequiredArgs = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): { username: string; email: string } => {
  if (
    typeof args.username !== 'string'
    || typeof args.email !== 'string'
    || args.username.trim() === ''
    || args.email.trim() === ''
  ) {
    cliOutput.error('Username and email are required');
    process.exit(1);
  }

  return {
    username: args.username,
    email: args.email
  };
};

/**
 * Validates and normalizes a string argument.
 * @param value - The argument value to validate.
 * @param defaultValue - The default value to use if invalid.
 * @returns The validated string or default value.
 */
const validateStringArg = (value: unknown, defaultValue: string | null = null): string | null => {
  return typeof value === 'string' && value.trim() !== '' ? value : defaultValue;
};

const buildUserData = (
  args: Record<string, unknown>,
  validatedArgs: { username: string; email: string }
): IUserCreateData => {
  const { username, email } = validatedArgs;

  return {
    username,
    email,
    display_name: validateStringArg(args.displayName),
    avatar_url: validateStringArg(args.avatarUrl),
    bio: validateStringArg(args.bio),
    timezone: validateStringArg(args.timezone, 'UTC'),
    language: validateStringArg(args.language, 'en'),
    status: UsersStatus.ACTIVE,
    email_verified: args.emailVerified === 'true',
    preferences: null,
    metadata: null
  };
};

export const command: ICLICommand = {
  description: 'Create a new user',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();
      const validatedArgs = validateRequiredArgs(args, cliOutput);
      const userData = buildUserData(args, validatedArgs);

      cliOutput.section('Creating User');
      const user = await usersService.createUser(userData);
      cliOutput.success('User created successfully');

      if (args.format === 'json') {
        logger.info(LogSource.USERS, 'User created', { user });
      } else {
        const userDisplay = {
          "ID": user.id,
          "Username": user.username,
          "Email": user.email,
          "Status": user.status,
          'Created At': user.created_at ?? 'N/A'
        };
        cliOutput.keyValue(userDisplay);
      }

      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error creating user: ${errorMessage}`);
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.error(LogSource.USERS, 'Error creating user', { error: logError });
      process.exit(1);
    }
  },
};
