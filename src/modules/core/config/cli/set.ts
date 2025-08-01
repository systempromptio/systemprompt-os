/**
 * Config set CLI command - sets configuration values.
 * @file Config set CLI command.
 * @module modules/core/config/cli/set
 */

import { z } from 'zod';
import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

// Zod schema for command arguments
const setArgsSchema = z.object({
  key: z.string().min(1, 'Configuration key cannot be empty'),
  value: z.string().min(1, 'Configuration value cannot be empty'),
  format: z.enum(['text', 'json']).default('text')
});

/**
 * Parse a string value into appropriate type.
 * @param value - String value to parse.
 * @returns Parsed value.
 */
const parseValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const command: ICLICommand = {
  description: 'Set configuration value',
  options: [
    {
      name: 'key',
      alias: 'k',
      type: 'string',
      description: 'Configuration key',
      required: true
    },
    {
      name: 'value',
      alias: 'v',
      type: 'string',
      description: 'Configuration value',
      required: true
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = setArgsSchema.parse(context.args);

      await configModule.initialize();
      const configService = configModule.exports.service();

      const parsedValue = parseValue(validatedArgs.value);

      await configService.set(validatedArgs.key, parsedValue);

      const storedValue = await configService.get(validatedArgs.key);

      if (validatedArgs.format === 'json') {
        cliOutput.json({
          key: validatedArgs.key,
          value: storedValue,
          message: 'Configuration updated successfully'
        });
      } else {
        cliOutput.success('Configuration updated successfully');
        cliOutput.keyValue({
          [validatedArgs.key]: typeof storedValue === 'string'
            ? storedValue
            : JSON.stringify(storedValue)
        });
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Failed to set configuration');
        logger.error(LogSource.CLI, 'Failed to set configuration', {
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
      process.exit(1);
    }
  },
};
