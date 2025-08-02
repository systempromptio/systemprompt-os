/**
 * MCP Module Create Command
 * Creates new MCP contexts.
 */

import type { ICLIContext, ICLICommand } from '@/modules/core/cli/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { IMCPModuleExports } from '../types/manual';
import { z } from 'zod';

const createArgsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  auth: z.enum(['none', 'bearer', 'client']).default('none'),
});

export const command: ICLICommand = {
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
      default: '1.0.0',
    },
    {
      name: 'auth',
      alias: 'a',
      type: 'string',
      description: 'Authentication type (none, bearer, client)',
      choices: ['none', 'bearer', 'client'],
      default: 'none',
    },
  ],
  execute: async (context: ICLIContext) => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    
    try {
      const validatedArgs = createArgsSchema.parse(context.args);
      
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
    
      // Check if context already exists
      const existing = await mcpExports.contexts.getByName(validatedArgs.name);
      if (existing) {
        cliOutput.error(`Context '${validatedArgs.name}' already exists`);
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        return;
      }
      
      // Create context
      cliOutput.info(`Creating MCP context '${validatedArgs.name}'...`);
      
      const contextData: any = {
        name: validatedArgs.name,
        version: validatedArgs.version,
        server_config: {
          name: `${validatedArgs.name} MCP Server`,
          version: validatedArgs.version,
        },
      };
      
      if (validatedArgs.description) {
        contextData.description = validatedArgs.description;
      }
      
      if (validatedArgs.auth !== 'none') {
        contextData.auth_config = {
          type: validatedArgs.auth as 'bearer' | 'client',
        };
      }
      
      const newContext = await mcpExports.contexts.create(contextData);
      
      cliOutput.success(`Context '${newContext.name}' created successfully!`);
      cliOutput.info(`Context ID: ${newContext.id}`);
      
      // Create MCP SDK server for the context
      cliOutput.info('Initializing MCP SDK server...');
      await mcpExports.server.createFromContext(newContext.id);
      
      cliOutput.section('Next steps');
      cliOutput.info(`  1. Add tools:     mcp add-tool --context ${validatedArgs.name} --name <tool-name>`);
      cliOutput.info(`  2. Add resources: mcp add-resource --context ${validatedArgs.name} --uri <resource-uri>`);
      cliOutput.info(`  3. Add prompts:   mcp add-prompt --context ${validatedArgs.name} --name <prompt-name>`);
      cliOutput.info(`  4. View details:  mcp list --context ${validatedArgs.name}`);
      
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
      
      cliOutput.error('Failed to create context');
      logger.error(LogSource.CLI, 'Failed to create context', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  },
};