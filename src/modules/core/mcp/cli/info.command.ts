/**
 * @fileoverview MCP info command
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import type { MCPModule } from '../index.js';

export function createInfoCommand(module: MCPModule): Command {
  return new Command('info')
    .description('Display MCP server information')
    .action(async () => {
      try {
        const info = await module.getServerInfo();
        const registry = module.getRegistry();
        const stats = registry.getStats();
        
        console.log('\n=== MCP Server Information ===\n');
        console.log(`Name: ${info.name}`);
        console.log(`Version: ${info.version}`);
        console.log(`Protocol Version: ${info.protocolVersion}`);
        
        console.log('\n=== Capabilities ===\n');
        console.log(`Tools: ${info.capabilities.tools ? '✓' : '✗'}`);
        console.log(`Prompts: ${info.capabilities.prompts ? '✓' : '✗'}`);
        console.log(`Resources: ${info.capabilities.resources ? '✓' : '✗'}`);
        console.log(`Resource Templates: ${info.capabilities.resourceTemplates ? '✓' : '✗'}`);
        console.log(`Resource Subscriptions: ${info.capabilities.resourceSubscriptions ? '✓' : '✗'}`);
        
        if (info.capabilities.experimental) {
          console.log('\n=== Experimental Features ===\n');
          for (const [feature, enabled] of Object.entries(info.capabilities.experimental)) {
            console.log(`${feature}: ${enabled ? '✓' : '✗'}`);
          }
        }
        
        console.log('\n=== Registry Statistics ===\n');
        console.log(`Modules: ${stats.modules}`);
        console.log(`Tools: ${stats.tools}`);
        console.log(`Prompts: ${stats.prompts}`);
        console.log(`Resources: ${stats.resources}`);
        
        console.log();
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}