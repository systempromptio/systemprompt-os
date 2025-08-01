/**
 * Delete MCP context CLI command.
 * @file Delete MCP context CLI command.
 * @module modules/core/mcp/cli/delete
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { type DeleteMcpArgs, cliSchemas } from '@/modules/core/mcp/utils/cli-validation';

export const command: ICLICommand = {
  description: 'Delete an MCP context',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'string',
      description: 'Context ID to delete',
      required: true
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
    {
      name: 'confirm',
      alias: 'y',
      type: 'boolean',
      description: 'Skip confirmation prompt',
      default: false
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const validatedArgs = cliSchemas.delete.parse(context.args);

      const service = MCPService.getInstance();

      const contexts = await service.listContexts();
      const contextToDelete = contexts.find(ctx => { return ctx.id === validatedArgs.id });

      if (!contextToDelete) {
        cliOutput.error(`MCP context with ID '${validatedArgs.id}' not found`);
        process.exit(1);
      }

      await service.deleteContext(validatedArgs.id);

      const deletionResult = {
        deleted: true,
        context_id: validatedArgs.id,
        context_name: contextToDelete.name,
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(deletionResult);
      } else {
        cliOutput.success(`Deleted MCP context: ${contextToDelete.name} (${validatedArgs.id})`);
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        cliOutput.error('Invalid arguments:');
        (error as any).issues?.forEach((issue: any) => {
          cliOutput.error(`  ${issue.path.join('.')}: ${issue.message}`);
        });
      } else {
        cliOutput.error('Error deleting MCP context');
        logger.error(LogSource.MCP, 'Delete command failed', { error });
      }
      process.exit(1);
    }
  },
};
