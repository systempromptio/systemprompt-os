/**
 * @fileoverview MCP resources search command
 * @module modules/core/mcp/cli/resources
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../../index.js';

export function createResourcesSearchCommand(module: MCPModule): Command {
  return new Command('search')
    .description('Search MCP resources')
    .argument('<query>', 'Search query')
    .option('-t, --type <type>', 'Filter by MIME type')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .option('-l, --limit <limit>', 'Maximum number of results', '20')
    .action(async (query: string, options) => {
      try {
        const resources = await module.listResources();
        
        // Search resources
        const searchLower = query.toLowerCase();
        let filteredResources = resources.filter(resource => 
          resource.uri.toLowerCase().includes(searchLower) ||
          resource.name.toLowerCase().includes(searchLower) ||
          (resource.description?.toLowerCase().includes(searchLower))
        );
        
        // Filter by type if specified
        if (options.type) {
          filteredResources = filteredResources.filter(resource => 
            resource.mimeType === options.type
          );
        }
        
        // Apply limit
        const limit = parseInt(options.limit, 10);
        if (!isNaN(limit) && limit > 0) {
          filteredResources = filteredResources.slice(0, limit);
        }
        
        if (options.format === 'json') {
          console.log(JSON.stringify(filteredResources, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredResources));
        } else {
          // Table format
          if (filteredResources.length === 0) {
            console.log(`No resources found matching: "${query}"`);
            return;
          }
          
          const table = new Table({
            head: ['URI', 'Name', 'Type', 'Match Type'],
            colWidths: [40, 25, 20, 15]
          });
          
          for (const resource of filteredResources) {
            // Determine match type
            let matchType = 'description';
            if (resource.uri.toLowerCase().includes(searchLower)) {
              matchType = 'uri';
            } else if (resource.name.toLowerCase().includes(searchLower)) {
              matchType = 'name';
            }
            
            table.push([
              resource.uri,
              resource.name,
              resource.mimeType || 'text/plain',
              matchType
            ]);
          }
          
          console.log(table.toString());
          console.log(`\nFound ${filteredResources.length} resource(s) matching: "${query}"`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}