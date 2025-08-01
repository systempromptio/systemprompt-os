/**
 * List MCP contexts CLI command.
 * @file List MCP contexts CLI command.
 * @module modules/core/mcp/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { cliSchemas, type ListMcpArgs } from '../utils/cli-validation';

export const command: ICLICommand = {
  description: 'List all configured MCP contexts',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
    {
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Maximum number of contexts to return',
      default: 20
    },
    {
      name: 'page',
      alias: 'p',
      type: 'number',
      description: 'Page number for pagination',
      default: 1
    },
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Filter by status'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      // Validate arguments with Zod
      const validatedArgs = cliSchemas.list.parse(context.args) as ListMcpArgs;
      
      const service = MCPService.getInstance();
      const contexts = await service.listContexts();

      if (validatedArgs.format === 'json') {
        // Return full database objects in JSON
        cliOutput.json(contexts);
      } else {
        if (contexts.length === 0) {
          cliOutput.info('No MCP contexts found.');
          return;
        }

        cliOutput.section('MCP Contexts');
        cliOutput.table(contexts, [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'name', header: 'Name', width: 20 },
          { key: 'model', header: 'Model', width: 15 },
          { key: 'max_tokens', header: 'Max Tokens', width: 12, format: (v) => v || 'N/A' },
          { key: 'temperature', header: 'Temperature', width: 12, format: (v) => v || 'N/A' },
          { key: 'created_at', header: 'Created', width: 12, format: (v) => v ? new Date(v).toLocaleDateString() : 'N/A' }
        ]);
      }
      
      process.exit(0);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        // Handle Zod validation errors
        cliOutput.error('Invalid arguments:');
        (error as any).issues?.forEach((issue: any) => {
          cliOutput.error(`  ${issue.path.join('.')}: ${issue.message}`);
        });
      } else {
        cliOutput.error('Error listing MCP contexts');
        logger.error(LogSource.MCP, 'List command failed', { error });
      }
      process.exit(1);
    }
  },
};
