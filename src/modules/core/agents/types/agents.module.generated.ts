// Auto-generated Zod schemas for agents module
// Generated on: 2025-07-31T14:35:01.009Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { AgentsStatusSchema, AgentsRowSchema } from './database.generated';

// Extended Agent schema with additional properties
export const AgentSchema = AgentsRowSchema.extend({
  capabilities: z.array(z.string()),
  tools: z.array(z.string()),
  config: z.record(z.unknown())
});

export const AgentCreateDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  type: z.unknown(),
  capabilities: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

export const AgentUpdateDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  type: z.unknown().optional(),
  status: AgentsStatusSchema.optional(),
  capabilities: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

// Type inference from schemas
export type Agent = z.infer<typeof AgentSchema>;
export type AgentCreateData = z.infer<typeof AgentCreateDataSchema>;
export type AgentUpdateData = z.infer<typeof AgentUpdateDataSchema>;

// Domain type aliases for easier imports
export type IAgent = Agent;
export type IAgentCreateData = AgentCreateData;
export type IAgentUpdateData = AgentUpdateData;
