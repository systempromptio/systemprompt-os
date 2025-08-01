/**
 * Delete agent CLI command.
 * @file Delete agent CLI command.
 * @module modules/core/agents/cli/delete
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { deleteCommandArgsSchema } from '@/modules/core/agents/cli/schemas';
import { ZodError } from 'zod';

export const command: ICLICommand = {
  description: 'Delete an agent',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'string',
      description: 'Agent ID to delete',
      required: true
    },
    {
      name: 'force',
      alias: 'f',
      type: 'boolean',
      description: 'Force deletion without confirmation',
      required: false,
      default: false
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = deleteCommandArgsSchema.parse(args);

      const agentService = AgentsService.getInstance();

      if (validatedArgs.format !== 'json') {
        cliOutput.section('Deleting Agent');
      }

      const success = await agentService.deleteAgent(validatedArgs.id);

      if (!success) {
        if (validatedArgs.format === 'json') {
          cliOutput.json({
 success: false,
message: 'Agent not found'
});
        } else {
          cliOutput.error('Agent not found');
        }
        process.exit(1);
      }

      if (validatedArgs.format === 'json') {
        cliOutput.json({
 success: true,
message: 'Agent deleted successfully'
});
      } else {
        cliOutput.success('Agent deleted successfully');
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof ZodError) {
        if (args.format === 'json') {
          cliOutput.json({
            success: false,
            message: 'Invalid arguments',
            errors: error.errors.map(err => { return {
              field: err.path.join('.'),
              message: err.message
            } })
          });
        } else {
          cliOutput.error('Invalid arguments:');
          error.errors.forEach(err => {
            const field = err.path.length > 0 ? err.path.join('.') : 'argument';
            cliOutput.error(`  ${field}: ${err.message}`);
          });
        }
        process.exit(1);
      } else {
        if (args.format === 'json') {
          cliOutput.json({
 success: false,
message: 'Failed to delete agent'
});
        } else {
          cliOutput.error('Failed to delete agent');
        }
        logger.error(LogSource.AGENT, 'Error deleting agent', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
        process.exit(1);
      }
    }
  },
};
