/**
 * @fileoverview MCP resources get command
 * @module modules/core/mcp/cli/resources
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createResourcesGetCommand(module: MCPModule): Command {
  return new Command('get')
    .description('Get a specific MCP resource')
    .argument('<uri>', 'URI of the resource to get')
    .option('-f, --format <format>', 'Output format (json, yaml, text)', 'text')
    .action(async (uri, options) => {
      try {
        const resource = await module.readResource(uri);

        if (!resource) {
          console.error(`Resource '${uri}' not found`);
          process.exit(1);
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(resource, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(resource));
        } else {
          // Text format
          console.log(`URI: ${resource.uri}`);
          console.log(`Name: ${resource.name || uri}`);
          console.log(`Description: ${resource.description || '-'}`);
          console.log(`MIME Type: ${resource.mimeType || 'text/plain'}`);

          if (resource.metadata) {
            console.log('\nMetadata:');
            for (const [key, value] of Object.entries(resource.metadata)) {
              console.log(`  ${key}: ${value}`);
            }
          }

          console.log('\nContent:');
          if (typeof resource.content === 'string') {
            console.log(resource.content);
          } else {
            console.log(JSON.stringify(resource.content, null, 2));
          }
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}