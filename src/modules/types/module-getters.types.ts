/**
 * Type definitions for strongly typed module getters.
 * @file Module getter type definitions.
 * @module modules/types/module-getters
 */

import type { IModule } from '@/modules/core/modules/types/manual';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/index';

/**
 * Generic typed module getter that guarantees module availability.
 * @template T - The type of module exports.
 * @returns A function that returns a module with typed exports.
 */
export type TypedModuleGetter<T> = () => IModule<T>;

/**
 * Specific typed getters for known modules.
 * Provides type-safe access to core modules with their specific export types.
 */
export interface IModuleGetters {
    getMCPModule: () => IModule<IMCPModuleExports>;
}
