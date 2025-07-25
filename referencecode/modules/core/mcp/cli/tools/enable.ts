/**
 * @fileoverview MCP tools enable command
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createToolsEnableCommand(module: MCPModule): Command {
  return new Command('enable')
    .description('Enable a tool')
    .argument('<name>', 'Name of the tool to enable')
    .option('-f, --force', 'Force enable even if validation fails')
    .action(async (name, options) => {
      try {
        const enabled = await module.enableTool(name, options.force);

        if (!enabled) {
          console.error(`Failed to enable tool '${name}'`);
          process.exit(1);
        }

        console.log(`Tool '${name}' enabled successfully`);

        if (options.force) {
          console.log('Warning: Tool was force-enabled. It may not function correctly.');
        }

      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}