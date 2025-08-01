/**
 * Events module get command - get details of a specific event by ID.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { z } from 'zod';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { EventBusService } from '@/modules/core/events/services/events.service';

/**
 * Zod schema for CLI arguments validation.
 */
const getArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  id: z.string().min(1, 'Event ID is required')
});

/**
 * Events module get command implementation.
 */
export const command: ICLICommand = {
  description: 'Get details of a specific event by ID',
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
      name: 'id',
      alias: 'i',
      type: 'string',
      description: 'Event ID',
      required: true
    }
  ],

  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = getArgsSchema.parse(context.args);

      logger.debug(LogSource.MODULES, 'Events get command executed', { args: validatedArgs });

      const eventBusService = EventBusService.getInstance();

      const event = await eventBusService.getEventById(validatedArgs.id);

      if (!event) {
        const notFoundResult = {
          success: false,
          error: 'Event not found',
          id: validatedArgs.id
        };

        if (validatedArgs.format === 'json') {
          cliOutput.json(notFoundResult);
        } else {
          cliOutput.error(`Event with ID '${validatedArgs.id}' not found`);
        }
        process.exit(1);
      }

      let eventData = null;
      if (event.event_data) {
        try {
          eventData = JSON.parse(event.event_data);
        } catch {
          eventData = event.event_data;
        }
      }

      const result = {
        ...event,
        event_data: eventData
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(result);
      } else {
        cliOutput.section('Event Details');
        cliOutput.keyValue({
          'ID': event.id,
          'Event Name': event.event_name,
          'Module Source': event.module_source || 'N/A',
          'Emitted At': new Date(event.emitted_at).toLocaleString(),
          'Created At': new Date(event.created_at).toLocaleString()
        });

        if (eventData) {
          cliOutput.section('Event Data');
          if (typeof eventData === 'object') {
            cliOutput.info(JSON.stringify(eventData, null, 2));
          } else {
            cliOutput.info(String(eventData));
          }
        }
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
        cliOutput.error(`Failed to get event: ${errorMessage}`);
        logger.error(LogSource.MODULES, 'Events get command failed', { error: errorMessage });
      }
      process.exit(1);
    }
  }
};
