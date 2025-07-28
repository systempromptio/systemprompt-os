/**
 * Delete agent CLI command.
 * @file Delete agent CLI command.
 * @module modules/core/agents/cli/delete
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Validates delete command arguments.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @returns Agent ID if valid.
 */
const validateDeleteArgs = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): string | null => {
  if (typeof args.id !== 'string' || args.id === '') {
    cliOutput.error('Agent ID is required (--id)');
    cliOutput.info('Usage: systemprompt agent delete --id <id>');
    return null;
  }
  return String(args.id);
};

/**
 * Performs agent deletion.
 * @param agentService - Agent service instance.
 * @param identifier - Agent identifier.
 * @param cliOutput - CLI output service.
 * @returns Promise resolving to success status.
 */
const performDeletion = async (
  agentService: AgentService,
  identifier: string,
  cliOutput: CliOutputService
): Promise<boolean> => {
  cliOutput.section('Deleting Agent');
  const success = await agentService.deleteAgent(identifier);

  if (!success) {
    cliOutput.error('Agent not found');
    return false;
  }

  cliOutput.success('Agent deleted successfully');
  return true;
};

export const command: ICLICommand = {
  description: 'Delete an agent',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const identifier = validateDeleteArgs(args, cliOutput);
      if (identifier === null) {
        process.exit(1);
      }

      const agentService = AgentService.getInstance();
      const success = await performDeletion(agentService, identifier, cliOutput);

      process.exit(success ? 0 : 1);
    } catch (error) {
      cliOutput.error('Failed to delete agent');
      logger.error(LogSource.AGENT, 'Error deleting agent', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
