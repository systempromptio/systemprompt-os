/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * 1. TypeScript circular dependency with @/modules/core/modules/types/manual import
 * 2. Type assertion issues due to strict TypeScript configuration
 * 3. Complex path mapping issues in tsconfig affecting module resolution
 * 4. ESLint custom rules enforcing types in types/ folders create conflicts
 * The file has been significantly improved: reduced complexity, better error handling,
 * removed many lint violations, but some issues require broader codebase refactoring.
 */

/**
 * Type-safe manifest parser utilities.
 * Utilities for parsing and validating module manifests.
 * @file Type-safe manifest parser utilities.
 * @module modules/core/modules/utils/manifest-parser
 */

import { parse as parseYaml } from 'yaml';
import { ModulesType } from '@/modules/core/modules/types/database.generated';
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';

type ModuleManifest = Pick<IModulesRow, 'name' | 'version' | 'type'> & {
  description?: string;
  author?: string;
  dependencies?: string[];
  config?: Record<string, unknown>;
  cli?: {
    commands?: Array<{
      name: string;
      description: string;
      options?: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean';
        description: string;
        alias?: string;
        required?: boolean;
        default?: string | number | boolean;
      }>;
    }>;
  };
};

/**
 * Parse error for manifest validation failures.
 */
export class ManifestParseError extends Error {
  /**
   * Create a new ManifestParseError.
   * @param message - Error message.
   * @param errors - Array of validation errors.
   */
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
    this.name = 'ManifestParseError';
  }
}

/**
 * Type guard to check if a value is a valid ModuleType.
 * @param value - Value to check.
 * @returns True if value is a valid ModuleType.
 */
const isModuleType = (value: unknown): value is ModulesType => {
  const validTypes: string[] = [
    ModulesType.CORE,
    ModulesType.SERVICE,
    ModulesType.DAEMON,
    ModulesType.PLUGIN,
    ModulesType.EXTENSION
  ];
  return typeof value === 'string' && validTypes.includes(value);
};

/**
 * Validate required string field.
 * @param data - Manifest data object.
 * @param fieldName - Name of the field to validate.
 * @param errors - Array to collect errors.
 */
const validateRequiredStringField = (
  data: Record<string, unknown>,
  fieldName: string,
  errors: string[],
): void => {
  const value = data[fieldName];
  if (value === null || value === undefined || typeof value !== 'string') {
    errors.push(`${fieldName}: required field missing or not a string`);
  }
};

/**
 * Validate optional string field.
 * @param data - Manifest data object.
 * @param fieldName - Name of the field to validate.
 * @param errors - Array to collect errors.
 */
const validateOptionalStringField = (
  data: Record<string, unknown>,
  fieldName: string,
  errors: string[],
): void => {
  const value = data[fieldName];
  if (value !== undefined && typeof value !== 'string') {
    errors.push(`${fieldName}: must be a string`);
  }
};

/**
 * Validate module type field.
 * @param data - Manifest data object.
 * @param errors - Array to collect errors.
 */
const validateModuleTypeField = (
  data: Record<string, unknown>,
  errors: string[],
): void => {
  const { type: typeValue } = data;
  if (typeValue === null || typeValue === undefined || typeof typeValue !== 'string') {
    errors.push('type: required field missing or not a string');
    return;
  }

  if (!isModuleType(typeValue)) {
    const validTypes = [
      ModulesType.CORE,
      ModulesType.SERVICE,
      ModulesType.DAEMON,
      ModulesType.PLUGIN,
      ModulesType.EXTENSION
    ];
    errors.push(
      `type: invalid value '${typeValue}', must be one of: ${validTypes.join(', ')}`,
    );
  }
};

/**
 * Validate dependencies field.
 * @param data - Manifest data object.
 * @param errors - Array to collect errors.
 */
const validateDependenciesField = (
  data: Record<string, unknown>,
  errors: string[],
): void => {
  const { dependencies: deps } = data;
  if (deps === undefined) {
    return;
  }

  if (!Array.isArray(deps)) {
    errors.push('dependencies: must be an array');
    return;
  }

  const isValidDeps = deps.every((dep): boolean => {
    return typeof dep === 'string';
  });
  if (!isValidDeps) {
    errors.push('dependencies: all items must be strings');
  }
};

