/**
 * List agents CLI command.
 * @file List agents CLI command.
 * @module modules/core/agents/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IAgent } from '@/modules/core/agents/types/agents.module.generated';

/**
 * Type guard to check if value is a string.
 * @param value - Value to check.
 * @returns True if value is a string.
 */
const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

/**
 * Gets validated status filter from CLI arguments.
 * @param status - Status argument from CLI.
 * @returns Validated status string or undefined.
 */
const getStatusFilter = (status: unknown): string | undefined => {
  return isString(status) ? status : undefined;
};

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
    created: agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'N/A'
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
    process.stdout.write(`${JSON.stringify(agents, null, 2)}\n`);
    return;
  }

  displayAgentsTable(agents, cliOutput);
};

/**
 * Executes the agent listing process.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @param agentService - Agent service instance.
 */
const executeList = async (
  args: Record<string, unknown>,
  cliOutput: CliOutputService,
  agentService: AgentsService
): Promise<void> => {
  cliOutput.section('Listing Agents');

  const statusFilter = getStatusFilter(args.status);
  const agents = await agentService.listAgents(statusFilter || '');

  if (agents.length === 0) {
    cliOutput.info('No agents found');
    process.exit(0);
  }

  displayAgents(agents, args.format, cliOutput);
  process.exit(0);
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
      const agentService = AgentsService.getInstance();
      await executeList(args, cliOutput, agentService);
    } catch (error) {
      cliOutput.error('Failed to list agents');
      logger.error(LogSource.AGENT, 'Error listing agents', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
