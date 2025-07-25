/**
 * @fileoverview MCP prompts delete command
 * @module modules/core/mcp/cli/prompts
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createPromptsDeleteCommand(module: MCPModule): Command {
  return new Command('delete')
    .description('Delete an MCP prompt')
    .argument('<name>', 'Name of the prompt to delete')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (name, options) => {
      try {
        // Check if prompt exists
        const prompt = await module.getPrompt(name);
        if (!prompt) {
          console.error(`Prompt '${name}' not found`);
          process.exit(1);
        }

        // Confirm deletion unless --force is used
        if (!options.force) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(`Are you sure you want to delete prompt '${name}'? (y/N) `, resolve);
          });

          rl.close();

          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('Deletion cancelled');
            return;
          }
        }

        // Delete the prompt
        const deleted = await module.deletePrompt(name);
        if (!deleted) {
          console.error(`Failed to delete prompt '${name}'`);
          process.exit(1);
        }

        console.log(`Prompt '${name}' deleted successfully`);

      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}