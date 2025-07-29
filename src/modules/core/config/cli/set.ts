/**
 * @file Config set CLI command.
 * @module modules/core/config/cli/set
 */

import { getConfigModule } from '@/modules/core/config/index';
import type { ConfigValue } from '@/modules/core/config/types/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Parse a string value into appropriate type.
 * @param {string} value - String value to parse.
 * @returns {unknown} Parsed value.
 */
function parseValue(value: string): ConfigValue {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Format value for display.
 * @param {unknown} value - Value to format.
 * @returns {string} Formatted value string.
 */
function formatValue(value: ConfigValue): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export const command: ICLICommand = {
  description: 'Set configuration value',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const key = args.key as string | undefined;
    const value = args.value as string | undefined;

    if (!key || !value) {
      cliOutput.error('Error: Both key and value are required.');
      process.exit(1);
    }

    try {
      const configModule = getConfigModule();
      const parsedValue = parseValue(value);

      await configModule.exports.set(key, parsedValue);

      cliOutput.success('Configuration updated:');
      cliOutput.keyValue({
        [key]: formatValue(parsedValue)
      });
    } catch (error) {
      cliOutput.error('Failed to set configuration');
      logger.error(LogSource.CLI, 'Failed to set configuration', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  },
};
