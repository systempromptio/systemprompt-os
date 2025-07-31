/**
 * Manual type definitions for agents module.
 * ONLY contains types that cannot be auto-generated from database schema or service methods.
 * Each manual type must be justified with a comment explaining why it cannot be auto-generated.
 */

import type {
 AgentsStatus, AgentsType, IAgentsRow
} from '@/modules/core/agents/types/database.generated';

/**
 * DTO for creating a new agent.
 * JUSTIFICATION: DTOs are not stored in database and represent API contracts,
 * not database structures, so cannot be auto-generated from schema.
 */
export interface ICreateAgentDto {
  name: string;
  description: string;
  instructions: string;
  type: AgentsType;
  capabilities?: string[];
  tools?: string[];
  config?: Record<string, unknown>;
}

/**
 * DTO for updating an existing agent.
 * JUSTIFICATION: DTOs are not stored in database and represent API contracts,
 * not database structures, so cannot be auto-generated from schema.
 */
export interface IUpdateAgentDto {
  name?: string;
  description?: string;
  instructions?: string;
  type?: AgentsType;
  status?: AgentsStatus;
  capabilities?: string[];
  tools?: string[];
  config?: Record<string, unknown>;
}

/**
 * Extended agent interface with related data.
 * JUSTIFICATION: This interface combines data from multiple tables
 * and includes computed fields not stored in the database.
 */
export interface IAgent extends IAgentsRow {
  capabilities: string[];
  tools: string[];
  config: Record<string, unknown>;
}

/**
 * Module exports interface.
 * JUSTIFICATION: Module exports define the public API and cannot be
 * auto-generated from database schema as they reference service instances.
 */
export interface IAgentsModuleExports {
  service: () => import('../services/agents.service').AgentsService;
  repository: () => import('../repositories/agent.repository').AgentRepository;
}
