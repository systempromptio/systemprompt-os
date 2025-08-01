/**
 * Manual types for agents module.
 * @file Manual types for agents module.
 * @module agents/types/manual
 */

import type {
  IAgentCreateData,
  IAgentUpdateData
} from '@/modules/core/agents/types/agents.module.generated';

/**
 * Minimal DTO for agent creation input.
 * Extends IAgentCreateData with optional ID for repository operations.
 */
export interface CreateAgentInput extends IAgentCreateData {
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
  agentService: any; // AgentsService type
  identifier: string;
  format: unknown;
  cliOutput: any; // CliOutputService type
}
