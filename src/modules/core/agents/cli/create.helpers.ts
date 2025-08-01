/**
 * Helper functions for agent creation CLI.
 * @file Helper functions for agent creation CLI.
 * @module modules/core/agents/cli/create-helpers
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type {
  IAgent,
  IAgentCreateData
} from '@/modules/core/agents/types/agents.module.generated';
import type { AgentsType } from '@/modules/core/agents/types/database.generated';

/**
 * Type guard to check if value is a record.
 * @param value - Value to check.
 * @returns True if value is a record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Validates if a string is a valid AgentType.
 * @param value - Value to validate.
 * @returns True if valid AgentType.
 */
const isValidAgentType = (value: string): value is AgentsType => {
  return ['worker', 'monitor', 'coordinator'].includes(value);
};

/**
 * Parses config value from CLI arguments.
 * @param config - Config value to parse.
 * @param cliOutput - CLI output service.
 * @returns Parsed config object.
 */
const parseConfigValue = (
  config: unknown,
  cliOutput: CliOutputService
): Record<string, unknown> => {
  if (typeof config === 'string') {
    try {
      const parsed: unknown = JSON.parse(config);
      if (isRecord(parsed)) {
        return parsed;
      }
      cliOutput.error('Config JSON must be an object');
      process.exit(1);
    } catch {
      cliOutput.error('Invalid JSON for config option');
      process.exit(1);
    }
  }

  if (isRecord(config)) {
    return config;
  }

  cliOutput.error('Config must be a JSON string or object');
  process.exit(1);
};

/**
 * Converts comma-separated string or array to string arrays safely.
 * @param value - Value to convert.
 * @returns Array of strings.
 */
const convertToStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item: unknown): string => {
      return typeof item === 'string' ? item : String(item);
    });
  }
  if (typeof value === 'string') {
    return value.split(',')
      .map((item: string): string => {
        return item.trim();
      })
      .filter((item: string): boolean => {
        return item.length > 0;
      });
  }
  return [String(value)];
};

/**
 * Builds agent data from CLI arguments.
 * @param context - CLI context.
 * @returns Agent data transfer object.
 */
export const buildAgentData = (context: ICLIContext): IAgentCreateData => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();

  const typeString = String(args.type);
  if (!isValidAgentType(typeString)) {
    const errorMsg = `Invalid agent type: ${typeString}. `
      + 'Must be one of: worker, monitor, coordinator';
    cliOutput.error(errorMsg);
    process.exit(1);
  }

  const agentData: IAgentCreateData = {
    name: String(args.name),
    description: String(args.description),
    instructions: String(args.instructions),
    type: typeString
  };

  if (typeof args.capabilities !== 'undefined' && args.capabilities !== null) {
    agentData.capabilities = convertToStringArray(args.capabilities);
  }

  if (typeof args.tools !== 'undefined' && args.tools !== null) {
    agentData.tools = convertToStringArray(args.tools);
  }

  if (typeof args.config !== 'undefined' && args.config !== null) {
    agentData.config = parseConfigValue(args.config, cliOutput);
  }

  return agentData;
};

/**
 * Displays created agent information.
 * @param agent - Created agent.
 * @param format - Output format.
 */
export const displayCreatedAgent = (agent: IAgent, format?: string): void => {
  const cliOutput = CliOutputService.getInstance();

  if (format === 'json') {
    cliOutput.json(agent);
    return;
  }
  const tableData = [{
    id: agent.id,
    name: agent.name,
    type: agent.type,
    status: agent.status,
    created: agent.created_at !== null && agent.created_at.length > 0
      ? new Date(agent.created_at).toISOString()
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
      key: 'created',
      header: 'Created'
    }
  ]);
}
