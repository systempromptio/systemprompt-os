/**
 * Update agent CLI command.
 * @file Update agent CLI command.
 * @module modules/core/agents/cli/update
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  AgentStatus,
  IAgent,
  IUpdateAgentDto
} from '@/modules/core/agents/types/agent.types';

/**
 * Type guard to check if value is a valid AgentStatus.
 * @param value - Value to check.
 * @returns True if valid AgentStatus.
 */
const isValidAgentStatus = (value: string): value is AgentStatus => {
  return ['idle', 'active', 'stopped', 'error'].includes(value);
};

/**
 * Type guard to check if value is a record.
 * @param value - Value to check.
 * @returns True if value is a record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
 * Processes string array fields from CLI arguments.
 * @param value - Value to process.
 * @returns String array.
 */
const processStringArrayField = (value: unknown): string[] => {
  return Array.isArray(value)
    ? value.map((item: unknown): string => {
      return typeof item === 'string' ? item : String(item);
    })
    : [typeof value === 'string' ? value : String(value)];
};

/**
 * Validates agent ID from CLI arguments.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @returns Agent ID.
 */
const validateAgentId = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): string => {
  if (typeof args.id !== 'string' || args.id.length === 0) {
    cliOutput.error('Agent ID is required (--id)');
    cliOutput.info('Usage: systemprompt agents update --id <id> [options]');
    process.exit(1);
  }
  return args.id;
};

/**
 * Validates status field from CLI arguments.
 * @param status - Status value.
 * @param cliOutput - CLI output service.
 * @returns Validated status or undefined.
 */
const validateStatusField = (
  status: unknown,
  cliOutput: CliOutputService
): AgentStatus | undefined => {
  if (typeof status === 'string' && status.length > 0) {
    if (!isValidAgentStatus(status)) {
      const errorMsg = `Invalid agent status: ${status}. `
        + 'Must be one of: idle, active, stopped, error';
      cliOutput.error(errorMsg);
      process.exit(1);
    }
    return status;
  }
  return undefined;
};

/**
 * Processes capabilities field from CLI arguments.
 * @param capabilities - Capabilities value.
 * @returns Processed capabilities or undefined.
 */
const processCapabilitiesField = (capabilities: unknown): string[] | undefined => {
  if (typeof capabilities !== 'undefined' && capabilities !== null) {
    return processStringArrayField(capabilities);
  }
  return undefined;
};

/**
 * Processes tools field from CLI arguments.
 * @param tools - Tools value.
 * @returns Processed tools or undefined.
 */
const processToolsField = (tools: unknown): string[] | undefined => {
  if (typeof tools !== 'undefined' && tools !== null) {
    return processStringArrayField(tools);
  }
  return undefined;
};

/**
 * Processes config field from CLI arguments.
 * @param config - Config value.
 * @param cliOutput - CLI output service.
 * @returns Processed config or undefined.
 */
const processConfigField = (
  config: unknown,
  cliOutput: CliOutputService
): Record<string, unknown> | undefined => {
  if (typeof config !== 'undefined' && config !== null) {
    return parseConfigValue(config, cliOutput);
  }
  return undefined;
};

/**
 * Processes basic string fields from CLI args.
 * @param args - CLI arguments.
 * @returns Object with basic fields.
 */
const getBasicFields = (args: Record<string, unknown>): Partial<IUpdateAgentDto> => {
  const {
    name, description, instructions
  } = args;
  const result: Partial<IUpdateAgentDto> = {};

  if (typeof name === 'string' && name.length > 0) {
    result.name = name;
  }

  if (typeof description === 'string' && description.length > 0) {
    result.description = description;
  }

  if (typeof instructions === 'string' && instructions.length > 0) {
    result.instructions = instructions;
  }

  return result;
};

/**
 * Builds update data from CLI arguments.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @returns Update data transfer object.
 */
const buildUpdateData = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): IUpdateAgentDto => {
  const basicFields = getBasicFields(args);

  const status = validateStatusField(args.status, cliOutput);
  const capabilities = processCapabilitiesField(args.capabilities);
  const tools = processToolsField(args.tools);
  const config = processConfigField(args.config, cliOutput);

  return {
    ...basicFields,
    ...status !== undefined && { status },
    ...capabilities !== undefined && { capabilities },
    ...tools !== undefined && { tools },
    ...config !== undefined && { config }
  };
};

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
    process.stdout.write(`${JSON.stringify(agent, null, 2)}\n`);
    return;
  }

  const tableData = [{
    id: agent.id,
    name: agent.name,
    type: agent.type,
    status: agent.status,
    updated: new Date(agent.updated_at).toISOString()
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

/**
 * Executes the agent update process.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @param agentService - Agent service instance.
 */
const executeUpdate = async (
  args: Record<string, unknown>,
  cliOutput: CliOutputService,
  agentService: AgentService
): Promise<void> => {
  const identifier = validateAgentId(args, cliOutput);
  const updateData = buildUpdateData(args, cliOutput);

  if (Object.keys(updateData).length === 0) {
    cliOutput.error('No update fields provided');
    process.exit(1);
  }

  const format = args.format;
  
  // Only show section header for non-JSON formats
  if (format !== 'json') {
    cliOutput.section('Updating Agent');
  }
  
  const agent = await agentService.updateAgent(identifier, updateData);

  if (agent === null) {
    cliOutput.error('Agent not found');
    process.exit(1);
  }

  // Only show success message for non-JSON formats
  if (format !== 'json') {
    cliOutput.success(`Agent '${agent.name}' updated successfully`);
  }
  
  displayUpdatedAgent(agent, args.format, cliOutput);
  process.exit(0);
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
      type: 'string',
      description: 'Output format (text, json)',
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
      const agentService = AgentService.getInstance();
      await executeUpdate(args, cliOutput, agentService);
    } catch (error) {
      cliOutput.error('Failed to update agent');
      logger.error(LogSource.AGENT, 'Error updating agent', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
