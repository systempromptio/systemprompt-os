/**
 * Update user command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createUpdateCommand(module: UsersModule): Command {
  const cmd = new Command('update')
    .description('Update user information')
    .argument('<id>', 'User ID')
    .option('-n, --name <name>', 'Update user name')
    .option('-e, --email <email>', 'Update email address')
    .option('-s, --status <status>', 'Update status (active, disabled, pending)')
    .option('-m, --metadata <json>', 'Update metadata as JSON')
    .action(async (id, options) => {
      try {
        // Check if any update options provided
        if (!options.name && !options.email && !options.status && !options.metadata) {
          console.error('Error: No update options provided');
          process.exit(1);
        }

        let metadata;
        if (options.metadata) {
          try {
            metadata = JSON.parse(options.metadata);
          } catch {
            console.error('Error: Invalid JSON for metadata');
            process.exit(1);
          }
        }

        const updateData: any = {};
        if (options.name) {updateData.name = options.name;}
        if (options.email) {updateData.email = options.email;}
        if (options.status) {updateData.status = options.status;}
        if (metadata) {updateData.metadata = metadata;}

        const user = await module.updateUser(id, updateData);

        console.log('\nUser updated successfully!');
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name}`);
        console.log(`Status: ${user.status}`);
        console.log(`Updated: ${user.updatedAt.toISOString()}\n`);
      } catch (error: any) {
        console.error('Error updating user:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}