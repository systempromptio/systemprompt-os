/**
 * MCP Module Seed Command
 * Seeds initial MCP contexts, tools, resources, and prompts.
 */

import type { ICLIContext, ICLICommand } from '@/modules/core/cli/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { IMCPModuleExports } from '../types/manual';
import { z } from 'zod';

const seedArgsSchema = z.object({
  force: z.boolean().default(false),
});

export const command: ICLICommand = {
  description: 'Seed initial MCP contexts and tools',
  options: [
    {
      name: 'force',
      alias: 'f',
      type: 'boolean',
      description: 'Force re-seeding (will delete existing data)',
      default: false,
    },
  ],
  execute: async (context: ICLIContext) => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    
    try {
      const validatedArgs = seedArgsSchema.parse(context.args);
      
      // Import the MCP module and get its service
      const { MCPService } = await import('../services/mcp.service');
      const mcpService = MCPService.getInstance();
      
      // Create mock module exports interface
      const mcpExports: IMCPModuleExports = {
        contexts: {
          create: mcpService.createContext.bind(mcpService),
          update: mcpService.updateContext.bind(mcpService),
          delete: mcpService.deleteContext.bind(mcpService),
          get: async (id: string) => mcpService.getRepositories().contexts.findById(id),
          getByName: async (name: string) => mcpService.getRepositories().contexts.findByName(name),
          list: async (options?: any) => mcpService.getRepositories().contexts.list(options)
        },
        tools: {
          create: mcpService.createTool.bind(mcpService),
          update: async (id: string, data: any) => mcpService.getRepositories().tools.update(id, data),
          delete: async (id: string) => mcpService.getRepositories().tools.delete(id),
          get: async (id: string) => mcpService.getRepositories().tools.findById(id),
          listByContext: async (contextId: string) => mcpService.getRepositories().tools.findByContextId(contextId),
          getMcpTools: mcpService.getToolsForContext.bind(mcpService),
          listAsSDK: mcpService.getToolsForContext.bind(mcpService)
        },
        resources: {
          create: mcpService.createResource.bind(mcpService),
          update: async (id: string, data: any) => mcpService.getRepositories().resources.update(id, data),
          delete: async (id: string) => mcpService.getRepositories().resources.delete(id),
          get: async (id: string) => mcpService.getRepositories().resources.findById(id),
          listByContext: async (contextId: string) => mcpService.getRepositories().resources.findByContextId(contextId),
          getMcpResources: mcpService.getResourcesForContext.bind(mcpService),
          listAsSDK: mcpService.getResourcesForContext.bind(mcpService)
        },
        prompts: {
          create: mcpService.createPrompt.bind(mcpService),
          update: async (id: string, data: any) => mcpService.getRepositories().prompts.update(id, data),
          delete: async (id: string) => mcpService.getRepositories().prompts.delete(id),
          get: async (id: string) => mcpService.getRepositories().prompts.findById(id),
          listByContext: async (contextId: string) => mcpService.getRepositories().prompts.findByContextId(contextId),
          getMcpPrompts: mcpService.getPromptsForContext.bind(mcpService),
          listAsSDK: mcpService.getPromptsForContext.bind(mcpService)
        },
        server: {
          createFromContext: mcpService.createServerFromContext.bind(mcpService),
          getOrCreate: mcpService.getOrCreateServer.bind(mcpService)
        },
        permissions: {
          grant: async (contextId: string, principalId: string, permission: string) => {
            return mcpService.getRepositories().permissions.create({
              context_id: contextId,
              principal_id: principalId,
              permission,
              granted_at: new Date().toISOString()
            });
          },
          revoke: async (contextId: string, principalId: string, permission: string) => {
            await mcpService.getRepositories().permissions.revoke(contextId, principalId, permission);
            return true;
          },
          check: async (contextId: string, principalId: string, permission: string) => {
            return mcpService.getRepositories().permissions.hasPermission(contextId, principalId, permission);
          },
          listForContext: async (contextId: string) => {
            return mcpService.getRepositories().permissions.findByContextId(contextId);
          }
        },
        getRepositories: () => mcpService.getRepositories()
      };
    
      
      cliOutput.info('Seeding MCP data...');
      
      // Check if CLI context already exists
      let cliContext = await mcpExports.contexts.getByName('cli');
      
      if (cliContext && !validatedArgs.force) {
        cliOutput.info('CLI context already exists. Use --force to re-seed.');
        return;
      }
      
      if (cliContext && validatedArgs.force) {
        cliOutput.info('Deleting existing CLI context...');
        await mcpExports.contexts.delete(cliContext.id);
      }
      
      // Create CLI context
      cliOutput.info('Creating CLI context...');
      cliContext = await mcpExports.contexts.create({
        name: 'cli',
        description: 'SystemPrompt OS CLI tools context',
        version: '1.0.0',
        server_config: {
          name: 'SystemPrompt CLI Server',
          version: '1.0.0',
        },
      });
      
      // Create execute-cli tool
      cliOutput.info('Creating execute-cli tool...');
      await mcpExports.tools.create(cliContext.id, {
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
      cliOutput.info('Creating system-status tool...');
      await mcpExports.tools.create(cliContext.id, {
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
      cliOutput.info('Creating system-info resource...');
      await mcpExports.resources.create(cliContext.id, {
        uri: 'system://info',
        name: 'System Information',
        description: 'SystemPrompt OS system information',
        mime_type: 'application/json',
        content_type: 'dynamic',
        content: JSON.stringify({
          type: 'function',
          handler: 'system-info',
        }),
      });
      
      // Create modules list resource
      cliOutput.info('Creating modules-list resource...');
      await mcpExports.resources.create(cliContext.id, {
        uri: 'system://modules',
        name: 'Modules List',
        description: 'List of loaded SystemPrompt OS modules',
        mime_type: 'application/json',
        content_type: 'dynamic',
        content: JSON.stringify({
          type: 'function',
          handler: 'modules-list',
        }),
      });
      
      // Create default context
      cliOutput.info('Creating default context...');
      let defaultContext = await mcpExports.contexts.getByName('default');
      
      if (defaultContext && validatedArgs.force) {
        await mcpExports.contexts.delete(defaultContext.id);
        defaultContext = null;
      }
      
      if (!defaultContext) {
        defaultContext = await mcpExports.contexts.create({
          name: 'default',
          description: 'Default MCP context with basic capabilities',
          version: '1.0.0',
          server_config: {
            name: 'Default MCP Server',
            version: '1.0.0',
          },
        });
        
        // Create a basic prompt
        await mcpExports.prompts.create(defaultContext.id, {
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
      
      cliOutput.success('MCP data seeded successfully!');
      
      // List created contexts
      const contexts = await mcpExports.contexts.list({ is_active: true });
      cliOutput.info(`Created ${contexts.length} contexts:`);
      for (const ctx of contexts) {
        cliOutput.info(`  - ${ctx.name} (${ctx.id})`);
      }
      
      // Don't exit in test environment
      if (process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
      
      cliOutput.error('Failed to seed MCP data');
      logger.error(LogSource.CLI, 'Failed to seed MCP data', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  },
};