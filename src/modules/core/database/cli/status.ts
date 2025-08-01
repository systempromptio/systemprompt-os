/**
 * Database status CLI command.
 * This module provides functionality to display database connection health
 * and status information in various formats.
 * @file Database status CLI command.
 * @module modules/core/database/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/manual';
import {
  DatabaseStatusService,
  type IStatusParams,
} from '@/modules/core/cli/services/database-status.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  ISchemaVersion,
  StatusFormat,
} from '@/modules/core/database/types/manual';
import { z } from 'zod';

/**
 * CLI arguments schema for status command.
 */
const statusArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  detailed: z.boolean().default(false),
});

/**
 * Handle status command execution.
 * @param params - Status parameters.
 * @param cliOutput - CLI output service instance.
 * @param logger - Logger service instance.
 */
const handleStatusExecution = async (
  params: IStatusParams,
  cliOutput: CliOutputService,
  logger: LoggerService,
): Promise<void> => {
  const statusService = DatabaseStatusService.getInstance();
  const result = await statusService.getStatus(params);

  if (!result.success) {
    cliOutput.error(result.message ?? 'Unknown error');
    logger.error(LogSource.DATABASE, result.message ?? 'Unknown error');
    process.exit(1);
    return;
  }

  if (result.data === undefined) {
    cliOutput.error('No status data received');
    logger.error(LogSource.DATABASE, 'No status data received');
    process.exit(1);
    return;
  }

  const { format = 'text' } = params;

  if (format === 'json') {
    cliOutput.output(result.data, { format: 'json' });
    return;
  }

  cliOutput.section('Database Status');

  const statusIcon = result.data.connected ? '✓' : '✗';

  cliOutput.keyValue({
    Connected: statusIcon,
    Initialized: result.data.initialized ? '✓' : '✗',
    Type: result.data.type,
    Timestamp: result.data.timestamp,
  });

  if (params.detailed && (result.data.tableCount !== undefined || result.data.error !== undefined)) {
    cliOutput.section('Detailed Information');

    if (result.data.error !== undefined) {
      cliOutput.error(`Error: ${result.data.error}`);
    } else {
      if (result.data.tableCount !== undefined) {
        cliOutput.info(`Tables: ${String(result.data.tableCount)}`);
      }

      if (result.data.tables !== undefined && result.data.tables.length > 0) {
        cliOutput.section('Table Names');
        cliOutput.list(result.data.tables);
      }

      if (result.data.schemaVersions !== undefined && result.data.schemaVersions.length > 0) {
        cliOutput.section('Schema Versions');
        result.data.schemaVersions.forEach((schema: ISchemaVersion) => {
          cliOutput.info(`${schema.module}: ${schema.version}`);
        });
      }
    }
  }
};

export const command = {
  description: 'Show database connection health and status',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
    {
      name: 'detailed',
      alias: 'd',
      type: 'boolean',
      description: 'Show detailed information',
      default: false
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = statusArgsSchema.parse(context.args);

      const params: IStatusParams = {
        format: validatedArgs.format as StatusFormat,
        detailed: validatedArgs.detailed,
      };

      await handleStatusExecution(params, cliOutput, logger);
      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }

      cliOutput.error('Error getting database status');
      logger.error(LogSource.DATABASE, 'Error getting database status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
