// Auto-generated service schemas for cli module
// Generated on: 2025-07-31T11:41:33.118Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';
import { CliSchema, CliCreateDataSchema, CliUpdateDataSchema } from './cli.module.generated';

// Zod schema for CliService
export const CliServiceSchema = z.object({
  isInitialized: z.function()
    .args()
    .returns(z.boolean()),
  getAllCommands: z.function()
    .args()
    .returns(z.promise(z.unknown())),
  getCommandMetadata: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  getCommandHelp: z.function()
    .args(z.string(), z.unknown())
    .returns(z.string()),
  formatCommands: z.function()
    .args(z.unknown(), z.unknown())
    .returns(z.string()),
  generateDocs: z.function()
    .args(z.unknown(), z.string())
    .returns(z.string()),
  registerCommand: z.function()
    .args(z.unknown(), z.string(), z.string())
    .returns(z.promise(z.void())),
  getCommandsFromDatabase: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  parseModuleYaml: z.function()
    .args(z.string())
    .returns(z.unknown()),
  clearAllCommands: z.function()
    .args()
    .returns(z.promise(z.void())),
  scanAndRegisterModuleCommands: z.function()
    .args(z.unknown())
    .returns(z.promise(z.void())),
});

// Zod schema for ICliModuleExports
export const CliModuleExportsSchema = z.object({
  service: z.function().returns(CliServiceSchema)
});

// Zod schema for complete module
export const CliModuleSchema = createModuleSchema(CliModuleExportsSchema).extend({
  name: z.literal('cli'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type ICliService = z.infer<typeof CliServiceSchema>;
export type ICliModuleExports = z.infer<typeof CliModuleExportsSchema>;
