/**
 * User activity command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createActivityCommand(module: UsersModule): Command {
  const cmd = new Command('activity')
    .description('View user activity logs')
    .option('-u, --user <id>', 'Filter by user ID')
    .option('-d, --days <days>', 'Number of days to show (default: 7)', '7')
    .option('-t, --type <type>', 'Filter by activity type')
    .option('--stats', 'Show activity statistics')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const days = parseInt(options.days, 10);

        if (options.stats) {
          // Show statistics
          const stats = await module.getActivityStats(
            options.user,
            days,
          );

          if (options.json) {
            console.log(JSON.stringify(stats, null, 2));
          } else {
            console.log(`\nActivity Statistics (last ${days} days):`);
            console.log(`Total activities: ${stats.totalActivities}`);
            if (stats.uniqueUsers !== undefined) {
              console.log(`Unique users: ${stats.uniqueUsers}`);
            }

            console.log('\nActivities by type:');
            for (const [type, count] of Object.entries(stats.activitiesByType)) {
              console.log(`  ${type}: ${count}`);
            }

            console.log('\nMost active hours (UTC):');
            stats.mostActiveHours.forEach((count: number, hour: number) => {
              if (count > 0) {
                const bar = '█'.repeat(Math.ceil(count / 5));
                console.log(`  ${hour.toString().padStart(2, '0')}:00  ${bar} (${count})`);
              }
            });
            console.log();
          }
          return;
        }

        // List activities
        const activities = await module.getUserActivity(options.user, days);

        if (options.json) {
          console.log(JSON.stringify(activities, null, 2));
        } else {
          if (activities.length === 0) {
            console.log('No activity found');
            return;
          }

          console.log(`\nUser Activity (last ${days} days):`);
          console.log('\nTimestamp                 User ID           Type              Action');
          console.log('------------------------  ----------------  ----------------  ----------------------------------------');

          activities.forEach(activity => {
            const timestamp = new Date(activity.timestamp).toISOString();
            const userId = activity.userId.substring(0, 16);
            const type = activity.type.padEnd(16);
            const action = activity.action.substring(0, 40);

            console.log(`${timestamp}  ${userId}  ${type}  ${action}`);

            // Show details if present
            if (activity.details && Object.keys(activity.details).length > 0) {
              console.log(`                                                              Details: ${JSON.stringify(activity.details)}`);
            }
          });

          console.log(`\nTotal: ${activities.length} activities\n`);
        }
      } catch (error: any) {
        console.error('Error viewing activity:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}