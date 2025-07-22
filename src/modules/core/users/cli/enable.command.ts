/**
 * Enable user command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createEnableCommand(module: UsersModule): Command {
  const cmd = new Command('enable')
    .description('Enable a user account')
    .argument('<id>', 'User ID or email to enable')
    .action(async (id) => {
      try {
        const user = await module.enableUser(id);
        
        console.log(`\nUser enabled successfully!`);
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name}`);
        console.log(`Status: ${user.status}\n`);
      } catch (error: any) {
        console.error('Error enabling user:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}