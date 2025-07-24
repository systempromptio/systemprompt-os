/**
 * Disable user command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createDisableCommand(module: UsersModule): Command {
  const cmd = new Command('disable')
    .description('Disable a user account')
    .argument('<id>', 'User ID or email to disable')
    .option('-r, --reason <reason>', 'Reason for disabling')
    .action(async (id, options) => {
      try {
        const user = await module.disableUser(id, options.reason);
        
        console.log(`\nUser disabled successfully!`);
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name}`);
        console.log(`Status: ${user.status}`);
        if (options.reason) {
          console.log(`Reason: ${options.reason}`);
        }
        console.log('\nAll active sessions have been revoked.\n');
      } catch (error: any) {
        console.error('Error disabling user:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}