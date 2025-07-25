/**
 * @fileoverview MCP tools disable command
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createToolsDisableCommand(module: MCPModule): Command {
  return new Command('disable')
    .description('Disable a tool')
    .argument('<name>', 'Name of the tool to disable')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (name, options) => {
      try {
        // Check if tool exists
        const tool = await module.getToolInfo(name);
        if (!tool) {
          console.error(`Tool '${name}' not found`);
          process.exit(1);
        }

        if (!tool.enabled) {
          console.log(`Tool '${name}' is already disabled`);
          return;
        }

        // Confirm disabling unless --force is used
        if (!options.force) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(`Are you sure you want to disable tool '${name}'? (y/N) `, resolve);
          });

          rl.close();

          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('Operation cancelled');
            return;
          }
        }

        // Disable the tool
        const disabled = await module.disableTool(name);
        if (!disabled) {
          console.error(`Failed to disable tool '${name}'`);
          process.exit(1);
        }

        console.log(`Tool '${name}' disabled successfully`);

      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}