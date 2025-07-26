/**
 * @file Config set CLI command.
 * @module modules/core/config/cli/set
 */

import { ConfigModule } from '@/modules/core/config/index';
import type { ConfigValue } from '@/modules/core/config/types/index';

interface SetCommandContext {
  key?: string;
  value?: string;
}

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

export const command = {
  description: 'Set configuration value',
  execute: async (context: SetCommandContext): Promise<void> => {
    const { key, value } = context;

    if (!key || !value) {
      console.error('Error: Both key and value are required.');
      process.exit(1);
    }

    const configModule = new ConfigModule();
    await configModule.initialize();

    const parsedValue = parseValue(value);

    await configModule.set(key, parsedValue);

    console.log('✓ Configuration updated:');
    console.log(`  ${key} = ${formatValue(parsedValue)}`);
  },
};
