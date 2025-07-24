/**
 * @fileoverview MCP servers list command
 * @module modules/core/mcp/cli/servers
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../../index.js';

export function createServersListCommand(module: MCPModule): Command {
  return new Command('list')
    .description('List MCP servers')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        // Get server info
        const serverInfo = await module.getServerInfo();
        const registry = module.getRegistry();
        
        // Build server list
        const servers = [
          {
            name: 'local',
            type: 'stdio',
            status: registry.getHealth().healthy ? 'running' : 'stopped',
            version: serverInfo.version,
            capabilities: serverInfo.capabilities
          }
        ];
        
        if (options.format === 'json') {
          console.log(JSON.stringify(servers, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(servers));
        } else {
          // Table format
          const table = new Table({
            head: ['Name', 'Type', 'Status', 'Version', 'Capabilities'],
            colWidths: [15, 10, 10, 10, 40]
          });
          
          for (const server of servers) {
            const capabilities = [];
            if (server.capabilities.tools) {capabilities.push('tools');}
            if (server.capabilities.prompts) {capabilities.push('prompts');}
            if (server.capabilities.resources) {capabilities.push('resources');}
            if (server.capabilities.resourceTemplates) {capabilities.push('templates');}
            if (server.capabilities.resourceSubscriptions) {capabilities.push('subscriptions');}
            
            table.push([
              server.name,
              server.type,
              server.status,
              server.version,
              capabilities.join(', ')
            ]);
          }
          
          console.log(table.toString());
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}