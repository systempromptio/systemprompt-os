/**
 * Events module clear command - clear event history and subscriptions.
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
const clearArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  type: z.enum(['events', 'subscriptions', 'all']).default('events'),
  confirm: z.boolean().default(false)
});

/**
 * Events module clear command implementation.
 */
export const command: ICLICommand = {
  description: 'Clear event history and/or subscriptions (use with caution)',
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
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'What to clear',
      choices: ['events', 'subscriptions', 'all'],
      default: 'events'
    },
    {
      name: 'confirm',
      alias: 'y',
      type: 'boolean',
      description: 'Confirm the operation without prompting',
      default: false
    }
  ],

  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = clearArgsSchema.parse(context.args);

      logger.debug(LogSource.MODULES, 'Events clear command executed', { args: validatedArgs });

      if (!validatedArgs.confirm) {
        cliOutput.error('This operation will permanently delete data.');
        cliOutput.error('Use --confirm flag to proceed with the clear operation.');
        process.exit(1);
      }

      const eventBusService = EventBusService.getInstance();

      const cleared = {
        events: false,
        subscriptions: false,
        listeners: false
      };

      const beforeStats = await eventBusService.getEventStats();
      const beforeSubscriptions = await eventBusService.getActiveSubscriptions();

      if (validatedArgs.type === 'events' || validatedArgs.type === 'all') {
        await eventBusService.clearEvents();
        cleared.events = true;
      }

      if (validatedArgs.type === 'subscriptions' || validatedArgs.type === 'all') {
        await eventBusService.clearSubscriptions();
        eventBusService.removeAllListeners();
        cleared.subscriptions = true;
        cleared.listeners = true;
      }

      const afterStats = await eventBusService.getEventStats();
      const afterSubscriptions = await eventBusService.getActiveSubscriptions();

      const result = {
        success: true,
        cleared,
        before: {
          events: beforeStats.total_events,
          subscriptions: beforeSubscriptions.length
        },
        after: {
          events: afterStats.total_events,
          subscriptions: afterSubscriptions.length
        },
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(result);
      } else {
        cliOutput.success('Clear operation completed');

        if (cleared.events) {
          cliOutput.info(`Events cleared: ${result.before.events} → ${result.after.events}`);
        }

        if (cleared.subscriptions) {
          cliOutput.info(`Subscriptions cleared: ${result.before.subscriptions} → ${result.after.subscriptions}`);
        }

        if (cleared.listeners) {
          cliOutput.info('In-memory event listeners cleared');
        }

        cliOutput.keyValue({
          'Operation': validatedArgs.type,
          'Events Before': result.before.events.toString(),
          'Events After': result.after.events.toString(),
          'Subscriptions Before': result.before.subscriptions.toString(),
          'Subscriptions After': result.after.subscriptions.toString()
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
        cliOutput.error(`Failed to clear events: ${errorMessage}`);
        logger.error(LogSource.MODULES, 'Events clear command failed', { error: errorMessage });
      }
      process.exit(1);
    }
  }
};
