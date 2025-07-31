/**
 * CLI validation helpers for agent commands.
 * @file CLI validation helpers for agent commands.
 * @module modules/core/agents/cli/validation
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

/**
 * Validates required arguments for agent creation.
 * @param context - CLI context.
 * @returns True if valid, false otherwise.
 */
export const validateCreateAgentArgs = (context: ICLIContext): boolean => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();

  const hasName = Boolean(args.name || args.n);
  const hasDescription = Boolean(args.description || args.d);
  const hasInstructions = Boolean(args.instructions || args.i);
  const hasType = Boolean(args.type || args.t);

  if (!hasName || !hasDescription || !hasInstructions || !hasType) {
    cliOutput.error('Name, description, instructions, and type are required');
    cliOutput.info('Missing arguments:');
    if (!hasName) { cliOutput.info('  - name (--name or -n)'); }
    if (!hasDescription) { cliOutput.info('  - description (--description or -d)'); }
    if (!hasInstructions) { cliOutput.info('  - instructions (--instructions or -i)'); }
    if (!hasType) { cliOutput.info('  - type (--type or -t)'); }
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
export const validateAgentType = (type: string): boolean => {
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
