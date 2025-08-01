// Auto-generated service schemas for system module
// Generated on: 2025-07-31T13:04:45.444Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';

// Zod schema for SystemService
export const SystemServiceSchema = z.object({
  getConfig: z.function()
    .args(z.string())
    .returns(z.promise(z.string().nullable())),
  getAllConfigs: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  setConfig: z.function()
    .args(z.string(), z.string(), z.unknown(), z.string())
    .returns(z.promise(z.void())),
  deleteConfig: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  registerModule: z.function()
    .args(z.string(), z.string())
    .returns(z.promise(z.unknown())),
  updateModuleStatus: z.function()
    .args(z.string(), z.unknown())
    .returns(z.promise(z.void())),
  getAllModules: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  setModuleMetadata: z.function()
    .args(z.string(), z.unknown())
    .returns(z.promise(z.void())),
  getModuleMetadata: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  getSystemInfo: z.function()
    .args()
    .returns(z.promise(z.unknown())),
  checkHealth: z.function()
    .args()
    .returns(z.promise(z.unknown())),
  logEvent: z.function()
    .args(z.string(), z.string(), z.unknown(), z.string(), z.unknown())
    .returns(z.promise(z.void())),
  getRecentEvents: z.function()
    .args(z.number(), z.unknown())
    .returns(z.promise(z.unknown())),
  startMaintenance: z.function()
    .args(z.unknown(), z.string(), z.string(), z.string())
    .returns(z.promise(z.unknown())),
  endMaintenance: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  getMaintenanceHistory: z.function()
    .args(z.number())
    .returns(z.promise(z.array(z.unknown()))),
  cleanupOldEvents: z.function()
    .args(z.number())
    .returns(z.promise(z.number())),
});

// Zod schema for ISystemModuleExports
export const SystemModuleExportsSchema = z.object({
  service: z.function().returns(SystemServiceSchema)
});

// Zod schema for complete module
export const SystemModuleSchema = createModuleSchema(SystemModuleExportsSchema).extend({
  name: z.literal('system'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type ISystemService = z.infer<typeof SystemServiceSchema>;
export type ISystemModuleExports = z.infer<typeof SystemModuleExportsSchema>;
