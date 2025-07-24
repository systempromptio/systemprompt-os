/**
 * @file Type-safe manifest parser utilities.
 * @module modules/core/modules/utils/manifest-parser
 * @description Utilities for parsing and validating module manifests.
 */

import { parse as parseYaml } from 'yaml';
import type { ModuleManifest } from '@/modules/core/modules/types/index.js';
import { ModuleType } from '@/modules/core/modules/types/index.js';

/**
 * Parse error for manifest validation failures.
 */
export class ManifestParseError extends Error {
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
 * @param value
 */
function isModuleType(value: unknown): value is ModuleType {
  return typeof value === 'string' && Object.values(ModuleType).includes(value as ModuleType);
}

/**
 * Validate and parse a raw manifest object.
 * @param raw - Raw parsed object.
 * @returns Validated ModuleManifest.
 * @throws ManifestParseError if validation fails.
 */
function validateManifest(raw: unknown): ModuleManifest {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    throw new ManifestParseError('Manifest must be an object', ['Invalid manifest format']);
  }

  const manifestData = raw as Record<string, unknown>;

  if (!manifestData.name || typeof manifestData.name !== 'string') {
    errors.push('name: required field missing or not a string');
  }

  if (!manifestData.version || typeof manifestData.version !== 'string') {
    errors.push('version: required field missing or not a string');
  }

  if (!manifestData.type || typeof manifestData.type !== 'string') {
    errors.push('type: required field missing or not a string');
  } else if (!isModuleType(manifestData.type)) {
    errors.push(
      `type: invalid value '${manifestData.type}', must be one of: ${Object.values(ModuleType).join(', ')}`,
    );
  }

  if (manifestData.description !== undefined && typeof manifestData.description !== 'string') {
    errors.push('description: must be a string');
  }

  if (manifestData.author !== undefined && typeof manifestData.author !== 'string') {
    errors.push('author: must be a string');
  }

  if (manifestData.dependencies !== undefined) {
    if (!Array.isArray(manifestData.dependencies)) {
      errors.push('dependencies: must be an array');
    } else if (!manifestData.dependencies.every((dep) => { return typeof dep === 'string' })) {
      errors.push('dependencies: all items must be strings');
    }
  }

  if (
    manifestData.config !== undefined
    && (typeof manifestData.config !== 'object'
        || manifestData.config === null
        || Array.isArray(manifestData.config))
  ) {
    errors.push('config: must be an object');
  }

  if (
    manifestData.cli !== undefined
    && (typeof manifestData.cli !== 'object'
        || manifestData.cli === null
        || Array.isArray(manifestData.cli))
  ) {
    errors.push('cli: must be an object');
  }

  if (errors.length > 0) {
    throw new ManifestParseError(
      `Manifest validation failed with ${errors.length} error(s)`,
      errors,
    );
  }

  const result: ModuleManifest = {
    name: String(manifestData.name),
    version: String(manifestData.version),
    type: String(manifestData.type),
  };

  if (manifestData.description !== undefined) {
    result.description = String(manifestData.description);
  }
  if (manifestData.author !== undefined) {
    result.author = String(manifestData.author);
  }
  if (manifestData.dependencies !== undefined) {
    result.dependencies = manifestData.dependencies as string[];
  }
  if (manifestData.config !== undefined) {
    result.config = manifestData.config as Record<string, unknown>;
  }
  if (manifestData.cli !== undefined) {
    result.cli = manifestData.cli as { commands?: unknown[] };
  }

  return result;
}

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
