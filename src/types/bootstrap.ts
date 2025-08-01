/**
 * Bootstrap types and interfaces.
 * @file Bootstrap types and interfaces.
 * @module types/bootstrap
 */

import type { Express } from 'express';
import type { IModulesModuleExports } from "@/modules/core/modules/types/modules-exports.types";
import type { ICLIModuleExports } from '@/modules/core/cli/index';
import type { IModule } from '@/modules/core/modules/types/index';
import type { IDatabaseModuleExports } from '@/modules/core/database/types/database-module.types';
import type { ILoggerModuleExports } from '@/modules/core/logger/types/logger-module.types';
import type { ILogger } from '@/modules/core/logger/types/index';

/**
 * Module exports interface for the modules service.
 */
export interface IModuleExports {
  registerPreLoadedModule: (name: string, mod: CoreModuleType) => void;
  loadCoreModule: (definition: ICoreModuleDefinition) => Promise<CoreModuleType>;
  initializeCoreModule: (name: string) => Promise<void>;
  startCoreModule: (name: string) => Promise<void>;
}

/**
 * Module import result interface for dynamic imports.
 */
export interface IModuleImportResult {
  createModule?: () => IModule;
  default?: new () => IModule;
}

/**
 * Bootstrap phase enumeration.
 */
export enum BootstrapPhaseEnum {
  INIT = 'init',
  CORE_MODULES = 'core_modules',
  HTTP_SERVER = 'http_server',
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
 * HTTP server phase context.
 * Context passed to the HTTP server bootstrap phase.
 */
export interface HttpServerPhaseContext {
  mcpApp?: Express;
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
  | 'http'
  | 'cli'
  | 'error'
  | 'logger'
  | 'debug';

/**
 * Context for module registration phase.
 */
export interface ModuleRegistrationPhaseContext {
  modules: Map<string, CoreModuleType>;
  coreModules: ICoreModuleDefinition[];
}

/**
 * Context for the core modules phase.
 */
export interface CoreModulesPhaseContext {
  modules: Map<string, CoreModuleType>;
  coreModules: ICoreModuleDefinition[];
  isCliMode: boolean;
}

/**
 * Parameters for loading a core module.
 */
export type CoreModuleLoadParams = {
  name: string;
  definition: ICoreModuleDefinition;
  modules: Map<string, CoreModuleType>;
};

/**
 * Parameters for initializing a core module.
 */
export type CoreModuleInitParams = {
  name: string;
  modules: Map<string, CoreModuleType>;
  isCliMode: boolean;
};

/**
 * Parameters for starting a core module.
 */
export type CoreModuleStartParams = {
  name: string;
  modules: Map<string, CoreModuleType>;
};

/**
 * Context for module discovery phase.
 */
export interface ModuleDiscoveryPhaseContext {
  modules: Map<string, CoreModuleType>;
  config: GlobalConfiguration;
}
