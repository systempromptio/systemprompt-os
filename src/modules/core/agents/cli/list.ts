/**
 * List agents CLI command.
 * @file List agents CLI command.
 * @module modules/core/agents/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { listCommandArgsSchema } from '@/modules/core/agents/cli/schemas';
import type { IAgent } from '@/modules/core/agents/types/agents.module.generated';
import { ZodError } from 'zod';

/**
 * Transforms agent data for table display.
 * @param agent - Agent to transform.
 * @returns Table row data.
 */
const transformAgentForTable = (agent: IAgent): Record<string, string> => {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    status: agent.status,
    tasks: `${String(agent.completed_tasks ?? 0)}/${String(agent.assigned_tasks ?? 0)}`,
    created: agent.created_at !== null && agent.created_at.length > 0
      ? new Date(agent.created_at).toLocaleDateString()
      : 'N/A'
  };
};

/**
 * Displays agents in table format.
 * @param agents - Agents to display.
 * @param cliOutput - CLI output service.
 */
const displayAgentsTable = (agents: IAgent[], cliOutput: CliOutputService): void => {
  const tableData = agents.map(transformAgentForTable);

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
      key: 'tasks',
      header: 'Tasks'
    },
    {
      key: 'created',
      header: 'Created'
    }
  ]);
};

/**
 * Displays agents in the specified format.
 * @param agents - Agents to display.
 * @param format - Output format.
 * @param cliOutput - CLI output service.
 */
const displayAgents = (
  agents: IAgent[],
  format: unknown,
  cliOutput: CliOutputService
): void => {
  if (format === 'json') {
    cliOutput.json(agents);
    return;
  }

  displayAgentsTable(agents, cliOutput);
};

export const command: ICLICommand = {
  description: 'List all agents',
  options: [
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Filter by agent status (idle, active, stopped, error)'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (table or json)',
      default: 'table'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = listCommandArgsSchema.parse(args);

      const agentService = AgentsService.getInstance();

      if (validatedArgs.format !== 'json') {
        cliOutput.section('Listing Agents');
      }

      const statusFilter = validatedArgs.status || '';
      const agents = await agentService.listAgents(statusFilter);

      if (agents.length === 0) {
        if (validatedArgs.format === 'json') {
          cliOutput.json([]);
        } else {
          cliOutput.info('No agents found');
        }
        process.exit(0);
      }

      displayAgents(agents, validatedArgs.format, cliOutput);
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
message: 'Failed to list agents'
});
        } else {
          cliOutput.error('Failed to list agents');
        }
        logger.error(LogSource.AGENT, 'Error listing agents', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
        process.exit(1);
      }
    }
  },
};
