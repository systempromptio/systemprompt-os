/**
 * Events module status command - shows event bus statistics and recent events.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { z } from 'zod';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { EventBusService } from '@/modules/core/events/services/events.service';
import { type StatusArgs, cliSchemas } from '@/modules/core/events/utils/cli-validation';

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
    },
    {
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Number of recent events to show',
      default: 10
    }
  ],

  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs: StatusArgs = cliSchemas.status.parse(context.args);

      logger.debug(LogSource.MODULES, 'Events status command executed', { args: validatedArgs });

      const eventBusService = EventBusService.getInstance();
      const serviceStatus = eventBusService.getServiceStatus();

      const [eventStats, subscriptions, recentEvents] = await Promise.all([
        eventBusService.getEventStats(),
        eventBusService.getActiveSubscriptions(),
        eventBusService.getRecentEvents(validatedArgs.limit)
      ]);

      const statusData = {
        module: 'events',
        status: serviceStatus,
        statistics: {
          total_events: eventStats.total_events,
          active_subscriptions: subscriptions.length,
          recent_events_count: recentEvents.length,
          active_listeners: serviceStatus.listeners
        },
        subscriptions,
        recent_events: validatedArgs.verbose
          ? recentEvents.map(event => { return {
              ...event,
              event_data: event.event_data ? JSON.parse(event.event_data) : null
            } })
          : recentEvents.map(event => { return {
              id: event.id,
              event_name: event.event_name,
              emitted_at: event.emitted_at,
              module_source: event.module_source
            } }),
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(statusData);
      } else {
        cliOutput.section('Event Bus Status');
        cliOutput.keyValue({
          'Service Status': statusData.status.healthy ? 'Healthy' : 'Unhealthy',
          'Uptime': statusData.status.uptime,
          'Active Listeners': statusData.statistics.active_listeners.toString(),
          'Total Events': statusData.statistics.total_events.toString(),
          'Active Subscriptions': statusData.statistics.active_subscriptions.toString(),
          'Recent Events': statusData.statistics.recent_events_count.toString()
        });

        if (statusData.recent_events.length > 0) {
          cliOutput.section('Recent Events');
          statusData.recent_events.forEach((event: any) => {
            cliOutput.info(`${event.event_name} (${event.emitted_at})`);
            if (validatedArgs.verbose && event.event_data) {
              cliOutput.info(`  Data: ${JSON.stringify(event.event_data, null, 2)}`);
            }
          });
        }

        if (statusData.subscriptions.length > 0) {
          cliOutput.section('Active Subscriptions');
          statusData.subscriptions.forEach(sub => {
            cliOutput.info(`${sub.event_name}: ${sub.subscriber_count} subscribers`);
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
        cliOutput.error(`Failed to get events status: ${errorMessage}`);
        logger.error(LogSource.MODULES, 'Events status command failed', { error: errorMessage });
      }
      process.exit(1);
    }
  }
};
