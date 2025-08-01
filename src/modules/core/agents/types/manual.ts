/**
 * Manual types for agents module.
 * @file Manual types for agents module.
 * @module agents/types/manual
 */

import type {
  IAgentCreateData,
  IAgentUpdateData,
  IAgent as IBaseAgent
} from './agents.module.generated';

/**
 * Extended agent interface with capabilities, tools, and config.
 */
export interface IAgent extends IBaseAgent {
  capabilities?: string[];
  tools?: string[];
  config?: Record<string, unknown>;
}

/**
 * Extended agent creation data with optional fields for capabilities, tools, and config.
 */
export interface IAgentCreateDataExtended extends IAgentCreateData {
  capabilities?: string[];
  tools?: string[];
  config?: Record<string, unknown>;
}

/**
 * Extended agent update data with optional fields for capabilities, tools, and config.
 */
export interface IAgentUpdateDataExtended extends IAgentUpdateData {
  capabilities?: string[];
  tools?: string[];
  config?: Record<string, unknown>;
}

// Re-export the base IAgentUpdateData type
export type { IAgentUpdateData } from './agents.module.generated';

/**
 * Minimal DTO for agent creation input.
 * Extends IAgentCreateData with optional ID for repository operations.
 */
export interface CreateAgentInput extends IAgentCreateDataExtended {
    id?: string | undefined;
}

/**
 * Minimal DTO for agent update input.
 * Repository-specific interface for agent updates.
 */
export type UpdateAgentInput = IAgentUpdateData;

/**
 * Task priority levels.
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task status values.
 */
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Field validation interface for CLI validation helpers.
 */
export interface IFieldValidation {
  hasName: boolean;
  hasDescription: boolean;
  hasInstructions: boolean;
  hasType: boolean;
}

/**
 * CLI deletion context interface.
 */
export interface IDeletionContext {
  /** AgentsService instance for agent operations. */
  agentService: unknown;
  identifier: string;
  format: unknown;
  /** CliOutputService instance for CLI output. */
  cliOutput: unknown;
}
