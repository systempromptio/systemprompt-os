/**
 * MCP Module List Command
 * Lists MCP contexts, tools, resources, and prompts.
 */

import type { ICLIContext, ICLICommand } from '@/modules/core/cli/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { IMCPModuleExports } from '../types/manual';
import { z } from 'zod';

const listArgsSchema = z.object({
  context: z.string().optional(),
  format: z.enum(['table', 'json']).default('table'),
});

export const command: ICLICommand = {
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
      choices: ['table', 'json'],
      default: 'table',
    },
  ],
  execute: async (context: ICLIContext) => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    
    try {
      const validatedArgs = listArgsSchema.parse(context.args);
      
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
      
      if (validatedArgs.context) {
        // Show details for a specific context
        const ctx = await mcpExports.contexts.getByName(validatedArgs.context);
        if (!ctx) {
          cliOutput.error(`Context '${validatedArgs.context}' not found`);
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          return;
          return;
        }
        
        // Get tools, resources, and prompts
        const [tools, resources, prompts] = await Promise.all([
          mcpExports.tools.listByContext(ctx.id),
          mcpExports.resources.listByContext(ctx.id),
          mcpExports.prompts.listByContext(ctx.id),
        ]);
        
        if (validatedArgs.format === 'json') {
          cliOutput.output({
            context: ctx,
            tools,
            resources,
            prompts,
          }, { format: 'json' });
        } else {
          cliOutput.section(`Context: ${ctx.name} (${ctx.id})`);
          cliOutput.keyValue({
            Description: ctx.description || 'N/A',
            Version: ctx.version,
            Active: ctx.is_active ? 'Yes' : 'No'
          });
          
          if (tools.length > 0) {
            cliOutput.section(`Tools (${tools.length})`);
            for (const tool of tools) {
              cliOutput.info(`  - ${tool.name}: ${tool.description || 'No description'}`);
            }
          }
          
          if (resources.length > 0) {
            cliOutput.section(`Resources (${resources.length})`);
            for (const resource of resources) {
              cliOutput.info(`  - ${resource.uri}: ${resource.name}`);
            }
          }
          
          if (prompts.length > 0) {
            cliOutput.section(`Prompts (${prompts.length})`);
            for (const prompt of prompts) {
              cliOutput.info(`  - ${prompt.name}: ${prompt.description || 'No description'}`);
            }
          }
        }
      } else {
        // List all contexts
        const contexts = await mcpExports.contexts.list({ is_active: true });
        
        if (validatedArgs.format === 'json') {
          cliOutput.output(contexts, { format: 'json' });
        } else {
          if (contexts.length === 0) {
            cliOutput.info('No MCP contexts found. Run "mcp seed" to create default contexts.');
            return;
          }
          
          cliOutput.section(`MCP Contexts (${contexts.length})`);
          for (const ctx of contexts) {
            cliOutput.info(`  ${ctx.name} (${ctx.id})`);
            if (ctx.description) {
              cliOutput.info(`    ${ctx.description}`);
            }
            cliOutput.info(`    Version: ${ctx.version}, Active: ${ctx.is_active ? 'Yes' : 'No'}`);
          }
          cliOutput.info('\nUse --context <name> to see details for a specific context.');
        }
      }
      
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
      
      cliOutput.error('Error listing MCP contexts');
      logger.error(LogSource.CLI, 'Error listing MCP contexts', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  },
};