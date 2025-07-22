/**
 * @fileoverview MCP cache commands
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../index.js';

export function createCacheCommand(module: MCPModule): Command {
  const cmd = new Command('cache')
    .description('Manage MCP cache');
  
  // Clear cache
  cmd.command('clear')
    .description('Clear the MCP cache')
    .action(async () => {
      try {
        await module.clearCache();
        console.log('✓ Cache cleared successfully');
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
  
  // Cache statistics
  cmd.command('stats')
    .description('Display cache statistics')
    .action(async () => {
      try {
        const stats = module.getCacheStats();
        
        console.log('\n=== MCP Cache Statistics ===\n');
        
        const table = new Table({
          head: ['Metric', 'Value'],
          colWidths: [25, 20]
        });
        
        table.push(
          ['Entries', stats.entries],
          ['Memory Size', formatBytes(stats.memorySize)],
          ['Hit Rate', `${(stats.hitRate * 100).toFixed(1)}%`],
          ['Evictions', stats.evictions]
        );
        
        console.log(table.toString());
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}