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
import type { IUser } from '@/modules/core/users/types/users.module.generated';

/**
 * Validates the user ID argument.
 * @param args - CLI arguments object.
 * @param cliOutput - CLI output service instance.
 * @returns Validated user ID.
 */
const validateUserId = (args: Record<string, unknown>, cliOutput: CliOutputService): string => {
  const { id } = args;
  if (typeof id !== 'string' || id.trim() === '') {
    cliOutput.error('User ID is required (--id)');
    process.exit(1);
  }
  return id;
};

/**
 * Confirms deletion with force flag check.
 * @param args - CLI arguments object.
 * @param user - User to be deleted.
 * @param cliOutput - CLI output service instance.
 */
const confirmDeletion = (
  args: Record<string, unknown>,
  user: IUser,
  cliOutput: CliOutputService
): void => {
  const { force } = args;
  if (typeof force !== 'boolean' || !force) {
    cliOutput.section('Warning');
    cliOutput.error(`This will permanently delete user: ${user.username} (${user.email})`);
    cliOutput.info('Use --force flag to confirm deletion');
    process.exit(1);
  }
};

/**
 * Displays user information before deletion.
 * @param user - User to be deleted.
 * @param cliOutput - CLI output service instance.
 */
const displayUserInfo = (user: IUser, cliOutput: CliOutputService): void => {
  cliOutput.section('Deleting User');
  cliOutput.keyValue({
    ID: user.id,
    Username: user.username,
    Email: user.email
  });
};

/**
 * Handles deletion errors.
 * @param error - The error that occurred.
 * @param cliOutput - CLI output service.
 * @param logger - Logger service.
 */
const handleDeletionError = (
  error: unknown,
  cliOutput: CliOutputService,
  logger: LoggerService
): void => {
  cliOutput.error('Error deleting user');
  const logError = error instanceof Error ? error : new Error(String(error));
  logger.error(LogSource.USERS, 'Error deleting user', { error: logError });
  process.exit(1);
};

/**
 * Processes user deletion after validation.
 * @param deletionData - Object containing deletion parameters.
 * @param deletionData.userId - User ID to delete.
 * @param deletionData.args - CLI arguments.
 * @param deletionData.usersService - Users service instance.
 * @param deletionData.cliOutput - CLI output service.
 */
const processUserDeletion = async (deletionData: {
  userId: string;
  args: Record<string, unknown>;
  usersService: UsersService;
  cliOutput: CliOutputService;
}): Promise<void> => {
  const {
 userId, args, usersService, cliOutput
} = deletionData;
  const user = await usersService.getUser(userId);
  if (user === null) {
    cliOutput.error(`User not found: ${userId}`);
    process.exit(1);
  }

  confirmDeletion(args, user, cliOutput);
  displayUserInfo(user, cliOutput);

  await usersService.deleteUser(userId);
  cliOutput.success('User deleted successfully');
};

export const command: ICLICommand = {
  description: 'Delete a user',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();
      const userId = validateUserId(args, cliOutput);

      await processUserDeletion({
 userId,
args,
usersService,
cliOutput
});
      process.exit(0);
    } catch (error) {
      handleDeletionError(error, cliOutput, logger);
    }
  },
};
