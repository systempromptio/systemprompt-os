/**
 * List users command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createListCommand(module: UsersModule): Command {
  const cmd = new Command('list')
    .alias('ls')
    .description('List users')
    .option('-r, --role <role>', 'Filter by role')
    .option('-s, --status <status>', 'Filter by status (active, disabled, pending)')
    .option('-p, --provider <provider>', 'Filter by auth provider')
    .option('-q, --search <query>', 'Search users by name or email')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const users = await module.listUsers({
          role: options.role,
          status: options.status,
          provider: options.provider,
          search: options.search,
        });

        if (options.json) {
          console.log(JSON.stringify(users, null, 2));
        } else {
          if (users.length === 0) {
            console.log('No users found');
            return;
          }

          // Table header
          console.log('\nID                                Email                     Name                Status    Roles');
          console.log('--------------------------------  ------------------------  ------------------  --------  ----------------');

          // Table rows
          users.forEach(user => {
            const id = user.id.substring(0, 32);
            const email = user.email.substring(0, 24).padEnd(24);
            const name = user.name.substring(0, 18).padEnd(18);
            const status = user.status.padEnd(8);
            const roles = user.roles.join(', ') || 'none';

            console.log(`${id}  ${email}  ${name}  ${status}  ${roles}`);
          });

          console.log(`\nTotal: ${users.length} user(s)\n`);
        }
      } catch (error: any) {
        console.error('Error listing users:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}