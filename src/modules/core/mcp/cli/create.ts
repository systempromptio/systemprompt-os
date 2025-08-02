/**
 * MCP Module Create Command
 * Creates new MCP contexts.
 */

import type { ICliCommand } from '@/modules/core/cli/types/manual';
import type { IMCPModuleExports } from '../types/manual';

export const createCommand: ICliCommand = {
  name: 'create',
  description: 'Create a new MCP context',
  options: [
    {
      name: 'name',
      alias: 'n',
      type: 'string',
      description: 'Context name',
      required: true,
    },
    {
      name: 'description',
      alias: 'd',
      type: 'string',
      description: 'Context description',
    },
    {
      name: 'version',
      alias: 'v',
      type: 'string',
      description: 'Context version',
      defaultValue: '1.0.0',
    },
    {
      name: 'auth',
      alias: 'a',
      type: 'string',
      description: 'Authentication type (none, bearer, client)',
      defaultValue: 'none',
    },
  ],
  execute: async (args, context) => {
    const mcpModule = context.module.exports as IMCPModuleExports;
    const logger = context.logger;
    
    try {
      // Check if context already exists
      const existing = await mcpModule.contexts.getByName(args.name);
      if (existing) {
        logger.error(`Context '${args.name}' already exists`);
        return;
      }
      
      // Create context
      logger.info(`Creating MCP context '${args.name}'...`);
      
      const newContext = await mcpModule.contexts.create({
        name: args.name,
        description: args.description,
        version: args.version,
        server_config: {
          name: `${args.name} MCP Server`,
          version: args.version,
        },
        auth_config: args.auth !== 'none' ? {
          type: args.auth as 'bearer' | 'client',
        } : undefined,
      });
      
      logger.success(`Context '${newContext.name}' created successfully!`);
      logger.info(`Context ID: ${newContext.id}`);
      
      // Create MCP SDK server for the context
      logger.info('Initializing MCP SDK server...');
      await mcpModule.server.create(newContext.id);
      
      logger.info('\nNext steps:');
      logger.info(`  1. Add tools:     mcp add-tool --context ${args.name} --name <tool-name>`);
      logger.info(`  2. Add resources: mcp add-resource --context ${args.name} --uri <resource-uri>`);
      logger.info(`  3. Add prompts:   mcp add-prompt --context ${args.name} --name <prompt-name>`);
      logger.info(`  4. View details:  mcp list --context ${args.name}`);
      
    } catch (error) {
      logger.error('Failed to create context:', error);
      throw error;
    }
  },
};