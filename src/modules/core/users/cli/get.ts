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
    result.id = typeof args.id === 'string' ? args.id : undefined;
  }
  if (hasUsername) {
    result.username = typeof args.username === 'string' ? args.username : undefined;
  }

  return result;
};

/**
 * Retrieves user by ID or username.
 * @param lookupArgs - Validated lookup parameters.
 * @param lookupArgs.id - User ID to look up.
 * @param lookupArgs.username - Username to look up.
 * @param usersService - Users service instance.
 * @returns User if found, null otherwise.
 */
const retrieveUser = async (
  lookupArgs: { id?: string | undefined; username?: string | undefined },
  usersService: UsersService
): Promise<IUser | null> => {
  if (lookupArgs.id !== undefined && lookupArgs.id.length > 0) {
    return await usersService.getUser(lookupArgs.id);
  }
  if (lookupArgs.username !== undefined && lookupArgs.username.length > 0) {
    return await usersService.getUserByUsername(lookupArgs.username);
  }
  return null;
};

/**
 * Displays user information.
 * @param user - User to display.
 * @param isJsonFormat - Whether to use JSON format.
 * @param services - Service instances.
 * @param services.logger - Logger service instance.
 * @param services.cliOutput - CLI output service instance.
 */
const displayUser = (
  user: IUser,
  isJsonFormat: boolean,
  services: { logger: LoggerService; cliOutput: CliOutputService }
): void => {
  const { logger, cliOutput } = services;
  if (isJsonFormat) {
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

/**
 * Handles user retrieval errors.
 * @param error - The error that occurred.
 * @param cliOutput - CLI output service.
 * @param logger - Logger service.
 */
const handleRetrievalError = (
  error: unknown,
  cliOutput: CliOutputService,
  logger: LoggerService
): void => {
  cliOutput.error('Error getting user');
  const logError = error instanceof Error ? error : new Error(String(error));
  logger.error(LogSource.USERS, 'Error getting user', { error: logError });
  process.exit(1);
};

/**
 * Processes user retrieval and display.
 * @param retrievalData - Object containing retrieval parameters.
 * @param retrievalData.args - CLI arguments.
 * @param retrievalData.usersService - Users service instance.
 * @param retrievalData.logger - Logger service.
 * @param retrievalData.cliOutput - CLI output service.
 */
const processUserRetrieval = async (retrievalData: {
  args: Record<string, unknown>;
  usersService: UsersService;
  logger: LoggerService;
  cliOutput: CliOutputService;
}): Promise<void> => {
  const {
 args, usersService, logger, cliOutput
} = retrievalData;
  const lookupArgs = validateLookupArgs(args, cliOutput);
  const user = await retrieveUser(lookupArgs, usersService);

  if (user === null) {
    cliOutput.error('User not found');
    process.exit(1);
  }

  displayUser(user, args.format === 'json', {
 logger,
cliOutput
});
};

export const command: ICLICommand = {
  description: 'Get user information by ID or username',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();
      await processUserRetrieval({
 args,
usersService,
logger,
cliOutput
});
      process.exit(0);
    } catch (error) {
      handleRetrievalError(error, cliOutput, logger);
    }
  },
};
