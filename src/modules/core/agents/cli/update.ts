/**
 * Update agent CLI command.
 * @file Update agent CLI command.
 * @module modules/core/agents/cli/update
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import type { IAgent } from '@/modules/core/agents/types/agents.module.generated';
import { updateCommandArgsSchema } from '@/modules/core/agents/cli/schemas';
import { ZodError } from 'zod';

/**
 * Displays updated agent information.
 * @param agent - Updated agent.
 * @param format - Output format.
 * @param cliOutput - CLI output service.
 */
const displayUpdatedAgent = (
  agent: IAgent,
  format: unknown,
  cliOutput: CliOutputService
): void => {
  if (format === 'json') {
    cliOutput.json(agent);
    return;
  }

  const tableData = [{
    id: agent.id,
    name: agent.name,
    type: agent.type,
    status: agent.status,
    updated: agent.updated_at !== null && agent.updated_at.length > 0
      ? new Date(agent.updated_at).toISOString()
      : 'N/A'
  }];

  cliOutput.table(tableData, [
    {
      key: 'id',
      header: 'ID'
    },
    {
      key: 'name',
      header: 'Name'
    },
    {
      key: 'type',
      header: 'Type'
    },
    {
      key: 'status',
      header: 'Status'
    },
    {
      key: 'updated',
      header: 'Updated'
    }
  ]);
};

export const command: ICLICommand = {
  description: 'Update an existing agent',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'string',
      description: 'Agent ID to update',
      required: true
    },
    {
      name: 'name',
      type: 'string',
      description: 'New agent name',
      required: false
    },
    {
      name: 'description',
      type: 'string',
      description: 'New agent description',
      required: false
    },
    {
      name: 'instructions',
      type: 'string',
      description: 'New agent instructions',
      required: false
    },
    {
      name: 'status',
      type: 'string',
      description: 'New agent status (idle, active, stopped, error)',
      required: false,
      choices: ['idle', 'active', 'stopped', 'error']
    },
    {
      name: 'capabilities',
      type: 'string',
      description: 'Comma-separated list of capabilities',
      required: false
    },
    {
      name: 'tools',
      type: 'string',
      description: 'Comma-separated list of tools',
      required: false
    },
    {
      name: 'config',
      type: 'string',
      description: 'JSON configuration object',
      required: false
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      required: false,
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = updateCommandArgsSchema.parse(args);

      const agentService = AgentsService.getInstance();

      if (validatedArgs.format !== 'json') {
        cliOutput.section('Updating Agent');
      }

      const agent = await agentService.updateAgent(validatedArgs.id, validatedArgs);

      if (agent === null) {
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

      if (validatedArgs.format !== 'json') {
        cliOutput.success(`Agent '${agent.name}' updated successfully`);
      }

      displayUpdatedAgent(agent, validatedArgs.format, cliOutput);
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
message: 'Failed to update agent'
});
        } else {
          cliOutput.error('Failed to update agent');
        }
        logger.error(LogSource.AGENT, 'Error updating agent', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
        process.exit(1);
      }
    }
  },
};
