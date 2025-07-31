/**
 * Update user CLI command.
 * @file Update user CLI command.
 * @module modules/core/users/cli/update
 */

import type {
  ICLICommand,
  ICLIContext
} from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { UsersStatus } from '@/modules/core/users/types/database.generated';
import type {
  IUser,
  IUserUpdateData
} from '@/modules/core/users/types/users.module.generated';

// Local CLI types
interface IDisplayOptions {
  format?: string;
}

interface IUpdateUserArgs {
  id?: string;
  email?: string;
  status?: string;
  format?: string;
}

/**
 * Validates user ID argument.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service instance.
 * @returns The validated user ID.
 */
const validateUserId = (args: IUpdateUserArgs, cliOutput: CliOutputService): string => {
  if (args.id === null || args.id === undefined || typeof args.id !== 'string' || args.id.trim() === '') {
    cliOutput.error('User ID is required (--id)');
    process.exit(1);
  }
  return args.id;
};

/**
 * Validates and converts status argument.
 * @param status - Status string from CLI.
 * @param cliOutput - CLI output service instance.
 * @returns The validated status enum.
 */
const validateStatus = (status: string, cliOutput: CliOutputService): UsersStatus => {
  const validStatuses: UsersStatus[] = [
    UsersStatus.ACTIVE,
    UsersStatus.INACTIVE,
    UsersStatus.SUSPENDED
  ];

  const matchedStatus = validStatuses.find(s => { return s === status });
  if (!matchedStatus) {
    cliOutput.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    process.exit(1);
  }

  return matchedStatus;
};

/**
 * Builds update data from CLI arguments.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service instance.
 * @returns The validated update data.
 */
const buildUpdateData = (args: IUpdateUserArgs, cliOutput: CliOutputService): IUserUpdateData => {
  const updateData: IUserUpdateData = {};
  const { email, status } = args;

  if (typeof email === 'string' && email.trim() !== '') {
    updateData.email = email;
  }

  if (typeof status === 'string' && status.trim() !== '') {
    updateData.status = validateStatus(status, cliOutput);
  }

  if (Object.keys(updateData).length === 0) {
    cliOutput.error('No update data provided. Use --email or --status');
    process.exit(1);
  }

  return updateData;
};

/**
 * Displays user information after update.
 * @param user - Updated user information.
 * @param options - Display options.
 * @param cliOutput - CLI output service instance.
 */
const displayUserInfo = (
  user: IUser,
  options: IDisplayOptions,
  cliOutput: CliOutputService
): void => {
  if (options.format === 'json') {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.USERS, 'User data', { user });
  } else {
    cliOutput.keyValue({
      "ID": user.id,
      "Username": user.username,
      "Email": user.email,
      "Status": user.status,
      'Updated At': user.updated_at || 'N/A'
    });
  }
};

/**
 * Validates and extracts CLI arguments.
 * @param contextArgs - Raw context arguments.
 * @returns Validated CLI arguments.
 */
const extractArgs = (contextArgs: Record<string, unknown>): IUpdateUserArgs => {
  const args: IUpdateUserArgs = {};

  if (typeof contextArgs.id === 'string') {
    args.id = contextArgs.id;
  }
  if (typeof contextArgs.email === 'string') {
    args.email = contextArgs.email;
  }
  if (typeof contextArgs.status === 'string') {
    args.status = contextArgs.status;
  }
  if (typeof contextArgs.format === 'string') {
    args.format = contextArgs.format;
  }

  return args;
};

export const command: ICLICommand = {
  description: 'Update user information',
  execute: async (context: ICLIContext): Promise<void> => {
    const args = extractArgs(context.args);
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const usersService = UsersService.getInstance();
      const userId = validateUserId(args, cliOutput);
      const updateData = buildUpdateData(args, cliOutput);

      cliOutput.section('Updating User');
      const user = await usersService.updateUser(userId, updateData);
      cliOutput.success('User updated successfully');
      const displayOptions: IDisplayOptions = {};
      if (args.format) {
        displayOptions.format = args.format;
      }
      displayUserInfo(user, displayOptions, cliOutput);
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
