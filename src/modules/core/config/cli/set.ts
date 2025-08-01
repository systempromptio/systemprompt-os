/**
 * Config set CLI command - sets configuration values.
 * @file Config set CLI command.
 * @module modules/core/config/cli/set
 */

import { configModule } from '@/modules/core/config/index';
import type { ConfigValue } from '@/modules/core/config/types/manual';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Parse a string value into appropriate type.
 * @param {string} value - String value to parse.
 * @returns {ConfigValue} Parsed value.
 */
const parseValue = (value: string): ConfigValue => {
  try {
    return JSON.parse(value) as ConfigValue;
  } catch {
    return value;
  }
};

/**
 * Format value for display.
 * @param {ConfigValue} value - Value to format.
 * @returns {string} Formatted value string.
 */
const formatValue = (value: ConfigValue): string => {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * Validate required arguments for set command.
 * @param key - Configuration key.
 * @param value - Configuration value.
 * @param cliOutput - CLI output service.
 * @returns True if valid, exits process if invalid.
 */
const validateSetArgs = (
  key: unknown,
  value: unknown,
  cliOutput: CliOutputService
): { validKey: string; validValue: string } => {
  const typedKey = typeof key === 'string' ? key : undefined;
  const typedValue = typeof value === 'string' ? value : undefined;

  if (!typedKey || typedKey.trim() === ''
      || !typedValue || typedValue.trim() === '') {
    cliOutput.error('Error: Both key and value are required.');
    process.exit(1);
  }

  return {
 validKey: typedKey,
validValue: typedValue
};
};

export const command: ICLICommand = {
  description: 'Set configuration value',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const { key, value } = args;
    const { validKey, validValue } = validateSetArgs(key, value, cliOutput);

    try {
      await configModule.initialize();
      const parsedValue = parseValue(validValue);

      await configModule.exports.service().set(validKey, parsedValue);

      cliOutput.success('Configuration updated:');
      cliOutput.keyValue({
        [validKey]: formatValue(parsedValue)
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
