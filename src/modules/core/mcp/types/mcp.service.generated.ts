// Auto-generated service schemas for mcp module
// Generated on: 2025-08-01T13:53:00.000Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';
import { McpContextsRowSchema } from './database.generated';

// Zod schema for MCPService
export const MCPServiceSchema = z.object({
  initialize: z.function()
    .args()
    .returns(z.promise(z.void())),
  createContext: z.function()
    .args(z.string(), z.string(), z.unknown().optional())
    .returns(z.promise(McpContextsRowSchema)),
  getContext: z.function()
    .args(z.string())
    .returns(z.promise(McpContextsRowSchema.nullable())),
  listContexts: z.function()
    .args()
    .returns(z.promise(z.array(McpContextsRowSchema))),
  deleteContext: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  createSession: z.function()
    .args(z.string(), z.unknown().optional())
    .returns(z.promise(z.any())),
  addMessage: z.function()
    .args(z.string(), z.unknown(), z.string(), z.unknown().optional())
    .returns(z.promise(z.any())),
  getSessionMessages: z.function()
    .args(z.string())
    .returns(z.promise(z.array(z.any()))),
});

// Standard schemas for MCP interfaces
export const ResourceModuleExportsSchema = z.object({
  listResources: z.function().returns(z.promise(z.array(z.unknown()))),
  getResource: z.function().args(z.string()).returns(z.promise(z.unknown().nullable())),
});

export const PromptModuleExportsSchema = z.object({
  listPrompts: z.function().returns(z.promise(z.array(z.unknown()))),
  getPrompt: z.function().args(z.string()).returns(z.promise(z.unknown().nullable())),
});

export const ToolModuleExportsSchema = z.object({
  listTools: z.function().returns(z.promise(z.array(z.unknown()))),
  getTool: z.function().args(z.string()).returns(z.promise(z.unknown().nullable())),
  executeTool: z.function().args(z.string(), z.unknown()).returns(z.promise(z.unknown())),
});

// Zod schema for IMCPModuleExports
export const MCPModuleExportsSchema = z.object({
  service: z.function().returns(z.unknown()),
  resources: ResourceModuleExportsSchema,
  prompts: PromptModuleExportsSchema,
  tools: ToolModuleExportsSchema,
});

// Zod schema for complete module
export const MCPModuleSchema = createModuleSchema(MCPModuleExportsSchema).extend({
  name: z.literal('mcp'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IMCPService = z.infer<typeof MCPServiceSchema>;
export type IMCPModuleExports = z.infer<typeof MCPModuleExportsSchema>;