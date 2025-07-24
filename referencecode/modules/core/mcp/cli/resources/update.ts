/**
 * @fileoverview MCP resources update command
 * @module modules/core/mcp/cli/resources
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import type { MCPModule } from '../../index.js';

export function createResourcesUpdateCommand(module: MCPModule): Command {
  return new Command('update')
    .description('Update an existing MCP resource')
    .argument('<uri>', 'URI of the resource to update')
    .option('-n, --name <name>', 'New name')
    .option('-d, --description <description>', 'New description')
    .option('-t, --type <type>', 'New MIME type')
    .option('-c, --content <content>', 'New content')
    .option('-f, --file <file>', 'Read new content from file')
    .option('-m, --metadata <metadata>', 'New metadata as JSON')
    .option('--dry-run', 'Show what would be updated without making changes')
    .action(async (uri, options) => {
      try {
        // First check if resource exists
        const existing = await module.readResource(uri);
        if (!existing) {
          console.error(`Resource '${uri}' not found`);
          process.exit(1);
        }
        
        const updateData: any = {};
        
        // Build update data from options
        if (options.name !== undefined) {updateData.name = options.name;}
        if (options.description !== undefined) {updateData.description = options.description;}
        if (options.type !== undefined) {updateData.mimeType = options.type;}
        if (options.metadata) {updateData.metadata = JSON.parse(options.metadata);}
        
        // Handle content update
        if (options.content !== undefined) {
          updateData.content = options.content;
        } else if (options.file) {
          updateData.content = await fs.readFile(options.file, 'utf-8');
        }
        
        if (Object.keys(updateData).length === 0) {
          console.error('Error: No update options specified');
          process.exit(1);
        }
        
        if (options.dryRun) {
          console.log(`Would update resource '${uri}' with:`);
          console.log(JSON.stringify(updateData, null, 2));
          return;
        }
        
        // Update the resource
        const updated = await module.updateResource(uri, updateData);
        if (!updated) {
          console.error(`Failed to update resource '${uri}'`);
          process.exit(1);
        }
        
        console.log(`Resource '${uri}' updated successfully`);
        
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}