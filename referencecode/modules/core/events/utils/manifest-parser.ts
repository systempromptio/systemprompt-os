/**
 * @fileoverview Module manifest parser utility
 * @module modules/core/events/utils/manifest-parser
 */

import { parse as parseYaml } from 'yaml';

/**
 * Module manifest structure
 */
export interface ModuleManifest {
  name: string;
  version: string;
  type: string;
  description?: string;
  author?: string;
  dependencies?: readonly string[];
  config?: Record<string, unknown>;
  cli?: {
    commands: ReadonlyArray<{
      name: string;
      handler: string;
    }>;
  };
}

/**
 * Parse result for module manifests
 */
export interface ParseResult {
  manifest?: ModuleManifest;
  errors?: readonly string[];
}

/**
 * Safely parse a module manifest from YAML content
 * @param content The YAML content to parse
 * @returns ParseResult with manifest or errors
 */
export function parseModuleManifestSafe(content: string): ParseResult {
  try {
    const rawManifest = parseYaml(content);

    if (!rawManifest || typeof rawManifest !== 'object') {
      return { errors: ['Invalid YAML: not an object'] };
    }

    const errors: string[] = [];

    if (!rawManifest.name || typeof rawManifest.name !== 'string') {
      errors.push('Missing or invalid name field');
    }

    if (!rawManifest.version || typeof rawManifest.version !== 'string') {
      errors.push('Missing or invalid version field');
    }

    if (!rawManifest.type || typeof rawManifest.type !== 'string') {
      errors.push('Missing or invalid type field');
    }

    if (errors.length > 0) {
      return { errors };
    }

    return { manifest: rawManifest as ModuleManifest };
  } catch (error) {
    return {
      errors: [`YAML parse error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
