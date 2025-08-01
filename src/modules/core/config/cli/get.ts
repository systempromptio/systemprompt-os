/**
 * Config get CLI command - retrieves configuration values by key.
 * @file Config get CLI command.
 * @module modules/core/config/cli/get
 */

import { z } from 'zod';
import { ConfigService } from '../services/config.service';
import type { ICLICommand, ICLIContext } from '../../cli/types/manual';
import { LoggerService } from '../../logger/services/logger.service';
import { LogSource } from '../../logger/types/manual';
import { CliOutputService } from '../../cli/services/cli-output.service';

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

      const configService = ConfigService.getInstance();
      await configService.initialize();
      const config = await configService.getConfig(validatedArgs.key);

      if (!config) {
        cliOutput.error(`Configuration key '${validatedArgs.key}' not found`);
        process.exit(1);
      }

      if (validatedArgs.format === 'json') {
        cliOutput.json(config);
      } else {
        cliOutput.section('Configuration Details');
        cliOutput.keyValue({
          'Key': config.key,
          'Value': config.value,
          'Type': config.type,
          'Description': config.description || 'N/A',
          'Created': config.createdAt.toLocaleString(),
          'Updated': config.updatedAt.toLocaleString()
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
        cliOutput.error('Failed to get configuration');
        logger.error(LogSource.CONFIG, 'Failed to get configuration', {
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
      process.exit(1);
    }
  },
};
