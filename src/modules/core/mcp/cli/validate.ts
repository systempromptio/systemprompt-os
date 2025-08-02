/**
 * MCP Module Validate Command
 * Validates MCP contexts, tools, resources, and prompts.
 */

import type { ICLIContext, ICLICommand } from '@/modules/core/cli/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { IMCPModuleExports } from '../types/manual';
import { z } from 'zod';

const validateArgsSchema = z.object({
  context: z.string().optional(),
  type: z.enum(['context', 'tools', 'resources', 'prompts', 'all']).default('all'),
  fix: z.boolean().default(false),
});

export const command: ICLICommand = {
  description: 'Validate MCP contexts, tools, resources, and prompts',
  options: [
    {
      name: 'context',
      alias: 'c',
      type: 'string',
      description: 'Context name to validate (validates all if not specified)',
    },
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Type to validate (context, tools, resources, prompts, all)',
      choices: ['context', 'tools', 'resources', 'prompts', 'all'],
      default: 'all',
    },
    {
      name: 'fix',
      alias: 'f',
      type: 'boolean',
      description: 'Attempt to fix validation issues',
      default: false,
    },
  ],
  execute: async (context: ICLIContext) => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    
    try {
      const validatedArgs = validateArgsSchema.parse(context.args);
      
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
    
      
      let contexts = [];
      
      if (validatedArgs.context) {
        // Validate specific context
        const ctx = await mcpExports.contexts.getByName(validatedArgs.context);
        if (!ctx) {
          cliOutput.error(`Context '${validatedArgs.context}' not found`);
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          return;
          return;
        }
        contexts = [ctx];
      } else {
        // Validate all contexts
        contexts = await mcpExports.contexts.list({ is_active: true });
      }
      
      if (contexts.length === 0) {
        cliOutput.info('No contexts to validate');
        return;
      }
      
      cliOutput.info(`Validating ${contexts.length} context(s)...`);
      
      let totalErrors = 0;
      let totalWarnings = 0;
      
      for (const ctx of contexts) {
        cliOutput.section(`Validating context: ${ctx.name}`);
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate context structure
        if (validatedArgs.type === 'all' || validatedArgs.type === 'context') {
          const contextSchema = z.object({
            id: z.string().uuid(),
            name: z.string().min(1),
            description: z.string().optional(),
            version: z.string().regex(/^\d+\.\d+\.\d+$/),
            server_config: z.object({
              name: z.string(),
              version: z.string(),
            }),
            auth_config: z.object({
              type: z.enum(['bearer', 'client']),
            }).optional(),
            is_active: z.boolean(),
          });
          
          const result = contextSchema.safeParse(ctx);
          if (!result.success) {
            result.error.errors.forEach(err => {
              errors.push(`Context: ${err.path.join('.')} - ${err.message}`);
            });
          }
        }
        
        // Validate tools
        if (validatedArgs.type === 'all' || validatedArgs.type === 'tools') {
          const tools = await mcpExports.tools.listByContext(ctx.id);
          cliOutput.info(`  Validating ${tools.length} tool(s)...`);
          
          const toolSchema = z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            input_schema: z.record(z.any()).optional(),
            handler_type: z.enum(['function', 'http', 'script']),
            handler_config: z.record(z.any()),
          });
          
          for (const tool of tools) {
            const result = toolSchema.safeParse(tool);
            if (!result.success) {
              result.error.errors.forEach(err => {
                errors.push(`Tool '${tool.name}': ${err.path.join('.')} - ${err.message}`);
              });
            }
            
            // Validate input schema if present
            if (tool.input_schema) {
              try {
                // Check if schema is valid JSON Schema
                if (tool.input_schema.type !== 'object' && 
                    tool.input_schema.type !== 'string' && 
                    tool.input_schema.type !== 'number' && 
                    tool.input_schema.type !== 'boolean' && 
                    tool.input_schema.type !== 'array' && 
                    tool.input_schema.type !== 'null') {
                  warnings.push(`Tool '${tool.name}': Invalid schema type '${tool.input_schema.type}'`);
                }
              } catch (err) {
                errors.push(`Tool '${tool.name}': Invalid input schema`);
              }
            }
          }
        }
        
        // Validate resources
        if (validatedArgs.type === 'all' || validatedArgs.type === 'resources') {
          const resources = await mcpExports.resources.listByContext(ctx.id);
          cliOutput.info(`  Validating ${resources.length} resource(s)...`);
          
          const resourceSchema = z.object({
            uri: z.string().min(1),
            name: z.string().min(1),
            description: z.string().optional(),
            mime_type: z.string().min(1),
            content_type: z.enum(['static', 'dynamic']),
            content: z.string().optional(),
          });
          
          for (const resource of resources) {
            const result = resourceSchema.safeParse(resource);
            if (!result.success) {
              result.error.errors.forEach(err => {
                errors.push(`Resource '${resource.uri}': ${err.path.join('.')} - ${err.message}`);
              });
            }
            
            // Validate URI format
            if (!resource.uri.includes('://')) {
              warnings.push(`Resource '${resource.uri}': URI should include protocol (e.g., 'test://file')`);
            }
          }
        }
        
        // Validate prompts
        if (validatedArgs.type === 'all' || validatedArgs.type === 'prompts') {
          const prompts = await mcpExports.prompts.listByContext(ctx.id);
          cliOutput.info(`  Validating ${prompts.length} prompt(s)...`);
          
          const promptSchema = z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            arguments: z.array(z.object({
              name: z.string().min(1),
              description: z.string().optional(),
              required: z.boolean(),
            })),
            template: z.string().min(1),
          });
          
          for (const prompt of prompts) {
            const result = promptSchema.safeParse(prompt);
            if (!result.success) {
              result.error.errors.forEach(err => {
                errors.push(`Prompt '${prompt.name}': ${err.path.join('.')} - ${err.message}`);
              });
            }
            
            // Check if template uses all arguments
            if (prompt.arguments) {
              for (const arg of prompt.arguments) {
                if (!prompt.template.includes(`{{${arg.name}}}`)) {
                  warnings.push(`Prompt '${prompt.name}': Argument '${arg.name}' not used in template`);
                }
              }
            }
          }
        }
        
        // Report results for this context
        if (errors.length > 0) {
          cliOutput.error(`${errors.length} error(s) found:`);
          errors.forEach(err => cliOutput.error(`  • ${err}`));
          totalErrors += errors.length;
        }
        
        if (warnings.length > 0) {
          cliOutput.info(`⚠️  ${warnings.length} warning(s) found:`);
          warnings.forEach(warn => cliOutput.info(`  • ${warn}`));
          totalWarnings += warnings.length;
        }
        
        if (errors.length === 0 && warnings.length === 0) {
          cliOutput.success(`Context '${ctx.name}' is valid!`);
        }
      }
      
      // Summary
      cliOutput.section('Validation Summary');
      if (totalErrors === 0 && totalWarnings === 0) {
        cliOutput.success('All validations passed!');
      } else {
        if (totalErrors > 0) {
          cliOutput.error(`Total errors: ${totalErrors}`);
        }
        if (totalWarnings > 0) {
          cliOutput.info(`⚠️  Total warnings: ${totalWarnings}`);
        }
        
        if (validatedArgs.fix) {
          cliOutput.info('Fix mode is not yet implemented');
        } else {
          cliOutput.info('Run with --fix to attempt automatic fixes');
        }
      }
      
      if (process.env.NODE_ENV !== 'test') {
        process.exit(totalErrors > 0 ? 1 : 0);
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
      
      cliOutput.error('Validation failed');
      logger.error(LogSource.CLI, 'Validation failed', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  },
};