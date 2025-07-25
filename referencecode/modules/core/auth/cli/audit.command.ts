/**
 * Audit log CLI commands
 */

import { Command } from 'commander';
import type { AuthModule } from '../index.js';
import type { AuthAuditAction } from '../types/index.js';

export function createAuditCommand(module: AuthModule): Command {
  const cmd = new Command('audit')
    .description('View and manage authentication audit logs');

  // View audit logs
  cmd.command('logs')
    .description('View audit logs')
    .option('-u, --user <userId>', 'Filter by user ID')
    .option('-a, --action <action>', 'Filter by action type')
    .option('-s, --success', 'Show only successful actions')
    .option('-f, --failed', 'Show only failed actions')
    .option('-d, --days <days>', 'Number of days to show (default: 7)', '7')
    .option('-l, --limit <limit>', 'Maximum number of entries', '100')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(options.days, 10));

        const filters: any = {
          limit: parseInt(options.limit, 10),
        };

        if (options.user) {filters.userId = options.user;}
        if (options.action) {filters.action = options.action as AuthAuditAction;}
        if (options.success && !options.failed) {filters.success = true;}
        if (options.failed && !options.success) {filters.success = false;}
        if (options.days) {filters.startDate = startDate;}

        const entries = await module.getAuditLogs(filters);

        if (options.json) {
          console.log(JSON.stringify(entries, null, 2));
        } else {
          if (entries.length === 0) {
            console.log('No audit entries found');
            return;
          }

          console.log('\nAudit Log Entries:');
          console.log('Timestamp                 User              Action              Success  IP Address       Error');
          console.log('------------------------  ----------------  ------------------  -------  ---------------  ------------------------');

          entries.forEach(entry => {
            const timestamp = entry.timestamp.toISOString();
            const userId = (entry.userId || '-').substring(0, 16).padEnd(16);
            const action = entry.action.padEnd(18);
            const success = entry.success ? 'Yes' : 'No ';
            const ip = (entry.ipAddress || '-').substring(0, 15).padEnd(15);
            const error = entry.errorMessage ? entry.errorMessage.substring(0, 24) : '-';

            console.log(`${timestamp}  ${userId}  ${action}  ${success}    ${ip}  ${error}`);
          });

          console.log(`\nTotal: ${entries.length} entries`);
        }
      } catch (error: any) {
        console.error('Error viewing audit logs:', error.message);
        process.exit(1);
      }
    });

  // Failed login attempts
  cmd.command('failed-logins <email>')
    .description('View failed login attempts for an email')
    .option('-h, --hours <hours>', 'Look back N hours (default: 24)', '24')
    .action(async (email, options) => {
      try {
        const since = new Date(Date.now() - parseInt(options.hours, 10) * 60 * 60 * 1000);
        const count = await module.getFailedLoginAttempts(email, since);

        console.log(`\nFailed login attempts for ${email}:`);
        console.log(`In the last ${options.hours} hours: ${count}`);

        if (count >= 5) {
          console.log('\n⚠️  Warning: High number of failed attempts detected');
        }
      } catch (error: any) {
        console.error('Error checking failed logins:', error.message);
        process.exit(1);
      }
    });

  // Cleanup old audit logs
  cmd.command('cleanup')
    .description('Clean up old audit log entries')
    .action(async () => {
      try {
        const count = await module.cleanupAuditLogs();
        console.log(`✓ Cleaned up ${count} old audit log entries`);
      } catch (error: any) {
        console.error('Error cleaning up audit logs:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}