/**
 * Get user CLI command.
 * @file Get user CLI command.
 * @module modules/core/users/cli/get
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IUser } from '@/modules/core/users/types/users.module.generated';

/**
 * Validates user lookup arguments.
 * @param args - CLI arguments object.
 * @param cliOutput - CLI output service instance.
 * @returns Validated lookup parameters.
 */
const validateLookupArgs = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): { id?: string | undefined; username?: string | undefined } => {
  const hasId = typeof args.id === 'string' && args.id.trim() !== '';
  const hasUsername = typeof args.username === 'string' && args.username.trim() !== '';

  if (!hasId && !hasUsername) {
    cliOutput.error('Either --id or --username is required');
    process.exit(1);
  }

  const result: { id?: string | undefined; username?: string | undefined } = {};
  if (hasId) {
    result.id = args.id as string;
  }
  if (hasUsername) {
    result.username = args.username as string;
  }

  return result;
};

/**
 * Retrieves user by ID or username.
 * @param lookupArgs - Validated lookup parameters.
 * @param lookupArgs.id
 * @param usersService - Users service instance.
 * @param lookupArgs.username
 * @returns User if found, null otherwise.
 */
const retrieveUser = async (
  lookupArgs: { id?: string | undefined; username?: string | undefined },
  usersService: UsersService
): Promise<IUser | null> => {
  if (lookupArgs.id) {
    return await usersService.getUser(lookupArgs.id);
  }
  if (lookupArgs.username) {
    return await usersService.getUserByUsername(lookupArgs.username);
  }
  return null;
};

/**
 * Displays user information.
 * @param user - User to display.
 * @param args - CLI arguments for format options.
 * @param logger - Logger service instance.
 * @param cliOutput - CLI output service instance.
 */
const displayUser = (
  user: IUser,
  args: Record<string, unknown>,
  logger: LoggerService,
  cliOutput: CliOutputService
): void => {
  if (args.format === 'json') {
    logger.info(LogSource.USERS, 'User retrieved', { user });
  } else {
    cliOutput.section('User Information');
    cliOutput.keyValue({
      "ID": user.id,
      "Username": user.username,
      "Email": user.email,
      "Status": user.status,
      'Email Verified': user.email_verified === true ? 'Yes' : 'No',
      'Created At': user.created_at ?? 'N/A',
      'Updated At': user.updated_at ?? 'N/A'
    });
  }
};

export const command: ICLICommand = {
  description: 'Get user information by ID or username',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();
      const lookupArgs = validateLookupArgs(args, cliOutput);
      const user = await retrieveUser(lookupArgs, usersService);

      if (user === null) {
        cliOutput.error('User not found');
        process.exit(1);
      }

      displayUser(user, args, logger, cliOutput);
      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting user');
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.error(LogSource.USERS, 'Error getting user', { error: logError });
      process.exit(1);
    }
  },
};
