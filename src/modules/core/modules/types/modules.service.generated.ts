// Auto-generated service schemas for modules module
// Generated on: 2025-08-01T10:57:00.000Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';

// Zod schema for ModulesModuleService
export const ModulesModuleServiceSchema = z.object({
  name: z.string(),
  version: z.string(),
  type: z.nativeEnum(ModulesType),
  status: z.string(),
  initialize: z.function()
    .args()
    .returns(z.promise(z.void())),
  exports: z.unknown()
});

// Module exports schema for modules module
export const ModulesModuleExportsSchema = z.object({
  service: z.function()
    .args()
    .returns(z.unknown()),
  scanForModules: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  getEnabledModules: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  getModule: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  enableModule: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  disableModule: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  registerCoreModule: z.function()
    .args(z.string(), z.string(), z.array(z.string()).optional())
    .returns(z.promise(z.void())),
  loadCoreModule: z.function()
    .args(z.unknown())
    .returns(z.promise(z.unknown())),
  startCoreModule: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  getCoreModule: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  getAllCoreModules: z.function()
    .args()
    .returns(z.unknown()),
  registerPreLoadedModule: z.function()
    .args(z.string(), z.unknown())
    .returns(z.void()),
  getRegistry: z.function()
    .args()
    .returns(z.unknown()),
  getLoader: z.function()
    .args()
    .returns(z.unknown()),
  getManager: z.function()
    .args()
    .returns(z.unknown()),
  validateCoreModules: z.function()
    .args()
    .returns(z.promise(z.void()))
});

// Create module schema for modules module
export const ModulesModuleSchema = createModuleSchema(ModulesModuleExportsSchema);

// Export all interfaces for use by modules module
export type IModulesModuleService = z.infer<typeof ModulesModuleServiceSchema>;
export type IModulesModuleExports = z.infer<typeof ModulesModuleExportsSchema>;