/**
 * @fileoverview MCP tools list command
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../../index.js';

export function createToolsListCommand(module: MCPModule): Command {
  return new Command('list')
    .description('List all MCP tools')
    .option('-c, --category <category>', 'Filter by category')
    .option('-s, --search <search>', 'Search tools by name or description')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const tools = await module.listTools();
        
        // Filter by category if specified
        let filteredTools = tools;
        if (options.category) {
          filteredTools = filteredTools.filter(tool => 
            tool.metadata?.category === options.category
          );
        }
        
        // Search if specified
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          filteredTools = filteredTools.filter(tool => 
            tool.name.toLowerCase().includes(searchLower) ||
            (tool.description?.toLowerCase().includes(searchLower))
          );
        }
        
        if (options.format === 'json') {
          console.log(JSON.stringify(filteredTools, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredTools));
        } else {
          // Table format
          if (filteredTools.length === 0) {
            console.log('No tools found');
            return;
          }
          
          const table = new Table({
            head: ['Name', 'Description', 'Category', 'Auth Required', 'Source'],
            colWidths: [25, 40, 15, 15, 10]
          });
          
          for (const tool of filteredTools) {
            table.push([
              tool.name,
              tool.description || '-',
              tool.metadata?.category || 'default',
              tool.metadata?.requiresAuth ? 'Yes' : 'No',
              tool.metadata?.source || 'registry'
            ]);
          }
          
          console.log(table.toString());
          console.log(`\nTotal: ${filteredTools.length} tool(s)`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}