/**
 * Database status CLI command.
 * This module provides functionality to display database connection health
 * and status information in various formats.
 * @file Database status CLI command.
 * @module modules/core/database/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import {
  DatabaseStatusService,
  type IStatusParams,
} from '@/modules/core/cli/services/database-status.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  ISchemaVersion,
  IStatusData,
  StatusFormat,
} from '@/modules/core/cli/types/database-status.types';

/**
 * Output detailed status information.
 * @param statusData - Database status data.
 * @param logger - Logger service instance.
 */
const outputDetailedInfo = (
  statusData: IStatusData,
  logger: LoggerService,
): void => {
  if (statusData.tableCount !== undefined) {
    logger.info(LogSource.DATABASE, `  Tables: ${String(statusData.tableCount)}`);
  }

  if (statusData.tables !== undefined && statusData.tables.length > 0) {
    logger.info(LogSource.DATABASE, '  Table Names:');
    statusData.tables.forEach((table): void => {
      logger.info(LogSource.DATABASE, `    - ${table}`);
    });
  }

  if (statusData.schemaVersions !== undefined && statusData.schemaVersions.length > 0) {
    logger.info(LogSource.DATABASE, '  Schema Versions:');
    statusData.schemaVersions.forEach((schema: ISchemaVersion): void => {
      logger.info(LogSource.DATABASE, `    ${schema.module}: ${schema.version}`);
    });
  }
};

/**
 * Output status information in JSON format.
 * @param statusData - Database status data.
 * @param logger - Logger service instance.
 */
const outputJsonFormat = (
  statusData: IStatusData,
  logger: LoggerService,
): void => {
  const jsonOutput = JSON.stringify(statusData, null, 2);
  logger.info(LogSource.DATABASE, jsonOutput);
};

/**
 * Output status information in text format.
 * @param statusData - Database status data.
 * @param logger - Logger service instance.
 */
const outputTextFormat = (
  statusData: IStatusData,
  logger: LoggerService,
): void => {
  console.log('Database Status:');
  console.log(`  Connected: ${statusData.connected ? '✓' : '✗'}`);
  console.log(`  Initialized: ${statusData.initialized ? '✓' : '✗'}`);
  console.log(`  Type: ${statusData.type}`);
  console.log(`  Timestamp: ${statusData.timestamp}`);

  const hasDetailedInfo = statusData.tableCount !== undefined || statusData.error !== undefined;
  if (hasDetailedInfo) {
    console.log('');
    console.log('Detailed Information:');

    if (statusData.error === undefined) {
      outputDetailedInfo(statusData, logger);
    } else {
      console.log(`  Error: ${statusData.error}`);
    }
  }
};

/**
 * Handle status command execution.
 * @param params - Status parameters.
 * @param logger - Logger service instance.
 */
const handleStatusExecution = async (
  params: IStatusParams,
  logger: LoggerService,
): Promise<void> => {
  const statusService = DatabaseStatusService.getInstance();
  const result = await statusService.getStatus(params);

  if (!result.success) {
    logger.error(LogSource.DATABASE, result.message ?? 'Unknown error');
    process.exit(1);
    return;
  }

  if (result.data === undefined) {
    logger.error(LogSource.DATABASE, 'No status data received');
    process.exit(1);
    return;
  }

  const { format = 'text' } = params;

  if (format === 'json') {
    outputJsonFormat(result.data, logger);
  } else {
    outputTextFormat(result.data, logger);
  }
};

export const command = {
  description: 'Show database connection health and status',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    
    console.log('Database status command executing...');

    const formatValue = args.format ?? 'text';
    const format: StatusFormat = formatValue === 'json' ? 'json' : 'text';
    const detailed = args.detailed === true;

    const params: IStatusParams = {
      format,
      detailed,
    };

    try {
      await handleStatusExecution(params, logger);
    } catch (error) {
      console.error('Status command error:', error);
      logger.error(LogSource.DATABASE, 'Error getting database status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }

    process.exit(0);
  },
};
