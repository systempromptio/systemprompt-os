// Auto-generated service schemas for logger module
// Generated on: 2025-07-31T13:04:44.420Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';

// Zod schema for LoggerService
export const LoggerServiceSchema = z.object({
  resetInstance: z.function()
    .args()
    .returns(z.void()),
  setDatabaseService: z.function()
    .args(z.unknown())
    .returns(z.void()),
  debug: z.function()
    .args(z.unknown(), z.string(), z.unknown())
    .returns(z.void()),
  info: z.function()
    .args(z.unknown(), z.string(), z.unknown())
    .returns(z.void()),
  warn: z.function()
    .args(z.unknown(), z.string(), z.unknown())
    .returns(z.void()),
  error: z.function()
    .args(z.unknown(), z.string(), z.unknown())
    .returns(z.void()),
  log: z.function()
    .args(z.unknown(), z.unknown(), z.string(), z.unknown())
    .returns(z.void()),
  access: z.function()
    .args(z.string())
    .returns(z.void()),
  clearLogs: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  getLogs: z.function()
    .args(z.string())
    .returns(z.promise(z.array(z.string()))),
});

// Zod schema for ILoggerModuleExports
export const LoggerModuleExportsSchema = z.object({
  service: z.function().returns(LoggerServiceSchema)
});

// Zod schema for complete module
export const LoggerModuleSchema = createModuleSchema(LoggerModuleExportsSchema).extend({
  name: z.literal('logger'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type ILoggerService = z.infer<typeof LoggerServiceSchema>;
export type ILoggerModuleExports = z.infer<typeof LoggerModuleExportsSchema>;
