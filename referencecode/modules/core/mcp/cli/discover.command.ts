/**
 * @fileoverview MCP discover command
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import type { MCPModule } from '../index.js';

export function createDiscoverCommand(module: MCPModule): Command {
  return new Command('discover')
    .description('Discover and reload MCP components')
    .option('-d, --directory <directory>', 'Additional directory to scan')
    .action(async (options) => {
      try {
        console.log('Starting MCP discovery...\n');

        const startTime = Date.now();
        await module.discover();
        const duration = Date.now() - startTime;

        const registry = module.getRegistry();
        const stats = registry.getStats();

        console.log('✓ Discovery completed\n');
        console.log('Results:');
        console.log(`  Modules discovered: ${stats.modules}`);
        console.log(`  Tools found: ${stats.tools}`);
        console.log(`  Prompts found: ${stats.prompts}`);
        console.log(`  Resources found: ${stats.resources}`);
        console.log(`  Time taken: ${duration}ms`);

        if (options.directory) {
          console.log('\nNote: Additional directory scanning not yet implemented');
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}