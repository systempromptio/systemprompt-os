// Auto-generated service schemas for agents module
// Generated on: 2025-08-01T14:00:03.508Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '../../modules/schemas/module.schemas';
import { ModulesType } from '../../modules/types/manual';
import { AgentSchema, AgentCreateDataSchema, AgentUpdateDataSchema } from './agents.module.generated';

// Zod schema for AgentsService
export const AgentsServiceSchema = z.object({
  reset: z.function()
    .args()
    .returns(z.promise(z.void())),
  createAgent: z.function()
    .args(AgentCreateDataSchema)
    .returns(z.promise(AgentSchema)),
  startAgent: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  stopAgent: z.function()
    .args(z.string(), z.unknown())
    .returns(z.promise(z.void())),
  updateAgentStatus: z.function()
    .args(z.string(), z.unknown())
    .returns(z.promise(AgentSchema)),
  reportAgentBusy: z.function()
    .args(z.string(), z.number())
    .returns(z.promise(z.void())),
  reportAgentIdle: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  startMonitoring: z.function()
    .args()
    .returns(z.promise(z.void())),
  stopMonitoring: z.function()
    .args()
    .returns(z.promise(z.void())),
  isHealthy: z.function()
    .args()
    .returns(z.boolean()),
  getAgentLogs: z.function()
    .args(z.string(), z.number())
    .returns(z.promise(z.array(z.unknown()))),
  updateAgent: z.function()
    .args(z.string(), AgentUpdateDataSchema)
    .returns(z.promise(AgentSchema.nullable())),
  deleteAgent: z.function()
    .args(z.string())
    .returns(z.promise(z.boolean())),
  listAgents: z.function()
    .args(z.string())
    .returns(z.promise(z.array(AgentSchema))),
  getAgent: z.function()
    .args(z.string())
    .returns(z.promise(AgentSchema.nullable())),
  getAvailableAgents: z.function()
    .args(z.string())
    .returns(z.promise(z.array(z.unknown()))),
});

// Zod schema for IAgentsModuleExports
export const AgentsModuleExportsSchema = z.object({
  service: z.function().returns(AgentsServiceSchema)
});

// Zod schema for complete module
export const AgentsModuleSchema = createModuleSchema(AgentsModuleExportsSchema).extend({
  name: z.literal('agents'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IAgentsService = z.infer<typeof AgentsServiceSchema>;
export type IAgentsModuleExports = z.infer<typeof AgentsModuleExportsSchema>;
