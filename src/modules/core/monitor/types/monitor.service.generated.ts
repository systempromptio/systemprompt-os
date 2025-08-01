// Auto-generated service schemas for monitor module
// Generated on: 2025-07-31T17:18:31.681Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';

// Zod schema for MonitorService
export const MonitorServiceSchema = z.object({
  setDependencies: z.function()
    .args(z.unknown(), z.unknown(), z.unknown())
    .returns(z.void()),
  recordMetric: z.function()
    .args(z.unknown())
    .returns(z.void()),
  incrementCounter: z.function()
    .args(z.unknown())
    .returns(z.void()),
  setGauge: z.function()
    .args(z.unknown())
    .returns(z.void()),
  recordHistogram: z.function()
    .args(z.unknown())
    .returns(z.void()),
  queryMetrics: z.function()
    .args(z.unknown())
    .returns(z.promise(z.unknown())),
  getMetricNames: z.function()
    .args()
    .returns(z.promise(z.array(z.string()))),
  getSystemMetrics: z.function()
    .args()
    .returns(z.promise(z.unknown())),
  cleanupOldMetrics: z.function()
    .args(z.number())
    .returns(z.promise(z.void())),
  shutdown: z.function()
    .args()
    .returns(z.promise(z.void())),
});

// Zod schema for IMonitorModuleExports
export const MonitorModuleExportsSchema = z.object({
  service: z.function().returns(MonitorServiceSchema)
});

// Zod schema for complete module
export const MonitorModuleSchema = createModuleSchema(MonitorModuleExportsSchema).extend({
  name: z.literal('monitor'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IMonitorService = z.infer<typeof MonitorServiceSchema>;
export type IMonitorModuleExports = z.infer<typeof MonitorModuleExportsSchema>;
