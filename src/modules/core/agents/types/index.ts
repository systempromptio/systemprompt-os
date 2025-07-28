/**
 * Types for the Agents module.
 * Strongly typed exports interface for Agents module.
 * @file Types for the Agents module.
 * @module src/modules/core/agents/types
 */

import type { AgentService } from '@/modules/core/agents/services/agent.service';
import type { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';

/**
 * Strongly typed exports interface for Agents module.
 */
export interface IAgentsModuleExports {
  readonly service: () => AgentService;
  readonly repository: () => AgentRepository;
}
