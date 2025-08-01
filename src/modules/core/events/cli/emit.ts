/**
 * Events module emit command - emit an event for testing and debugging.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { z } from 'zod';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { EventBusService } from '@/modules/core/events/services/events.service';
import { type EmitArgs, cliSchemas } from '@/modules/core/events/utils/cli-validation';

/**
 * Events module emit command implementation.
 */
export const command: ICLICommand = {
  description: 'Emit an event for testing and debugging purposes',
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
      name: 'eventName',
      alias: 'n',
      type: 'string',
      description: 'Name of the event to emit',
      required: true
    },
    {
      name: 'data',
      alias: 'd',
      type: 'string',
      description: 'Event data as JSON string or plain text'
    },
    {
      name: 'source',
      alias: 's',
      type: 'string',
      description: 'Source module name',
      default: 'cli'
    }
  ],

  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs: EmitArgs = cliSchemas.emit.parse(context.args);

      logger.debug(LogSource.MODULES, 'Events emit command executed', { args: validatedArgs });

      const eventBusService = EventBusService.getInstance();

      eventBusService.emit(validatedArgs.eventName, validatedArgs.data);

      const result = {
        success: true,
        event_name: validatedArgs.eventName,
        data: validatedArgs.data,
        source: validatedArgs.source,
        emitted_at: new Date().toISOString(),
        listeners: eventBusService.listenerCount(validatedArgs.eventName)
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(result);
      } else {
        cliOutput.success(`Event '${validatedArgs.eventName}' emitted successfully`);
        cliOutput.keyValue({
          'Event Name': validatedArgs.eventName,
          'Source': validatedArgs.source,
          'Listeners': result.listeners.toString(),
          'Data': JSON.stringify(validatedArgs.data, null, 2),
          'Emitted At': result.emitted_at
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
        cliOutput.error(`Failed to emit event: ${errorMessage}`);
        logger.error(LogSource.MODULES, 'Events emit command failed', { error: errorMessage });
      }
      process.exit(1);
    }
  }
};
