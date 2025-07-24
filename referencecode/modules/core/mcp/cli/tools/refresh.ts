/**
 * @fileoverview MCP tools refresh command
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createToolsRefreshCommand(module: MCPModule): Command {
  return new Command('refresh')
    .description('Rescan modules for tools and update registry')
    .option('-q, --quiet', 'Minimal output')
    .option('-v, --verbose', 'Verbose output')
    .action(async (options) => {
      try {
        if (!options.quiet) {
          console.log('Scanning for tools...');
        }
        
        const startTime = Date.now();
        const result = await module.refreshTools();
        const duration = Date.now() - startTime;
        
        if (options.verbose) {
          console.log('\nDiscovered tools:');
          if (result.discovered && result.discovered.length > 0) {
            for (const tool of result.discovered) {
              console.log(`  + ${tool}`);
            }
          } else {
            console.log('  (none)');
          }
          
          console.log('\nRemoved tools:');
          if (result.removed && result.removed.length > 0) {
            for (const tool of result.removed) {
              console.log(`  - ${tool}`);
            }
          } else {
            console.log('  (none)');
          }
          
          console.log('\nUpdated tools:');
          if (result.updated && result.updated.length > 0) {
            for (const tool of result.updated) {
              console.log(`  * ${tool}`);
            }
          } else {
            console.log('  (none)');
          }
        }
        
        if (!options.quiet) {
          console.log(`\nRefresh completed in ${duration}ms`);
          console.log(`Total tools: ${result.total || 0}`);
          console.log(`New: ${result.discovered?.length || 0}, Updated: ${result.updated?.length || 0}, Removed: ${result.removed?.length || 0}`);
        }
        
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}