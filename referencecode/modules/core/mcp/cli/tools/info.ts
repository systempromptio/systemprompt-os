/**
 * @fileoverview MCP tools info command
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createToolsInfoCommand(module: MCPModule): Command {
  return new Command('info')
    .description('Show detailed information about a tool')
    .argument('<name>', 'Name of the tool')
    .option('-f, --format <format>', 'Output format (json, yaml, text)', 'text')
    .action(async (name, options) => {
      try {
        const tool = await module.getToolInfo(name);

        if (!tool) {
          console.error(`Tool '${name}' not found`);
          process.exit(1);
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(tool, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(tool));
        } else {
          // Text format
          console.log(`Name: ${tool.name}`);
          console.log(`Description: ${tool.description || '-'}`);
          console.log(`Enabled: ${tool.enabled ? 'Yes' : 'No'}`);

          if (tool.inputSchema) {
            console.log('\nInput Schema:');
            console.log(JSON.stringify(tool.inputSchema, null, 2));
          }

          if (tool.metadata) {
            console.log('\nMetadata:');
            for (const [key, value] of Object.entries(tool.metadata)) {
              console.log(`  ${key}: ${value}`);
            }
          }

          if (tool.stats) {
            console.log('\nStatistics:');
            console.log(`  Total Executions: ${tool.stats.total || 0}`);
            console.log(`  Successful: ${tool.stats.successful || 0}`);
            console.log(`  Failed: ${tool.stats.failed || 0}`);
            if (tool.stats.averageDuration) {
              console.log(`  Average Duration: ${tool.stats.averageDuration}ms`);
            }
            if (tool.stats.lastUsed) {
              console.log(`  Last Used: ${tool.stats.lastUsed}`);
            }
          }
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}