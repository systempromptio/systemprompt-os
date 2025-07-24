/**
 * @fileoverview MCP capabilities command
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../index.js';

export function createCapabilitiesCommand(module: MCPModule): Command {
  return new Command('capabilities')
    .description('Show MCP capabilities')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const serverInfo = await module.getServerInfo();
        const capabilities = serverInfo.capabilities;
        
        if (options.format === 'json') {
          console.log(JSON.stringify(capabilities, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(capabilities));
        } else {
          // Table format
          console.log('MCP Server Capabilities\n');
          
          const table = new Table({
            head: ['Capability', 'Enabled', 'Description'],
            colWidths: [25, 10, 50]
          });
          
          table.push(
            ['Tools', capabilities.tools ? '✓' : '✗', 'Execute functions and tools'],
            ['Prompts', capabilities.prompts ? '✓' : '✗', 'Manage and use prompt templates'],
            ['Resources', capabilities.resources ? '✓' : '✗', 'Access and read resources'],
            ['Resource Templates', capabilities.resourceTemplates ? '✓' : '✗', 'Use resource templates'],
            ['Resource Subscriptions', capabilities.resourceSubscriptions ? '✓' : '✗', 'Subscribe to resource changes']
          );
          
          console.log(table.toString());
          
          if (capabilities.experimental && Object.keys(capabilities.experimental).length > 0) {
            console.log('\nExperimental Features:');
            const expTable = new Table({
              head: ['Feature', 'Enabled'],
              colWidths: [25, 10]
            });
            
            for (const [feature, enabled] of Object.entries(capabilities.experimental)) {
              expTable.push([feature, enabled ? '✓' : '✗']);
            }
            
            console.log(expTable.toString());
          }
          
          // Show stats
          const stats = await module.getStats();
          console.log('\nCurrent Statistics:');
          console.log(`  Tools: ${stats.tools.total}`);
          console.log(`  Prompts: ${stats.prompts.total}`);
          console.log(`  Resources: ${stats.resources.total}`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}