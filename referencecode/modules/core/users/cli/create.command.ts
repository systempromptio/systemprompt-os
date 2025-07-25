/**
 * Create user command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createCreateCommand(module: UsersModule): Command {
  const cmd = new Command('create')
    .description('Create a new user')
    .requiredOption('-e, --email <email>', 'User email address')
    .requiredOption('-n, --name <name>', 'User full name')
    .option('-p, --provider <provider>', 'Auth provider (default: local)')
    .option('--provider-id <id>', 'Provider user ID')
    .option('-m, --metadata <json>', 'Additional metadata as JSON')
    .action(async (options) => {
      try {
        let metadata;
        if (options.metadata) {
          try {
            metadata = JSON.parse(options.metadata);
          } catch {
            console.error('Error: Invalid JSON for metadata');
            process.exit(1);
          }
        }

        const user = await module.createUser({
          email: options.email,
          name: options.name,
          provider: options.provider || 'local',
          providerId: options.providerId,
          metadata,
        });

        console.log('\nUser created successfully!');
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name}`);
        console.log(`Status: ${user.status}`);
        console.log(`Created: ${user.createdAt.toISOString()}\n`);
      } catch (error: any) {
        console.error('Error creating user:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}