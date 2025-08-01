/**
 * Core module runtime types.
 * Database types are in database.generated.ts.
 */

import type { ModulesStatus, ModulesType } from '@/modules/core/modules/types/database.generated';

// Re-export the enums so they can be used as values
export { ModulesStatus, ModulesType } from '@/modules/core/modules/types/database.generated';

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

// Re-export Zod schemas for runtime validation
export {
 BaseModuleSchema, createModuleSchema, ModulesStatusSchema, ModulesTypeSchema
} from '@/modules/core/modules/schemas/module.schemas';

// Re-export base module class
export { BaseModule, createValidatedModule } from '@/modules/core/modules/base/BaseModule';
