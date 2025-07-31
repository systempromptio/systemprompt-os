/**
 * Zod schemas for IModule interface validation.
 * @file Generic Zod schemas for module validation.
 * @module modules/schemas
 */

import { z } from 'zod';
import { ModulesStatus, ModulesType } from '@/modules/core/modules/types/index';

/**
 * Schema for ModulesStatus enum.
 */
export const ModulesStatusSchema = z.nativeEnum(ModulesStatus);

/**
 * Schema for ModulesType enum.
 */
export const ModulesTypeSchema = z.nativeEnum(ModulesType);

/**
 * Generic schema for IModule<T> interface
 * This validates the basic structure that all modules must implement.
 * @param exportsSchema
 */
export const createModuleSchema = <T extends z.ZodTypeAny>(exportsSchema: T) => { return z.object({
  name: z.string(),
  version: z.string(),
  type: ModulesTypeSchema,
  dependencies: z.array(z.string()).readonly()
.optional(),
  status: ModulesStatusSchema,
  exports: exportsSchema,
  initialize: z.function().returns(z.promise(z.void()))
}) };

/**
 * Base module schema without specific exports validation.
 */
export const BaseModuleSchema = createModuleSchema(z.unknown());

/**
 * Type inference for module schema.
 */
export type ModuleSchema<T extends z.ZodTypeAny> = z.infer<ReturnType<typeof createModuleSchema<T>>>;
