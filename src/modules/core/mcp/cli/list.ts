/**
 * MCP Module List Command
 * Lists MCP contexts, tools, resources, and prompts.
 */

import type { ICliCommand } from '@/modules/core/cli/types/manual';
import type { IMCPModuleExports } from '../types/manual';

export const listCommand: ICliCommand = {
  name: 'list',
  description: 'List MCP contexts and their capabilities',
  options: [
    {
      name: 'context',
      alias: 'c',
      type: 'string',
      description: 'Context name to show details for',
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (table, json)',
      defaultValue: 'table',
    },
  ],
  execute: async (args, context) => {
    const mcpModule = context.module.exports as IMCPModuleExports;
    const logger = context.logger;
    
    if (args.context) {
      // Show details for a specific context
      const ctx = await mcpModule.contexts.getByName(args.context);
      if (!ctx) {
        logger.error(`Context '${args.context}' not found`);
        return;
      }
      
      // Get tools, resources, and prompts
      const [tools, resources, prompts] = await Promise.all([
        mcpModule.tools.list(ctx.id),
        mcpModule.resources.list(ctx.id),
        mcpModule.prompts.list(ctx.id),
      ]);
      
      if (args.format === 'json') {
        logger.info(JSON.stringify({
          context: ctx,
          tools,
          resources,
          prompts,
        }, null, 2));
      } else {
        logger.info(`\nContext: ${ctx.name} (${ctx.id})`);
        logger.info(`Description: ${ctx.description || 'N/A'}`);
        logger.info(`Version: ${ctx.version}`);
        logger.info(`Active: ${ctx.is_active ? 'Yes' : 'No'}`);
        
        if (tools.length > 0) {
          logger.info(`\nTools (${tools.length}):`);
          for (const tool of tools) {
            logger.info(`  - ${tool.name}: ${tool.description || 'No description'}`);
          }
        }
        
        if (resources.length > 0) {
          logger.info(`\nResources (${resources.length}):`);
          for (const resource of resources) {
            logger.info(`  - ${resource.uri}: ${resource.name}`);
          }
        }
        
        if (prompts.length > 0) {
          logger.info(`\nPrompts (${prompts.length}):`);
          for (const prompt of prompts) {
            logger.info(`  - ${prompt.name}: ${prompt.description || 'No description'}`);
          }
        }
      }
    } else {
      // List all contexts
      const contexts = await mcpModule.contexts.list({ is_active: true });
      
      if (args.format === 'json') {
        logger.info(JSON.stringify(contexts, null, 2));
      } else {
        if (contexts.length === 0) {
          logger.info('No MCP contexts found. Run "mcp seed" to create default contexts.');
          return;
        }
        
        logger.info(`\nMCP Contexts (${contexts.length}):\n`);
        for (const ctx of contexts) {
          logger.info(`  ${ctx.name} (${ctx.id})`);
          if (ctx.description) {
            logger.info(`    ${ctx.description}`);
          }
          logger.info(`    Version: ${ctx.version}, Active: ${ctx.is_active ? 'Yes' : 'No'}`);
        }
        logger.info('\nUse --context <name> to see details for a specific context.');
      }
    }
  },
};