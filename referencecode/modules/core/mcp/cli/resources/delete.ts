/**
 * @fileoverview MCP resources delete command
 * @module modules/core/mcp/cli/resources
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createResourcesDeleteCommand(module: MCPModule): Command {
  return new Command('delete')
    .description('Delete an MCP resource')
    .argument('<uri>', 'URI of the resource to delete')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (uri, options) => {
      try {
        // Check if resource exists
        const resource = await module.readResource(uri);
        if (!resource) {
          console.error(`Resource '${uri}' not found`);
          process.exit(1);
        }
        
        // Confirm deletion unless --force is used
        if (!options.force) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise<string>((resolve) => {
            rl.question(`Are you sure you want to delete resource '${uri}'? (y/N) `, resolve);
          });
          
          rl.close();
          
          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('Deletion cancelled');
            return;
          }
        }
        
        // Delete the resource
        const deleted = await module.deleteResource(uri);
        if (!deleted) {
          console.error(`Failed to delete resource '${uri}'`);
          process.exit(1);
        }
        
        console.log(`Resource '${uri}' deleted successfully`);
        
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}