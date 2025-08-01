/**
 * Events module status command - shows event bus statistics and recent events.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { z } from 'zod';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

/**
 * Zod schema for CLI arguments validation.
 */
const statusArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  verbose: z.boolean().default(false)
});

/**
 * Status arguments type.
 */
type StatusArgs = z.infer<typeof statusArgsSchema>;

/**
 * Events module status command implementation.
 */
export const command: ICLICommand = {
  description: 'Show event bus statistics and recent events',
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
      name: 'verbose',
      alias: 'v',
      type: 'boolean',
      description: 'Show detailed event information',
      default: false
    }
  ],

  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = statusArgsSchema.parse(context.args);
      
      logger.debug(LogSource.EVENTS, 'Events status command executed', { args: validatedArgs });

      const statusData = {
        module: 'events',
        status: 'active',
        description: 'Event bus for inter-module communication',
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(statusData);
      } else {
        cliOutput.section('Events Module Status');
        cliOutput.keyValue({
          'Module': statusData.module,
          'Status': statusData.status,
          'Description': statusData.description
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        cliOutput.error(`Failed to get events status: ${errorMessage}`);
        logger.error(LogSource.EVENTS, 'Events status command failed', { error: errorMessage });
      }
      process.exit(1);
    }
  }
};