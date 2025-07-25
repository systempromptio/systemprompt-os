/**
 * Bootstrap types and interfaces.
 * @file Bootstrap types and interfaces.
 * @module types/bootstrap
 */

import type { ILogger } from '@/modules/core/logger/types/index.js';

/**
 * Bootstrap phase enumeration.
 */
export enum BootstrapPhaseEnum {
  CORE_MODULES = 'core_modules',
  MCP_SERVERS = 'mcp_servers',
  MODULE_DISCOVERY = 'module_discovery',
  READY = 'ready',
}

/**
 * Core module definition for bootstrap.
 */
export interface ICoreModuleDefinition {
  name: string;
  path: string;
  dependencies: string[];
  critical: boolean;
  description: string;
  type: 'self-contained' | 'injectable';
}

/**
 * Bootstrap options.
 */
export interface IBootstrapOptions {
  configPath?: string;
  statePath?: string;
  environment?: string;
  logger?: ILogger;
  skipMcp?: boolean;
  skipDiscovery?: boolean;
  cliMode?: boolean;
}

/**
 * Global configuration interface.
 */
export interface GlobalConfiguration {
  configPath: string;
  statePath: string;
  environment: string;
  modules: Record<string, unknown>;
}
