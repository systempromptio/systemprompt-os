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
  /** Optional agent ID for specific scenarios */
  id?: string | undefined;
}

/**
 * Minimal DTO for agent update input.
 * Repository-specific interface for agent updates.
 */
export interface UpdateAgentInput extends IAgentUpdateData {
  /** Additional repository-specific fields if needed */
}