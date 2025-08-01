/**
 * CLI validation helpers for agent commands.
 * @file CLI validation helpers for agent commands.
 * @module modules/core/agents/cli/validation
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { IFieldValidation } from '@/modules/core/agents/types/manual';

/**
 * Validates required arguments for agent creation.
 * @param context - CLI context.
 * @returns True if valid, false otherwise.
 */
export const validateCreateAgentArgs = (context: ICLIContext): boolean => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();

  const hasName = Boolean(args.name ?? args.n);
  const hasDescription = Boolean(args.description ?? args.d);
  const hasInstructions = Boolean(args.instructions ?? args.i);
  const hasType = Boolean(args.type ?? args.t);

  const missingFields = getMissingRequiredFields({
    hasName,
    hasDescription,
    hasInstructions,
    hasType
  });

  if (missingFields.length > 0) {
    displayValidationErrors(cliOutput, missingFields);
    return false;
  }

  return true;
};

/**
 * Gets list of missing required fields.
 * @param fields - Field validation results.
 * @returns Array of missing field names.
 */
const getMissingRequiredFields = (fields: IFieldValidation): string[] => {
  const missing: string[] = [];
  const fieldMapping = {
    hasName: 'name (--name or -n)',
    hasDescription: 'description (--description or -d)',
    hasInstructions: 'instructions (--instructions or -i)',
    hasType: 'type (--type or -t)'
  };

  Object.entries(fieldMapping).forEach(([fieldKey, fieldName]): void => {
    if (!fields[fieldKey as keyof IFieldValidation]) {
      missing.push(fieldName);
    }
  });

  return missing;
}

/**
 * Displays validation errors for missing fields.
 * @param cliOutput - CLI output service.
 * @param missingFields - Array of missing field names.
 */
const displayValidationErrors = (
  cliOutput: CliOutputService,
  missingFields: string[]
): void => {
  cliOutput.error('Name, description, instructions, and type are required');
  cliOutput.info('Missing arguments:');

  missingFields.forEach((field): void => {
    cliOutput.info(`  - ${field}`);
  });

  cliOutput.info('Types: worker, monitor, coordinator');
}

/**
 * Validates identifier arguments.
 * @param args - Command arguments.
 * @returns Validation result.
 */
const validateIdentifierArgs = (args: Record<string, unknown>): {
  isValid: boolean;
  identifier: string;
} => {
  const name = typeof args.name === 'string' ? args.name : null;
  const id = typeof args.id === 'string' ? args.id : null;
  const identifier = name ?? id ?? '';

  return {
    isValid: Boolean(name ?? id),
    identifier
  };
};

/**
 * Valid agent types constant.
 */
const VALID_AGENT_TYPES: readonly string[] = ['worker', 'monitor', 'coordinator'];

/**
 * Validates agent type.
 * @param type - Agent type to validate.
 * @returns True if valid, false otherwise.
 */
export const validateAgentType = (type: string): boolean => {
  return VALID_AGENT_TYPES.includes(type);
};

/**
 * Validates agent identifier for show/delete operations.
 * @param context - CLI context.
 * @returns Agent identifier if valid, null otherwise.
 */
export const validateAgentIdentifier = (context: ICLIContext): string | null => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();

  const identifierValidation = validateIdentifierArgs(args);

  if (!identifierValidation.isValid) {
    cliOutput.error('Either agent name (-n) or ID (-i) is required');
    return null;
  }

  return identifierValidation.identifier;
};
