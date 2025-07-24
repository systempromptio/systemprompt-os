/**
 * @fileoverview MCP stats command
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../index.js';

export function createStatsCommand(module: MCPModule): Command {
  return new Command('stats')
    .description('Display MCP statistics')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const stats = await module.getStats();
        
        if (options.format === 'json') {
          console.log(JSON.stringify(stats, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(stats));
        } else {
          // Table format
          console.log('\n=== MCP Statistics ===\n');
          
          // Tools statistics
          console.log('Tools:');
          const toolsTable = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 20]
          });
          
          toolsTable.push(
            ['Total Tools', stats.tools.total],
            ['Total Executions', stats.tools.executions.total],
            ['Successful', stats.tools.executions.successful],
            ['Failed', stats.tools.executions.failed],
            ['Average Time (ms)', stats.tools.executions.averageTimeMs]
          );
          
          console.log(toolsTable.toString());
          
          // Tool categories
          if (Object.keys(stats.tools.byCategory).length > 0) {
            console.log('\nTools by Category:');
            const categoryTable = new Table({
              head: ['Category', 'Count'],
              colWidths: [20, 10]
            });
            
            for (const [category, count] of Object.entries(stats.tools.byCategory)) {
              categoryTable.push([category, count]);
            }
            
            console.log(categoryTable.toString());
          }
          
          // Prompts statistics
          console.log('\nPrompts:');
          const promptsTable = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 20]
          });
          
          promptsTable.push(
            ['Total Prompts', stats.prompts.total],
            ['Total Executions', stats.prompts.executions]
          );
          
          console.log(promptsTable.toString());
          
          // Resources statistics
          console.log('\nResources:');
          const resourcesTable = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 20]
          });
          
          resourcesTable.push(
            ['Total Resources', stats.resources.total],
            ['Total Accesses', stats.resources.accesses]
          );
          
          console.log(resourcesTable.toString());
          
          // System info
          console.log('\nSystem:');
          const systemTable = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 30]
          });
          
          const uptimeHours = Math.floor(stats.uptime / 3600000);
          const uptimeMinutes = Math.floor((stats.uptime % 3600000) / 60000);
          
          systemTable.push(
            ['Uptime', `${uptimeHours}h ${uptimeMinutes}m`],
            ['Last Scan', stats.lastScan.toLocaleString()]
          );
          
          console.log(systemTable.toString());
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}