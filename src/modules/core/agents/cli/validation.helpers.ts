/**
 * CLI validation helpers for agent commands.
 * @file CLI validation helpers for agent commands.
 * @module modules/core/agents/cli/validation
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { AgentType } from '@/modules/core/agents/types/agent.types';

/**
 * Validates required arguments for agent creation.
 * @param context - CLI context.
 * @returns True if valid, false otherwise.
 */
export const validateCreateAgentArgs = (context: ICLIContext): boolean => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();

  const hasName = Boolean(args.name);
  const hasDescription = Boolean(args.description);
  const hasInstructions = Boolean(args.instructions);
  const hasType = Boolean(args.type);

  if (!hasName || !hasDescription || !hasInstructions || !hasType) {
    cliOutput.error('Name, description, instructions, and type are required');
    cliOutput.info(
      'Usage: systemprompt agent create -n <name> -d <description> -i <instructions> -t <type>'
    );
    cliOutput.info('Types: worker, monitor, coordinator');
    return false;
  }

  return true;
}

/**
 * Validates agent type.
 * @param type - Agent type to validate.
 * @returns True if valid, false otherwise.
 */
export const validateAgentType = (type: string): type is AgentType => {
  const validTypes: readonly string[] = ['worker', 'monitor', 'coordinator'];
  return validTypes.includes(type);
}

/**
 * Validates agent identifier for show/delete operations.
 * @param context - CLI context.
 * @returns Agent identifier if valid, null otherwise.
 */
export const validateAgentIdentifier = (context: ICLIContext): string | null => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();

  const hasName = Boolean(args.name);
  const hasId = Boolean(args.id);

  if (!hasName && !hasId) {
    cliOutput.error('Either agent name (-n) or ID (-i) is required');
    return null;
  }

  const name = typeof args.name === 'string' ? args.name : null;
  const id = typeof args.id === 'string' ? args.id : null;
  return name ?? id ?? '';
}
