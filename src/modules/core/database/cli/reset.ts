/**
 * Database reset CLI command implementation.
 * This command provides a complete database removal and recreation operation.
 * @file Database reset CLI command.
 * @module modules/core/database/cli/reset
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import {
  DatabaseResetService,
  type IResetParams
} from '@/modules/core/cli/services/database-reset.service';
import type { ICLIContext } from '@/modules/core/cli/types/index';

/**
 * Handle reset command execution.
 * @param params - Reset parameters.
 * @param logger - Logger service instance.
 */
const handleResetExecution = async function handleResetExecution(
  params: IResetParams,
  logger: LoggerService
): Promise<void> {
  const resetService = DatabaseResetService.getInstance();
  const cliOutput = CliOutputService.getInstance();

  cliOutput.section('Database Reset', 'Complete database removal and recreation');
  logger.info(LogSource.CLI, 'Starting database reset...');

  const result = await resetService.handleReset(params, logger);

  if (!result.success) {
    cliOutput.error(result.message);
    logger.error(LogSource.CLI, result.message);
    process.exit(1);
  }

  if (result.details !== null && result.details !== undefined) {
    cliOutput.success(
      `Reset completed: database file removed and recreated, `
      + `${String(result.details.filesImported)} schemas imported`
    );
  }

  cliOutput.success(result.message);
  logger.info(LogSource.CLI, result.message);
};

/**
 * Database reset command configuration.
 */
export const command = {
  description: 'Reset database - completely remove and recreate database file',
  options: [
    {
      name: 'force',
      alias: 'f',
      type: 'boolean',
      description: 'Force reset without confirmation'
    },
    {
      name: 'confirm',
      alias: 'c',
      type: 'boolean',
      description: 'Confirm reset operation'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();

    const force = Boolean(args.force);
    const confirm = Boolean(args.confirm);

    const params: IResetParams = {
      force,
      confirm
    };

    try {
      await handleResetExecution(params, logger);
    } catch (error) {
      logger.error(LogSource.CLI, 'Error resetting database', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }

    process.exit(0);
  }
};