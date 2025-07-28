/**
 * Create agent CLI command.
 * @file Create agent CLI command.
 * @module modules/core/agents/cli/create
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { validateCreateAgentArgs } from '@/modules/core/agents/cli/validation.helpers';
import { buildAgentData, displayCreatedAgent } from '@/modules/core/agents/cli/create.helpers';
import type { IAgent } from '@/modules/core/agents/types/agent.types';

/**
 * Handles success case for agent creation.
 * @param agent - Created agent.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 */
const handleSuccess = (
  agent: IAgent,
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): void => {
  cliOutput.success(`Agent '${agent.name}' created successfully`);
  displayCreatedAgent(agent, typeof args.format === 'string' ? args.format : undefined);
  process.exit(0);
};

/**
 * Handles error case for agent creation.
 * @param error - Error that occurred.
 * @param logger - Logger service.
 * @param cliOutput - CLI output service.
 */
const handleError = (
  error: unknown,
  logger: LoggerService,
  cliOutput: CliOutputService
): void => {
  cliOutput.error('Failed to create agent');
  logger.error(LogSource.AGENT, 'Error creating agent', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  process.exit(1);
};

/**
 * Execute agent creation with validation and error handling.
 * @param context - CLI context with arguments and metadata.
 */
const executeCreation = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();

  try {
    if (!validateCreateAgentArgs(context)) {
      process.exit(1);
    }

    const agentService = AgentService.getInstance();
    const agentData = buildAgentData(context);
    cliOutput.section('Creating Agent');
    const agent = await agentService.createAgent(agentData);
    handleSuccess(agent, args, cliOutput);
  } catch (error) {
    handleError(error, logger, cliOutput);
  }
};

export const command: ICLICommand = {
  description: 'Create a new agent',
  execute: executeCreation,
};