/**
 * Validate object field (config or cli).
 * @param data - Manifest data object.
 * @param fieldName - Name of the field to validate.
 * @param errors - Array to collect errors.
 */
const validateObjectField = (
  data: Record<string, unknown>,
  fieldName: string,
  errors: string[],
): void => {
  const value = data[fieldName];
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${fieldName}: must be an object`);
  }
};

/**
 * Add optional string field to result.
 * @param result - Result object to modify.
 * @param data - Source data.
 * @param fieldName - Field name to check.
 */
const addOptionalStringField = <K extends keyof ModuleManifest>(
  result: ModuleManifest,
  data: Record<string, unknown>,
  fieldName: K,
): void => {
  const value = data[fieldName];
  if (typeof value === 'string') {
    (result as any)[fieldName] = value;
  }
};

/**
 * Build the result manifest from validated data.
 * @param data - Validated manifest data.
 * @returns Built manifest object.
 */
const buildManifestResult = (data: Record<string, unknown>): ModuleManifest => {
  const {
    name,
    version,
    type,
    dependencies,
    config,
    cli,
  } = data;
  const result: ModuleManifest = {
    name: String(name),
    version: String(version),
    type: String(type) as ModulesType,
  };

  addOptionalStringField(result, data, 'description');
  addOptionalStringField(result, data, 'author');

  if (dependencies !== undefined && Array.isArray(dependencies)) {
    result.dependencies = dependencies.map(String);
  }
  if (config !== undefined && typeof config === 'object' && config !== null && !Array.isArray(config)) {
    result.config = config as Record<string, unknown>;
  }
  if (cli !== undefined && typeof cli === 'object' && cli !== null && !Array.isArray(cli)) {
    result.cli = cli as NonNullable<ModuleManifest['cli']>;
  }

  return result;
};

/**
 * Validate and parse a raw manifest object.
 * @param raw - Raw parsed object.
 * @returns Validated ModuleManifest.
 * @throws ManifestParseError if validation fails.
 */
const validateManifest = (raw: unknown): ModuleManifest => {
  const errors: string[] = [];

  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ManifestParseError('Manifest must be an object', ['Invalid manifest format']);
  }

  const manifestData = raw as Record<string, unknown>;

  validateRequiredStringField(manifestData, 'name', errors);
  validateRequiredStringField(manifestData, 'version', errors);
  validateModuleTypeField(manifestData, errors);
  validateOptionalStringField(manifestData, 'description', errors);
  validateOptionalStringField(manifestData, 'author', errors);
  validateDependenciesField(manifestData, errors);
  validateObjectField(manifestData, 'config', errors);
  validateObjectField(manifestData, 'cli', errors);

  if (errors.length > 0) {
    throw new ManifestParseError(
      `Manifest validation failed with ${String(errors.length)} error(s)`,
      errors,
    );
  }

  return buildManifestResult(manifestData);
};

/**
 * Parse a YAML string into a validated ModuleManifest.
 * @param yamlContent - YAML content to parse.
 * @returns Validated ModuleManifest.
 * @throws ManifestParseError if parsing or validation fails.
 */
export const parseModuleManifest = (yamlContent: string): ModuleManifest => {
  try {
    const raw = parseYaml(yamlContent);
    return validateManifest(raw);
  } catch (error) {
    if (error instanceof ManifestParseError) {
      throw error;
    }
    throw new ManifestParseError('Failed to parse YAML content', [
      error instanceof Error ? error.message : String(error),
    ]);
  }
};

/**
 * Try to parse a module manifest, returning undefined on failure.
 * @param yamlContent - YAML content to parse.
 * @returns ModuleManifest or undefined.
 */
export const tryParseModuleManifest = (yamlContent: string): ModuleManifest | undefined => {
  try {
    return parseModuleManifest(yamlContent);
  } catch {
    return undefined;
  }
};

/**
 * Parse a module manifest with detailed error information.
 * @param yamlContent - YAML content to parse.
 * @returns Object with either manifest or errors.
 */
export const parseModuleManifestSafe = (yamlContent: string): {
  manifest?: ModuleManifest;
  errors?: string[];
} => {
  try {
    const manifest = parseModuleManifest(yamlContent);
    return { manifest };
  } catch (error) {
    if (error instanceof ManifestParseError) {
      return { errors: error.errors };
    }
    return {
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
};
