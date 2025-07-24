/**
 * @fileoverview MCP tools search command
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../../index.js';

export function createToolsSearchCommand(module: MCPModule): Command {
  return new Command('search')
    .description('Search MCP tools')
    .argument('<query>', 'Search query')
    .option('-c, --category <category>', 'Filter by category')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .option('-l, --limit <limit>', 'Maximum number of results', '20')
    .action(async (query: string, options) => {
      try {
        const tools = await module.listTools();
        
        // Search tools
        const searchLower = query.toLowerCase();
        let filteredTools = tools.filter(tool => 
          tool.name.toLowerCase().includes(searchLower) ||
          (tool.description?.toLowerCase().includes(searchLower)) ||
          (tool.inputSchema?.description?.toLowerCase().includes(searchLower))
        );
        
        // Filter by category if specified
        if (options.category) {
          filteredTools = filteredTools.filter(tool => 
            tool.metadata?.category === options.category
          );
        }
        
        // Apply limit
        const limit = parseInt(options.limit, 10);
        if (!isNaN(limit) && limit > 0) {
          filteredTools = filteredTools.slice(0, limit);
        }
        
        if (options.format === 'json') {
          console.log(JSON.stringify(filteredTools, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredTools));
        } else {
          // Table format
          if (filteredTools.length === 0) {
            console.log(`No tools found matching: "${query}"`);
            return;
          }
          
          const table = new Table({
            head: ['Name', 'Description', 'Match Type', 'Category'],
            colWidths: [25, 45, 15, 15]
          });
          
          for (const tool of filteredTools) {
            // Determine match type
            let matchType = 'description';
            if (tool.name.toLowerCase().includes(searchLower)) {
              matchType = 'name';
            } else if (tool.inputSchema?.description?.toLowerCase().includes(searchLower)) {
              matchType = 'schema';
            }
            
            table.push([
              tool.name,
              tool.description || '-',
              matchType,
              tool.metadata?.category || 'default'
            ]);
          }
          
          console.log(table.toString());
          console.log(`\nFound ${filteredTools.length} tool(s) matching: "${query}"`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}