/**
 * Events module list command - lists recent events with filtering options.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { z } from 'zod';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { EventBusService } from '@/modules/core/events/services/events.service';
import { type ListArgs, cliSchemas } from '@/modules/core/events/utils/cli-validation';

/**
 * Events module list command implementation.
 */
export const command: ICLICommand = {
  description: 'List recent events with optional filtering',
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
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Maximum number of events to return',
      default: 20
    },
    {
      name: 'eventName',
      alias: 'n',
      type: 'string',
      description: 'Filter by specific event name'
    },
    {
      name: 'verbose',
      alias: 'v',
      type: 'boolean',
      description: 'Show full event data',
      default: false
    }
  ],

  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs: ListArgs = cliSchemas.list.parse(context.args);

      logger.debug(LogSource.MODULES, 'Events list command executed', { args: validatedArgs });

      const eventBusService = EventBusService.getInstance();

      const events = validatedArgs.eventName
        ? await eventBusService.getEventsByName(validatedArgs.eventName, validatedArgs.limit)
        : await eventBusService.getRecentEvents(validatedArgs.limit);

      const processedEvents = events.map(event => {
        if (validatedArgs.verbose) {
          return {
            ...event,
            event_data: event.event_data ? JSON.parse(event.event_data) : null
          };
        }
        return {
          id: event.id,
          event_name: event.event_name,
          emitted_at: event.emitted_at,
          module_source: event.module_source
        };
      });

      if (validatedArgs.format === 'json') {
        cliOutput.json(processedEvents);
      } else if (events.length === 0) {
          cliOutput.info('No events found');
        } else {
          cliOutput.section(`Events (${events.length})`);
          cliOutput.table(processedEvents, [
            {
 key: 'id',
header: 'ID',
width: 36
},
            {
 key: 'event_name',
header: 'Event Name',
width: 30
},
            {
 key: 'module_source',
header: 'Source',
width: 15
},
            {
 key: 'emitted_at',
header: 'Emitted At',
width: 20,
format: (value: unknown): string => {
  return new Date(value as string).toLocaleString();
}
}
          ]);

          if (validatedArgs.verbose) {
            cliOutput.section('Event Details');
            events.forEach((event, index) => {
              cliOutput.info(`${index + 1}. ${event.event_name}`);
              if (event.event_data) {
                try {
                  const data = JSON.parse(event.event_data);
                  cliOutput.info(`   Data: ${JSON.stringify(data, null, 2)}`);
                } catch {
                  cliOutput.info(`   Data: ${event.event_data}`);
                }
              }
            });
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
        cliOutput.error(`Failed to list events: ${errorMessage}`);
        logger.error(LogSource.MODULES, 'Events list command failed', { error: errorMessage });
      }
      process.exit(1);
    }
  }
};
