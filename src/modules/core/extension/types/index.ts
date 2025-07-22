/**
 * @fileoverview Extension module types
 * @module modules/core/extension/types
 */

/**
 * Extension types
 */
export type ExtensionType = 'module' | 'server';

/**
 * Module types supported by the system
 */
export type ModuleType = 'service' | 'daemon' | 'plugin' | 'core' | 'extension';

/**
 * Extension configuration from YAML files
 */
export interface ExtensionConfig {
  name: string;
  type: ModuleType;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  config?: Record<string, unknown>;
  cli?: {
    commands: CLICommand[];
  };
}

/**
 * CLI command definition
 */
export interface CLICommand {
  name: string;
  description: string;
  options?: CLIOption[];
}

/**
 * CLI option definition
 */
export interface CLIOption {
  name: string;
  alias?: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  default?: string | number | boolean;
}

/**
 * Runtime extension information
 */
export interface ExtensionInfo {
  name: string;
  type: ExtensionType;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  path: string;
  config?: Record<string, unknown>;
}

/**
 * Extension validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Extension installation options
 */
export interface InstallOptions {
  version?: string;
  force?: boolean;
  registry?: string;
  path?: string;
}

/**
 * Extension removal options
 */
export interface RemovalOptions {
  preserveConfig?: boolean;
  force?: boolean;
}

/**
 * Extension discovery options
 */
export interface DiscoveryOptions {
  paths?: string[];
  types?: ExtensionType[];
  includeDisabled?: boolean;
}

/**
 * Extension module configuration
 */
export interface ExtensionModuleConfig {
  modulesPath: string;
  extensionsPath: string;
  registryUrl?: string;
  autoDiscover?: boolean;
  discoveryPaths?: string[];
}

/**
 * Extension registry response
 */
export interface RegistryExtension {
  name: string;
  version: string;
  description: string;
  author: string;
  type: ExtensionType;
  downloads: number;
  lastUpdated: string;
  tags?: string[];
}

/**
 * Extension search criteria
 */
export interface SearchCriteria {
  query?: string;
  type?: ExtensionType;
  tags?: string[];
  author?: string;
  limit?: number;
  offset?: number;
}