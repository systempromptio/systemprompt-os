import type { ICLICommand } from '@/modules/core/cli/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
// Event bus service not needed in CLI status command
import { DatabaseService } from '@/modules/core/database/services/database.service';
import chalk from 'chalk';

/**
 * Events module status command - shows event bus statistics and recent events.
 */
export const statusCommand: ICLICommand = {
  name: 'status',
  description: 'Show event bus statistics and recent events',
  options: [
    {
      name: 'verbose',
      alias: 'v',
      type: 'boolean',
      description: 'Show detailed event information',
    },
    {
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Number of recent events to show',
      default: 10,
    },
  ],

  async execute(context: { args: Record<string, unknown> }): Promise<void> {
    const {args} = context;
    const logger = LoggerService.getInstance();
    const db = DatabaseService.getInstance();

    const verbose = args.verbose as boolean;
    const limit = args.limit as number;

    try {
      logger.debug(LogSource.CLI, 'Events status command executed', { args });

      console.log(chalk.cyan('\n📡 Event Bus Status\n'));

      const statsResult = await db.query<{ total_events: number }>(
        'SELECT COUNT(*) as total_events FROM events'
      );
      const stats = statsResult[0];

      const recentEvents = await db.query<{
        event_name: string;
        emitted_at: string;
        module_source: string | null;
        event_data: string | null;
      }>(
        'SELECT event_name, emitted_at, module_source, event_data FROM events ORDER BY emitted_at DESC LIMIT ?',
        [limit]
      );

      const subscriptions = await db.query<{
        event_name: string;
        subscriber_count: number;
      }>(
        `SELECT event_name, COUNT(*) as subscriber_count 
         FROM event_subscriptions 
         WHERE active = TRUE 
         GROUP BY event_name`
      );

      console.log(chalk.white('Statistics:'));
      console.log(`  Total Events: ${chalk.green(stats?.total_events || 0)}`);
      console.log(`  Active Subscriptions: ${chalk.green(subscriptions.length)}`);
      console.log();

      if (subscriptions.length > 0) {
        console.log(chalk.white('Active Subscriptions:'));
        for (const sub of subscriptions) {
          console.log(`  ${chalk.yellow(sub.event_name)}: ${sub.subscriber_count} listener(s)`);
        }
        console.log();
      }

      if (recentEvents.length > 0) {
        console.log(chalk.white(`Recent Events (last ${limit}):`));
        for (const event of recentEvents) {
          const timestamp = new Date(event.emitted_at).toLocaleString();
          console.log(`  ${chalk.gray(timestamp)} - ${chalk.yellow(event.event_name)}`);

          if (event.module_source) {
            console.log(`    Source: ${chalk.blue(event.module_source)}`);
          }

          if (verbose && event.event_data) {
            try {
              const data = JSON.parse(event.event_data);
              console.log(`    Data: ${chalk.gray(JSON.stringify(data, null, 2))}`);
            } catch {
              console.log(`    Data: ${chalk.gray(event.event_data)}`);
            }
          }
        }
      } else {
        console.log(chalk.gray('No events recorded yet.'));
      }

      console.log();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LogSource.CLI, 'Failed to get events status', { error: errorMessage });
      console.error(chalk.red('\n❌ Failed to get events status:'), errorMessage);
      process.exit(1);
    }
  },
};
