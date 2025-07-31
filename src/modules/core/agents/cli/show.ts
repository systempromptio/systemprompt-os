/**
 * Show agent CLI command.
 * @file Show agent CLI command.
 * @module modules/core/agents/cli/show
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { validateAgentIdentifier } from '@/modules/core/agents/cli/validation.helpers';
import { displayAgentDetails } from '@/modules/core/agents/cli/show.helpers';
import type { IAgent } from '@/modules/core/agents/types/agents.module.generated';

/**
 * Handles success case for agent display.
 * @param agent - Agent to display.
 * @param format - Output format.
 * @param cliOutput - CLI output service.
 */
const handleShowSuccess = (agent: IAgent, format: string, cliOutput: CliOutputService): void => {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(agent, null, 2)}\n`);
  } else {
    cliOutput.section('Agent Details');
    displayAgentDetails(agent);
  }
  process.exit(0);
};

/**
 * Handles error case for agent show.
 * @param error - Error that occurred.
 * @param logger - Logger service.
 * @param cliOutput - CLI output service.
 */
const handleShowError = (
  error: unknown,
  logger: LoggerService,
  cliOutput: CliOutputService
): void => {
  cliOutput.error('Failed to show agent');
  logger.error(LogSource.AGENT, 'Error showing agent', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  process.exit(1);
};

/**
 * Execute agent show command with validation and error handling.
 * @param context - CLI context with arguments and metadata.
 */
const executeShow = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();

  try {
    const identifier = validateAgentIdentifier(context);
    if (identifier === null) {
      process.exit(1);
    }

    const agentService = AgentsService.getInstance();
    const agent = await agentService.getAgent(identifier);

    if (agent === null) {
      cliOutput.error('Agent not found');
      process.exit(1);
    }

    const format = typeof context.args.format === 'string' ? context.args.format : 'text';
    handleShowSuccess(agent, format, cliOutput);
  } catch (error) {
    handleShowError(error, logger, cliOutput);
  }
};

export const command: ICLICommand = {
  description: 'Show agent details',
  options: [
    {
      name: 'name',
      alias: 'n',
      type: 'string',
      description: 'Agent name',
      required: false
    },
    {
      name: 'id',
      alias: 'i',
      type: 'string',
      description: 'Agent ID',
      required: false
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (text or json)',
      default: 'text',
      choices: ['text', 'json']
    }
  ],
  execute: executeShow,
};
