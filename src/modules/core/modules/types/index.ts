/**
 * Core module runtime types.
 * Database types are in database.generated.ts.
 */

import type { ModulesStatus, ModulesType } from '@/modules/core/modules/types/database.generated';

// Re-export the enums so they can be used as values
export { ModulesStatus, ModulesType } from '@/modules/core/modules/types/database.generated';

/**
 * Runtime module instance interface.
 * This represents an actual loaded module in memory, not the database metadata.
 */
export interface IModule<TExports = unknown> {
  readonly name: string;
  readonly version: string;
  readonly type: ModulesType;
  readonly dependencies?: readonly string[];
  status: ModulesStatus;
  readonly exports: TExports;
  initialize(): Promise<void>;
}

// Re-export Zod schemas for runtime validation
export { BaseModuleSchema, createModuleSchema, ModulesStatusSchema, ModulesTypeSchema } from '@/modules/core/modules/schemas/module.schemas';

// Re-export base module class
export { BaseModule, createValidatedModule } from '@/modules/core/modules/base/BaseModule';
