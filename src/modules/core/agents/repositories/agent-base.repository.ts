/**
 * Base Agent Repository with core CRUD operations.
 * @file Base Agent Repository with core CRUD operations.
 * @module src/modules/core/agents/repositories/agent-base
 */

import type {
  AgentStatus,
  AgentType,
  IAgent,
  IAgentRow,
  TaskPriority,
  TaskStatus
} from '@/modules/core/agents/types/agent.types';
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
    const validTypes: readonly string[] = ['worker', 'monitor', 'coordinator'];
    if (validTypes.includes(type)) {
      return type as AgentType;
    }
    throw new Error(`Invalid agent type: ${type}`);
  }

  /**
   * Validates and returns agent status.
   * @param status - The agent status string to validate.
   * @returns The validated agent status.
   * @throws Error if the status is invalid.
   */
  protected validateAgentStatus(status: string): AgentStatus {
    const validStatuses: readonly string[] = ['idle', 'active', 'stopped', 'error'];
    if (validStatuses.includes(status)) {
      return status as AgentStatus;
    }
    throw new Error(`Invalid agent status: ${status}`);
  }

  /**
   * Validates and returns task priority.
   * @param priority - Priority string to validate.
   * @returns The validated task priority.
   * @throws Error if the priority is invalid.
   */
  protected validateTaskPriority(priority: string): TaskPriority {
    const validPriorities: readonly string[] = ['low', 'medium', 'high', 'critical'];
    if (validPriorities.includes(priority)) {
      return priority as TaskPriority;
    }
    throw new Error(`Invalid task priority: ${priority}`);
  }

  /**
   * Validates and returns task status.
   * @param status - Status string to validate.
   * @returns The validated task status.
   * @throws Error if the status is invalid.
   */
  protected validateTaskStatus(status: string): TaskStatus {
    const validStatuses: readonly string[] = [
      'pending', 'assigned', 'running', 'completed', 'failed', 'cancelled'
    ];
    if (validStatuses.includes(status)) {
      return status as TaskStatus;
    }
    throw new Error(`Invalid task status: ${status}`);
  }

  /**
   * Converts database row to agent object.
   * @param row - Database row data.
   * @returns Agent object.
   */
  protected rowToAgent(row: IAgentRow): IAgent {
    const agent: IAgent = {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      type: this.validateAgentType(row.type),
      status: this.validateAgentStatus(row.status),
      config: JSON.parse(row.config),
      capabilities: JSON.parse(row.capabilities),
      tools: JSON.parse(row.tools),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      assigned_tasks: row.assigned_tasks,
      completed_tasks: row.completed_tasks,
      failed_tasks: row.failed_tasks
    };

    return agent;
  }
}
