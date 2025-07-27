/**
 * Bootstrap types and interfaces.
 * @file Bootstrap types and interfaces.
 * @module types/bootstrap
 */

import type { ILogger } from '@/modules/core/logger/types/index';
import type { IModulesModuleExports } from '@/modules/core/modules/types/index';
import type { ICLIModuleExports } from '@/modules/core/cli/index';
import type { IModule } from '@/modules/core/modules/types/index';
import type { IDatabaseModuleExports } from '@/modules/core/database/types/database-module.types';
import type { ILoggerModuleExports } from '@/modules/core/logger/types/logger-module.types';

/**
 * Bootstrap phase enumeration.
 */
export enum BootstrapPhaseEnum {
  INIT = 'init',
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

/**
 * Type definition for core module types.
 */
export type CoreModuleType =
  | IModule<IModulesModuleExports>
  | IModule<ICLIModuleExports>
  | IModule<IDatabaseModuleExports>
  | IModule<ILoggerModuleExports>
  | IModule;

/**
 * Log category types for bootstrap operations.
 */
export type LogCategory =
  | 'startup'
  | 'shutdown'
  | 'modules'
  | 'database'
  | 'discovery'
  | 'mcp'
  | 'cli'
  | 'error'
  | 'logger'
  | 'debug';
