/**
 * Update role command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createRolesUpdateCommand(module: PermissionsModule): Command {
  const cmd = new Command('update')
    .description('Update role')
    .argument('<name>', 'Role name')
    .option('-d, --description <description>', 'New description')
    .option('--rename <newName>', 'New role name')
    .option('--updated-by <userId>', 'User updating the role')
    .action(async (name, options) => {
      try {
        if (!options.description && !options.rename) {
          console.error('Error: No updates provided. Use --description or --rename');
          process.exit(1);
        }
        
        const updates: any = {};
        if (options.description !== undefined) {
          updates.description = options.description;
        }
        if (options.rename) {
          updates.name = options.rename;
        }
        
        const role = await module.updateRole(name, updates, options.updatedBy);
        
        console.log(`\n✓ Role updated successfully!`);
        console.log(`  ID: ${role.id}`);
        console.log(`  Name: ${role.name}`);
        if (role.description) {
          console.log(`  Description: ${role.description}`);
        }
        console.log(`  Updated: ${role.updatedAt.toISOString()}\n`);
      } catch (error: any) {
        console.error('Error updating role:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}