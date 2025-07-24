/**
 * @fileoverview MCP prompts list command
 * @module modules/core/mcp/cli/prompts
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../../index.js';

export function createPromptsListCommand(module: MCPModule): Command {
  return new Command('list')
    .description('List all MCP prompts')
    .option('-c, --category <category>', 'Filter by category')
    .option('-s, --search <search>', 'Search prompts by name or description')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const prompts = await module.listPrompts();
        
        // Filter by category if specified
        let filteredPrompts = prompts;
        if (options.category) {
          filteredPrompts = filteredPrompts.filter(prompt => 
            prompt.metadata?.category === options.category
          );
        }
        
        // Search if specified
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          filteredPrompts = filteredPrompts.filter(prompt => 
            prompt.name.toLowerCase().includes(searchLower) ||
            (prompt.description?.toLowerCase().includes(searchLower))
          );
        }
        
        if (options.format === 'json') {
          console.log(JSON.stringify(filteredPrompts, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredPrompts));
        } else {
          // Table format
          if (filteredPrompts.length === 0) {
            console.log('No prompts found');
            return;
          }
          
          const table = new Table({
            head: ['Name', 'Description', 'Arguments', 'Category', 'Source'],
            colWidths: [25, 40, 25, 15, 10]
          });
          
          for (const prompt of filteredPrompts) {
            const args = prompt.arguments?.map((a: any) => a.name).join(', ') || '-';
            table.push([
              prompt.name,
              prompt.description || '-',
              args,
              prompt.metadata?.category || 'default',
              prompt.metadata?.source || 'registry'
            ]);
          }
          
          console.log(table.toString());
          console.log(`\nTotal: ${filteredPrompts.length} prompt(s)`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}