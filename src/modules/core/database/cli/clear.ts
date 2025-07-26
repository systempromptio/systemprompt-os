/**
 * Database clear CLI command that provides a safe way to clear all data from database tables
 * while preserving the schema structure. Includes safety checks and confirmation mechanisms.
 * @file Database clear CLI command.
 * @module modules/core/database/cli/clear
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import {
  DatabaseClearService,
  type IClearParams,
} from '@/modules/core/cli/services/database-clear.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Handle clear command execution.
 * @param params - Clear parameters.
 * @param logger - Logger service instance.
 */
const handleClearExecution = async function handleClearExecution(
  params: IClearParams,
  logger: LoggerService
): Promise<void> {
  const clearService = DatabaseClearService.getInstance();
  const result = await clearService.handleClear(params);

  if (!result.success) {
    logger.error(LogSource.CLI, result.message);
    process.exit(1);
  }

  logger.info(LogSource.CLI, result.message);
};

export const command = {
  description: 'Clear all data from database tables (preserves schema)',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();

    const force = Boolean(args.force);
    const confirm = Boolean(args.confirm);

    const params: IClearParams = {
      force,
      confirm
    };

    try {
      await handleClearExecution(params, logger);
    } catch (error) {
      logger.error(LogSource.CLI, 'Error clearing database', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }

    process.exit(0);
  }
};
