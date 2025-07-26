/**
 * Type definitions for strongly typed module getters.
 * @file Module getter type definitions.
 * @module modules/types/module-getters
 */

import type { IModuleInstance } from '@/modules/types/loader.types';
import type { IMCPModuleExports } from '@/modules/core/mcp/index';

/**
 * Generic typed module getter that guarantees module availability.
 */
export type TypedModuleGetter<T> = () => IModuleInstance & { exports: T };

/**
 * Specific typed getters for known modules.
 */
export interface IModuleGetters {
  getMCPModule: () => IModuleInstance & { exports: IMCPModuleExports };
}
