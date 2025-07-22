/**
 * Delete role command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createRolesDeleteCommand(module: PermissionsModule): Command {
  const cmd = new Command('delete')
    .alias('rm')
    .description('Delete role')
    .argument('<name>', 'Role name to delete')
    .option('-f, --force', 'Skip confirmation')
    .option('--deleted-by <userId>', 'User deleting the role')
    .action(async (name, options) => {
      try {
        // Get role details first
        const role = await module.getRole(name);
        if (!role) {
          console.error('Error: Role not found');
          process.exit(1);
        }
        
        if (role.isSystem) {
          console.error('Error: Cannot delete system role');
          process.exit(1);
        }
        
        // Confirm deletion unless forced
        if (!options.force) {
          console.log(`\nAbout to delete role:`);
          console.log(`  Name: ${role.name}`);
          if (role.description) {
            console.log(`  Description: ${role.description}`);
          }
          
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
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
        
        await module.deleteRole(name, options.deletedBy);
        
        console.log(`\n✓ Role '${name}' deleted successfully\n`);
      } catch (error: any) {
        console.error('Error deleting role:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}