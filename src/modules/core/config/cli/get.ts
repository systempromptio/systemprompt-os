/**
 * Config get CLI command - retrieves configuration values by key.
 * @file Config get CLI command.
 * @module modules/core/config/cli/get
 */

import { z } from 'zod';
import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

// Zod schema for command arguments
const getArgsSchema = z.object({
  key: z.string().min(1, 'Configuration key cannot be empty'),
  format: z.enum(['text', 'json']).default('text')
});

export const command: ICLICommand = {
  description: 'Get configuration value by key',
  options: [
    {
      name: 'key',
      alias: 'k',
      type: 'string',
      description: 'Configuration key to retrieve',
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
      const validatedArgs = getArgsSchema.parse(context.args);

      await configModule.initialize();
      const configService = configModule.exports.service();
      const value = await configService.get(validatedArgs.key);

      if (value === undefined || value === null) {
        cliOutput.error(`Configuration key '${validatedArgs.key}' not found`);
        process.exit(1);
      }

      if (validatedArgs.format === 'json') {
        cliOutput.json({
 key: validatedArgs.key,
value
});
      } else if (typeof value === 'string') {
          cliOutput.output(value);
        } else {
          cliOutput.output(JSON.stringify(value, null, 2));
        }

      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Failed to get configuration');
        logger.error(LogSource.CLI, 'Failed to get configuration', {
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
      process.exit(1);
    }
  },
};
