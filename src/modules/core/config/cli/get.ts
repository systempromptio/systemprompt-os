/**
 * Config get CLI command - retrieves configuration values by key or lists all configuration.
 * @file Config get CLI command.
 * @module modules/core/config/cli/get
 */

import { getConfigModule } from '@/modules/core/config/index';
import type { ICLIContext } from '@/modules/core/cli/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

/**
 * Extracts the key from the context object.
 * @param context - CLI context or simple object with key.
 * @returns The extracted key or undefined.
 */
const extractKey = (context: ICLIContext | { key?: string }): string | undefined => {
  if ('args' in context) {
    const { args } = context;
    const { key: argsKey } = args;
    return typeof argsKey === 'string' ? argsKey : undefined;
  }
  const { key } = context;
  return key;
};

/**
 * Handles the case when no configuration key is provided.
 * @param value - The configuration value (should be array or undefined).
 * @param logger - Logger instance.
 * @param cliOutput
 */
const handleNoKey = (
  value: unknown,
  logger: ReturnType<typeof LoggerService.getInstance>,
  cliOutput: ReturnType<typeof CliOutputService.getInstance>
): void => {
  if (value === undefined) {
    cliOutput.info('No configuration values found.');
    return;
  }

  try {
    cliOutput.info(JSON.stringify(value, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error serializing configuration value: ${errorMessage}`);
    logger.error(LogSource.CLI, `Error serializing configuration value: ${errorMessage}`);
    process.exit(1);
  }
};

/**
 * Handles the case when a specific configuration key is provided.
 * @param key - The configuration key.
 * @param value - The configuration value.
 * @param logger - Logger instance.
 * @param cliOutput
 */
const handleSpecificKey = (
  key: string,
  value: unknown,
  logger: ReturnType<typeof LoggerService.getInstance>,
  cliOutput: ReturnType<typeof CliOutputService.getInstance>
): void => {
  if (value === undefined || value === null) {
    cliOutput.error(`Configuration key '${key}' not found.`);
    logger.error(LogSource.CLI, `Configuration key '${key}' not found.`);
    process.exit(1);
  }

  try {
    cliOutput.info(JSON.stringify(value, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error serializing configuration value: ${errorMessage}`);
    logger.error(LogSource.CLI, `Error serializing configuration value: ${errorMessage}`);
    process.exit(1);
  }
};

export const command = {
  description: 'Get configuration value(s)',
  execute: async (context: ICLIContext | { key?: string }): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    const key = extractKey(context);

    try {
      const configModule = await getConfigModule();
      const value = await configModule.exports.get(key);

      if (key !== undefined && key !== '') {
        handleSpecificKey(key, value, logger, cliOutput);
      } else {
        handleNoKey(value, logger, cliOutput);
      }
    } catch (error) {
      cliOutput.error('Failed to get configuration');
      logger.error(LogSource.CLI, 'Failed to get configuration', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  },
};
