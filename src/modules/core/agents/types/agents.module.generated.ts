// Auto-generated Zod schemas for agents module
// Generated on: 2025-08-01T14:00:02.805Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { AgentsStatusSchema, AgentsTypeSchema, AgentsRowSchema } from './database.generated';

// Agent schema - directly use database row schema
export const AgentSchema = AgentsRowSchema;

export const AgentCreateDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  type: AgentsTypeSchema,
  status: AgentsStatusSchema,
  assigned_tasks: z.number().nullable(),
  completed_tasks: z.number().nullable(),
  failed_tasks: z.number().nullable(),
});

export const AgentUpdateDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  type: AgentsTypeSchema.optional(),
  status: AgentsStatusSchema.optional(),
  assigned_tasks: z.number().nullable().optional(),
  completed_tasks: z.number().nullable().optional(),
  failed_tasks: z.number().nullable().optional(),
});

// Type inference from schemas
export type Agent = z.infer<typeof AgentSchema>;
export type AgentCreateData = z.infer<typeof AgentCreateDataSchema>;
export type AgentUpdateData = z.infer<typeof AgentUpdateDataSchema>;

// Domain type aliases for easier imports
export type IAgent = Agent;
export type IAgentCreateData = AgentCreateData;
export type IAgentUpdateData = AgentUpdateData;
