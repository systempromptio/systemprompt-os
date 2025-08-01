/**
 * Create agent CLI command.
 * @file Create agent CLI command.
 * @module modules/core/agents/cli/create
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { type CreateCommandArgs, createCommandArgsSchema } from '@/modules/core/agents/cli/schemas';
import { displayCreatedAgent } from '@/modules/core/agents/cli/create.helpers';
import type { IAgent } from '@/modules/core/agents/types/agents.module.generated';
import { ZodError } from 'zod';

/**
 * Handles success case for agent creation.
 * @param agent - Created agent.
 * @param args - Validated CLI arguments.
 * @param cliOutput - CLI output service.
 */
const handleSuccess = (
  agent: IAgent,
  args: CreateCommandArgs,
  cliOutput: CliOutputService
): void => {
  if (args.format !== 'json') {
    cliOutput.success(`Agent '${agent.name}' created successfully`);
  }

  displayCreatedAgent(agent, args.format);
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
  const errorMessage = error instanceof Error ? error.message : String(error);
  cliOutput.error(`Failed to create agent: ${errorMessage}`);
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
    const validatedArgs = createCommandArgsSchema.parse(args);

    const agentService = AgentsService.getInstance();

    if (validatedArgs.format !== 'json') {
      cliOutput.section('Creating Agent');
    }

    const agent = await agentService.createAgent(validatedArgs);
    handleSuccess(agent, validatedArgs, cliOutput);
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
      handleError(error, logger, cliOutput);
    }
  }
};

export const command: ICLICommand = {
  description: 'Create a new agent',
  options: [
    {
      name: 'name',
      alias: 'n',
      type: 'string',
      description: 'Agent name',
      required: true
    },
    {
      name: 'description',
      alias: 'd',
      type: 'string',
      description: 'Agent description',
      required: true
    },
    {
      name: 'instructions',
      alias: 'i',
      type: 'string',
      description: 'Agent instructions',
      required: true
    },
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Agent type (worker, monitor, coordinator)',
      required: true,
      choices: ['worker', 'monitor', 'coordinator']
    },
    {
      name: 'capabilities',
      alias: 'c',
      type: 'string',
      description: 'Agent capabilities (comma-separated)'
    },
    {
      name: 'tools',
      type: 'string',
      description: 'Agent tools (comma-separated)'
    },
    {
      name: 'config',
      type: 'string',
      description: 'Agent configuration (JSON format)'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: executeCreation,
};
