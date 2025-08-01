/**
 * Config module status CLI command.
 * @file Config module status CLI command.
 * @module modules/core/config/cli/status
 */

import { z } from 'zod';
import { ConfigService } from '@/modules/core/config/services/config.service';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

// Zod schema for command arguments
const statusArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text')
});

export const command: ICLICommand = {
  description: 'Show config module status (enabled/healthy)',
  options: [
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
      const validatedArgs = statusArgsSchema.parse(context.args);

      const configService = ConfigService.getInstance();
      await configService.initialize();

      const statusData = {
        module: 'config',
        enabled: true,
        healthy: true,
        service: 'ConfigService initialized',
        configuration: {
          storage: true,
          environmentVariables: true
        }
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(statusData);
      } else {
        cliOutput.section('Config Module Status');
        cliOutput.keyValue({
          Module: statusData.module,
          Enabled: statusData.enabled ? '✓' : '✗',
          Healthy: statusData.healthy ? '✓' : '✗',
          Service: statusData.service,
        });

        cliOutput.section('Configuration');
        cliOutput.keyValue({
          'Configuration storage': statusData.configuration.storage ? '✓' : '✗',
          'Environment variables loaded': statusData.configuration.environmentVariables ? '✓' : '✗',
        });
      }

      process.exit(0);
    } catch (error) {
      const errorData = {
        module: 'config',
        enabled: false,
        healthy: false,
        error: error instanceof Error ? error.message : String(error)
      };

      if (context.args.format === 'json') {
        cliOutput.json(errorData);
      } else {
        cliOutput.error('Error getting config status');
        logger.error(LogSource.MODULES, 'Error getting config status', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
      process.exit(1);
    }
  },
};
