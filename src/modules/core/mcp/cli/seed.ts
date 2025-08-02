/**
 * MCP Module Seed Command
 * Seeds initial MCP contexts, tools, resources, and prompts.
 */

import type { ICliCommand } from '@/modules/core/cli/types/manual';
import type { IMCPModuleExports } from '../types/manual';

export const seedCommand: ICliCommand = {
  name: 'seed',
  description: 'Seed initial MCP contexts and tools',
  options: [
    {
      name: 'force',
      alias: 'f',
      type: 'boolean',
      description: 'Force re-seeding (will delete existing data)',
      defaultValue: false,
    },
  ],
  execute: async (args, context) => {
    const mcpModule = context.module.exports as IMCPModuleExports;
    const logger = context.logger;
    
    logger.info('Seeding MCP data...');
    
    try {
      // Check if CLI context already exists
      let cliContext = await mcpModule.contexts.getByName('cli');
      
      if (cliContext && !args.force) {
        logger.info('CLI context already exists. Use --force to re-seed.');
        return;
      }
      
      if (cliContext && args.force) {
        logger.info('Deleting existing CLI context...');
        await mcpModule.contexts.delete(cliContext.id);
      }
      
      // Create CLI context
      logger.info('Creating CLI context...');
      cliContext = await mcpModule.contexts.create({
        name: 'cli',
        description: 'SystemPrompt OS CLI tools context',
        version: '1.0.0',
        server_config: {
          name: 'SystemPrompt CLI Server',
          version: '1.0.0',
        },
        auth_config: {
          type: 'none',
        },
      });
      
      // Create execute-cli tool
      logger.info('Creating execute-cli tool...');
      await mcpModule.tools.create(cliContext.id, {
        name: 'execute-cli',
        description: 'Execute SystemPrompt OS CLI commands',
        input_schema: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'Module name (e.g., database, auth, dev)',
            },
            command: {
              type: 'string',
              description: 'Command name (e.g., status, list, migrate)',
            },
            args: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Additional arguments for the command',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
            },
          },
          required: ['module', 'command'],
        },
        handler_type: 'function',
        handler_config: {
          // Handler will be implemented via events
          event: 'mcp.tool.execute-cli',
        },
      });
      
      // Create system status tool
      logger.info('Creating system-status tool...');
      await mcpModule.tools.create(cliContext.id, {
        name: 'system-status',
        description: 'Get SystemPrompt OS system status',
        input_schema: {
          type: 'object',
          properties: {},
        },
        handler_type: 'function',
        handler_config: {
          event: 'mcp.tool.system-status',
        },
      });
      
      // Create system info resource
      logger.info('Creating system-info resource...');
      await mcpModule.resources.create(cliContext.id, {
        uri: 'system://info',
        name: 'System Information',
        description: 'SystemPrompt OS system information',
        mime_type: 'application/json',
        content_type: 'dynamic',
        content: {
          type: 'function',
          handler: 'system-info',
        },
      });
      
      // Create modules list resource
      logger.info('Creating modules-list resource...');
      await mcpModule.resources.create(cliContext.id, {
        uri: 'system://modules',
        name: 'Modules List',
        description: 'List of loaded SystemPrompt OS modules',
        mime_type: 'application/json',
        content_type: 'dynamic',
        content: {
          type: 'function',
          handler: 'modules-list',
        },
      });
      
      // Create default context
      logger.info('Creating default context...');
      let defaultContext = await mcpModule.contexts.getByName('default');
      
      if (defaultContext && args.force) {
        await mcpModule.contexts.delete(defaultContext.id);
        defaultContext = null;
      }
      
      if (!defaultContext) {
        defaultContext = await mcpModule.contexts.create({
          name: 'default',
          description: 'Default MCP context with basic capabilities',
          version: '1.0.0',
          server_config: {
            name: 'Default MCP Server',
            version: '1.0.0',
          },
        });
        
        // Create a basic prompt
        await mcpModule.prompts.create(defaultContext.id, {
          name: 'greeting',
          description: 'Generate a greeting message',
          arguments: [
            {
              name: 'name',
              description: 'Name to greet',
              required: true,
            },
          ],
          template: 'Hello {{name}}! Welcome to SystemPrompt OS.',
        });
      }
      
      logger.info('✅ MCP data seeded successfully!');
      
      // List created contexts
      const contexts = await mcpModule.contexts.list({ is_active: true });
      logger.info(`Created ${contexts.length} contexts:`);
      for (const ctx of contexts) {
        logger.info(`  - ${ctx.name} (${ctx.id})`);
      }
      
    } catch (error) {
      logger.error('Failed to seed MCP data:', error);
      throw error;
    }
  },
};