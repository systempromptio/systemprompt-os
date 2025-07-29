/**
 * Base Agent Repository with core CRUD operations.
 * @file Base Agent Repository with core CRUD operations.
 * @module src/modules/core/agents/repositories/agent-base
 */

import type {
  AgentStatus,
  AgentType,
  IAgent,
  TaskPriority,
  TaskStatus
} from '@/modules/core/agents/types/agent.types';
import type { IAgentsRow } from '@/modules/core/agents/types/database.generated';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { DatabaseServiceAdapter } from '@/modules/core/database/adapters/database-service-adapter';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

/**
 * Base repository class for agent-related database operations.
 * Contains core CRUD operations and validation methods.
 */
export abstract class AgentBaseRepository {
  protected readonly database: IDatabaseConnection;

  /**
   * Protected constructor for base repository.
   */
  protected constructor() {
    const databaseService = DatabaseService.getInstance();
    this.database = new DatabaseServiceAdapter(databaseService);
  }

  /**
   * Validates and returns agent type.
   * @param type - The agent type string to validate.
   * @returns The validated agent type.
   * @throws Error if the type is invalid.
   */
  protected validateAgentType(type: string): AgentType {
    switch (type) {
      case 'worker':
        return 'worker' as AgentType;
      case 'monitor':
        return 'monitor' as AgentType;
      case 'coordinator':
        return 'coordinator' as AgentType;
      default:
        throw new Error(`Invalid agent type: ${type}`);
    }
  }

  /**
   * Validates and returns agent status.
   * @param status - The agent status string to validate.
   * @returns The validated agent status.
   * @throws Error if the status is invalid.
   */
  protected validateAgentStatus(status: string): AgentStatus {
    switch (status) {
      case 'idle':
        return 'idle' as AgentStatus;
      case 'active':
        return 'active' as AgentStatus;
      case 'stopped':
        return 'stopped' as AgentStatus;
      case 'error':
        return 'error' as AgentStatus;
      default:
        throw new Error(`Invalid agent status: ${status}`);
    }
  }

  /**
   * Validates and returns task priority.
   * @param priority - Priority string to validate.
   * @returns The validated task priority.
   * @throws Error if the priority is invalid.
   */
  protected validateTaskPriority(priority: string): TaskPriority {
    switch (priority) {
      case 'low':
        return 'low' as TaskPriority;
      case 'medium':
        return 'medium' as TaskPriority;
      case 'high':
        return 'high' as TaskPriority;
      case 'critical':
        return 'critical' as TaskPriority;
      default:
        throw new Error(`Invalid task priority: ${priority}`);
    }
  }

  /**
   * Validates and returns task status.
   * @param status - Status string to validate.
   * @returns The validated task status.
   * @throws Error if the status is invalid.
   */
  protected validateTaskStatus(status: string): TaskStatus {
    switch (status) {
      case 'pending':
        return 'pending' as TaskStatus;
      case 'assigned':
        return 'assigned' as TaskStatus;
      case 'running':
        return 'running' as TaskStatus;
      case 'completed':
        return 'completed' as TaskStatus;
      case 'failed':
        return 'failed' as TaskStatus;
      case 'cancelled':
        return 'cancelled' as TaskStatus;
      default:
        throw new Error(`Invalid task status: ${status}`);
    }
  }

  /**
   * Converts database row to agent object.
   * @param row - Database row data.
   * @returns Agent object.
   */
  protected rowToAgent(row: unknown): IAgent {
    const agentRow = row as IAgentsRow;
    const agent: IAgent = {
      id: agentRow.id,
      name: agentRow.name,
      description: agentRow.description,
      instructions: agentRow.instructions,
      type: this.validateAgentType(agentRow.type),
      status: this.validateAgentStatus(agentRow.status),
      config: {},
      capabilities: [],
      tools: [],
      created_at: agentRow.created_at,
      updated_at: agentRow.updated_at,
      assigned_tasks: agentRow.assigned_tasks ?? 0,
      completed_tasks: agentRow.completed_tasks ?? 0,
      failed_tasks: agentRow.failed_tasks ?? 0
    };

    return agent;
  }
}
