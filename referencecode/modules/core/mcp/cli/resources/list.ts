/**
 * @fileoverview MCP resources list command
 * @module modules/core/mcp/cli/resources
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../../index.js';

export function createResourcesListCommand(module: MCPModule): Command {
  return new Command('list')
    .description('List all MCP resources')
    .option('-t, --type <type>', 'Filter by MIME type')
    .option('-s, --search <search>', 'Search resources by URI or name')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const resources = await module.listResources();
        
        // Filter by type if specified
        let filteredResources = resources;
        if (options.type) {
          filteredResources = filteredResources.filter(resource => 
            resource.mimeType === options.type
          );
        }
        
        // Search if specified
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          filteredResources = filteredResources.filter(resource => 
            resource.uri.toLowerCase().includes(searchLower) ||
            resource.name.toLowerCase().includes(searchLower) ||
            (resource.description?.toLowerCase().includes(searchLower))
          );
        }
        
        if (options.format === 'json') {
          console.log(JSON.stringify(filteredResources, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredResources));
        } else {
          // Table format
          if (filteredResources.length === 0) {
            console.log('No resources found');
            return;
          }
          
          const table = new Table({
            head: ['URI', 'Name', 'Type', 'Description', 'Source'],
            colWidths: [35, 25, 20, 35, 10]
          });
          
          for (const resource of filteredResources) {
            table.push([
              resource.uri,
              resource.name,
              resource.mimeType || 'text/plain',
              resource.description || '-',
              resource.metadata?.source || 'registry'
            ]);
          }
          
          console.log(table.toString());
          console.log(`\nTotal: ${filteredResources.length} resource(s)`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}