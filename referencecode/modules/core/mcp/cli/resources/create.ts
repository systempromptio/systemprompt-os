/**
 * @fileoverview MCP resources create command
 * @module modules/core/mcp/cli/resources
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import type { MCPModule } from '../../index.js';

export function createResourcesCreateCommand(module: MCPModule): Command {
  return new Command('create')
    .description('Create a new MCP resource')
    .option('-u, --uri <uri>', 'Resource URI (required)')
    .option('-n, --name <name>', 'Resource name')
    .option('-d, --description <description>', 'Resource description')
    .option('-t, --type <type>', 'MIME type (default: text/plain)')
    .option('-c, --content <content>', 'Resource content')
    .option('-f, --file <file>', 'Read content from file')
    .option('-m, --metadata <metadata>', 'Metadata as JSON')
    .option('--template', 'Create as a template resource')
    .option('--dry-run', 'Validate without creating')
    .action(async (options) => {
      try {
        if (!options.uri) {
          console.error('Error: Resource URI is required');
          process.exit(1);
        }

        let content = options.content;

        // Read content from file if specified
        if (options.file) {
          content = await fs.readFile(options.file, 'utf-8');
        }

        if (!content) {
          console.error('Error: Resource content is required (use --content or --file)');
          process.exit(1);
        }

        const resourceData = {
          uri: options.uri,
          name: options.name || options.uri,
          description: options.description,
          mimeType: options.type || 'text/plain',
          content: content,
          metadata: options.metadata ? JSON.parse(options.metadata) : {},
          isTemplate: options.template || false,
        };

        if (options.dryRun) {
          console.log('Validation passed. Resource data:');
          console.log(JSON.stringify(resourceData, null, 2));
          return;
        }

        // Create the resource
        const created = await module.createResource(resourceData);
        console.log(`Resource '${created.uri}' created successfully`);

      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}