/**
 * Manual type definitions for the modules module.
 * Contains all non-generated types that are manually defined.
 * @file Manual types for modules module.
 * @module modules/types/manual
 */

import { z } from 'zod';
import type { ICoreModuleDefinition } from '@/types/bootstrap';
import type { ModuleRegistryService } from '@/modules/core/modules/services/module-registry.service';
import type { ModuleLoaderService } from '@/modules/core/modules/services/module-loader.service';
import type { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';

// Import types we need to use in this file
import type {
  IModulesRow,
  ModulesType
} from '@/modules/core/modules/types/database.generated';

/*
 * ============================================================================
 * Database Generated Types Re-exports
 * ============================================================================
 */

// Re-export database types
export type {
  IModulesRow,
  IModuleEventsRow,
  ModulesDatabaseRow
} from '@/modules/core/modules/types/database.generated';

export {
  ModulesType,
  ModulesHealthStatus,
  ModuleEventsEventType,
  ModulesTypeSchema,
  ModulesHealthStatusSchema,
  ModuleEventsEventTypeSchema,
  ModulesRowSchema,
  ModuleEventsRowSchema,
  ModulesDatabaseRowSchema,
  MODULES_TABLES
} from '@/modules/core/modules/types/database.generated';

/*
 * ============================================================================
 * Module Generated Types Re-exports
 * ============================================================================
 */

// Re-export module service types (when available)
export type * from '@/modules/core/modules/types/modules.module.generated';

/*
 * ============================================================================
 * Core Runtime Types (defined here - cannot be generated)
 * ============================================================================
 */

/**
 * Module status enum - represents the current state of a module
 * This cannot be generated from database because it includes runtime states
 * not stored in database.
 */
export enum ModulesStatus {
  PENDING = 'pending',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  INSTALLED = 'installed',
  LOADING = 'loading'
}

/**
 * Health status for modules.
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  checks?: Record<string, unknown>;
  message?: string;
}

/**
 * Runtime module instance interface.
 * This represents an actual loaded module in memory, not the database metadata.
 * Cannot be generated because it includes runtime behavior and lifecycle methods.
 */
export interface IModule<TExports = unknown> {
  // Identity
  readonly name: string;
  readonly version: string;
  readonly type: ModulesType;
  readonly dependencies?: readonly string[];

  // State
  status: ModulesStatus;
  readonly exports: TExports;

  // Lifecycle methods
  initialize(): Promise<void>; // Required: one-time setup
  start?(): Promise<void>; // Optional: begin operations (REQUIRED for critical modules)
  stop?(): Promise<void>; // Optional: cleanup resources
  health?(): Promise<HealthStatus>; // Optional: health check
}

/*
 * ============================================================================
 * Module Loader Types (cannot be generated - runtime specific)
 * ============================================================================
 */

/**
 * Module context for initialization.
 */
export interface IModuleContext {
  config: Record<string, unknown>;
  logger: any; // Avoid circular dependency
  [key: string]: unknown;
}

/**
 * Module configuration for loading.
 */
export interface IModuleConfiguration {
  enabled: boolean;
  autoStart?: boolean;
  config?: Record<string, unknown>;
  dependencies?: string[];
}

/**
 * Module exports from dynamic imports.
 */
export interface ModuleExports {
  createModule?: () => IModule;
  default?: IModule | (() => IModule);
  [key: string]: any;
}

/*
 * ============================================================================
 * Module Scanner Types (cannot be generated - business logic specific)
 * ============================================================================
 */

/**
 * Scanned module interface - pre-database module representation.
 * Uses partial database row to avoid duplication.
 */
export type IScannedModule = Pick<IModulesRow, 'name' | 'version' | 'type' | 'path'> & {
  dependencies?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/**
 * Module scan options.
 */
export interface IModuleScanOptions {
  paths?: string[];
  includeDisabled?: boolean;
  deep?: boolean;
}

/**
 * Module scanner service interface.
 */
export interface IModuleScannerService {
  scan(options: IModuleScanOptions): Promise<IScannedModule[]>;
  getEnabledModules(): Promise<IModulesRow[]>;
  updateModuleStatus(name: string, status: string, error?: string): Promise<void>;
  setModuleEnabled(name: string, enabled: boolean): Promise<void>;
  updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void>;
  getModule(name: string): Promise<IModulesRow | undefined>;
  getRegisteredModules(): Promise<IModulesRow[]>;
}

/*
 * ============================================================================
 * Module Exports Types (cannot be generated - business logic specific)
 * ============================================================================
 */

/**
 * Strongly typed exports interface for Modules module.
 */
export interface IModulesModuleExports {
  readonly service: () => IModuleScannerService | undefined;
  readonly scanForModules: () => Promise<IScannedModule[]>;
  readonly getEnabledModules: () => Promise<IModulesRow[]>;
  readonly getModule: (name: string) => Promise<IModulesRow | undefined>;
  readonly enableModule: (name: string) => Promise<void>;
  readonly disableModule: (name: string) => Promise<void>;
  readonly registerCoreModule: (
    name: string,
    path: string,
    dependencies?: string[],
  ) => Promise<void>;
  // Core module loading methods
  readonly loadCoreModule: (definition: ICoreModuleDefinition) => Promise<IModule>;
  readonly startCoreModule: (name: string) => Promise<void>;
  readonly getCoreModule: (name: string) => Promise<IModule | undefined>;
  readonly getAllCoreModules: () => Map<string, IModule>;
  readonly registerPreLoadedModule: (name: string, module: IModule) => void;
  // Service access methods
  readonly getRegistry: () => ModuleRegistryService | undefined;
  readonly getLoader: () => ModuleLoaderService | undefined;
  readonly getManager: () => ModuleManagerService | undefined;
  // Database validation method
  readonly validateCoreModules: () => Promise<void>;
}

/*
 * ============================================================================
 * Zod Schemas
 * ============================================================================
 */

// Create Zod schema for ModulesStatus
export const ModulesStatusSchema = z.nativeEnum(ModulesStatus);

// Re-export Zod schemas for runtime validation
export {
  BaseModuleSchema,
  createModuleSchema
} from '@/modules/core/modules/schemas/module.schemas';

/*
 * ============================================================================
 * Base Module Class
 * ============================================================================
 */

// Re-export base module class
export {
  BaseModule,
  createValidatedModule
} from '@/modules/core/modules/base/BaseModule';
