/**
 * @file Type-safe manifest parser utilities.
 * @module modules/core/modules/utils/manifest-parser
 */

import { parse as parseYaml } from 'yaml';
import type { ModuleManifest} from '@/modules/core/modules/types/index.js';
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

  // Check if raw is an object
  if (!raw || typeof raw !== 'object') {
    throw new ManifestParseError('Manifest must be an object', ['Invalid manifest format']);
  }

  const obj = raw as Record<string, unknown>;

  // Validate required fields
  if (!obj['name'] || typeof obj['name'] !== 'string') {
    errors.push('name: required field missing or not a string');
  }

  if (!obj['version'] || typeof obj['version'] !== 'string') {
    errors.push('version: required field missing or not a string');
  }

  if (!obj['type'] || typeof obj['type'] !== 'string') {
    errors.push('type: required field missing or not a string');
  } else if (!isModuleType(obj['type'])) {
    errors.push(
      `type: invalid value '${obj['type']}', must be one of: ${Object.values(ModuleType).join(', ')}`,
    );
  }

  // Validate optional fields
  if (obj['description'] !== undefined && typeof obj['description'] !== 'string') {
    errors.push('description: must be a string');
  }

  if (obj['author'] !== undefined && typeof obj['author'] !== 'string') {
    errors.push('author: must be a string');
  }

  if (obj['dependencies'] !== undefined) {
    if (!Array.isArray(obj['dependencies'])) {
      errors.push('dependencies: must be an array');
    } else if (!obj['dependencies'].every((dep) => { return typeof dep === 'string' })) {
      errors.push('dependencies: all items must be strings');
    }
  }

  if (
    obj['config'] !== undefined
    && (typeof obj['config'] !== 'object' || obj['config'] === null || Array.isArray(obj['config']))
  ) {
    errors.push('config: must be an object');
  }

  if (
    obj['cli'] !== undefined
    && (typeof obj['cli'] !== 'object' || obj['cli'] === null || Array.isArray(obj['cli']))
  ) {
    errors.push('cli: must be an object');
  }

  // If there are errors, throw
  if (errors.length > 0) {
    throw new ManifestParseError(
      `Manifest validation failed with ${errors.length} error(s)`,
      errors,
    );
  }

  // Return validated manifest
  const manifest: ModuleManifest = {
    name: obj['name'] as string,
    version: obj['version'] as string,
    type: obj['type'] as string,
  };

  if (obj['description']) { manifest.description = obj['description'] as string; }
  if (obj['author']) { manifest.author = obj['author'] as string; }
  if (obj['dependencies']) { manifest.dependencies = obj['dependencies'] as string[]; }
  if (obj['config']) { manifest.config = obj['config'] as Record<string, any>; }
  if (obj['cli']) { manifest.cli = obj['cli'] as { commands?: any[] }; }

  return manifest;
}

/**
 * Parse a YAML string into a validated ModuleManifest.
 * @param yamlContent - YAML content to parse.
 * @returns Validated ModuleManifest.
 * @throws ManifestParseError if parsing or validation fails.
 */
export function parseModuleManifest(yamlContent: string): ModuleManifest {
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
}

/**
 * Try to parse a module manifest, returning undefined on failure.
 * @param yamlContent - YAML content to parse.
 * @returns ModuleManifest or undefined.
 */
export function tryParseModuleManifest(yamlContent: string): ModuleManifest | undefined {
  try {
    return parseModuleManifest(yamlContent);
  } catch {
    return undefined;
  }
}

/**
 * Parse a module manifest with detailed error information.
 * @param yamlContent - YAML content to parse.
 * @returns Object with either manifest or errors.
 */
export function parseModuleManifestSafe(yamlContent: string): {
  manifest?: ModuleManifest;
  errors?: string[];
} {
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
}
