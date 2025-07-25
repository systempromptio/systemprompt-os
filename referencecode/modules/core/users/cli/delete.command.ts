/**
 * Delete user command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createDeleteCommand(module: UsersModule): Command {
  const cmd = new Command('delete')
    .alias('rm')
    .description('Delete a user')
    .argument('<id>', 'User ID to delete')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id, options) => {
      try {
        // Get user details first
        const user = await module.getUser(id);
        if (!user) {
          console.error('Error: User not found');
          process.exit(1);
        }

        // Confirm deletion unless forced
        if (!options.force) {
          console.log('\nAbout to delete user:');
          console.log(`ID: ${user.id}`);
          console.log(`Email: ${user.email}`);
          console.log(`Name: ${user.name}`);

          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question('\nAre you sure? (yes/no): ', resolve);
          });

          rl.close();

          if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('Deletion cancelled');
            return;
          }
        }

        await module.deleteUser(id);

        console.log(`\nUser ${user.email} deleted successfully\n`);
      } catch (error: any) {
        console.error('Error deleting user:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}