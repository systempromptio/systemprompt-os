/**
 * Base Agent Repository with core CRUD operations.
 * @file Base Agent Repository with core CRUD operations.
 * @module src/modules/core/agents/repositories/agent-base
 */

import type { IAgent } from '@/modules/core/agents/types/agents.module.generated';
import type {
  AgentsStatus,
  AgentsType,
  IAgentsRow
} from '@/modules/core/agents/types/database.generated';
import type { TaskPriority, TaskStatus } from '@/modules/core/agents/types/manual';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { DatabaseServiceAdapter } from '@/modules/core/database/adapters/database-service-adapter';
import type { IDatabaseConnection } from '@/modules/core/database/types/manual';

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
  protected validateAgentType(type: string): AgentsType {
    const validTypes: Record<string, AgentsType> = {
      worker: 'worker' as AgentsType,
      monitor: 'monitor' as AgentsType,
      coordinator: 'coordinator' as AgentsType
    };

    const validatedType = validTypes[type];
    if (!validatedType) {
      throw new Error(`Invalid agent type: ${type}`);
    }
    return validatedType;
  }

  /**
   * Validates and returns agent status.
   * @param status - The agent status string to validate.
   * @returns The validated agent status.
   * @throws Error if the status is invalid.
   */
  protected validateAgentStatus(status: string): AgentsStatus {
    const validStatuses: Record<string, AgentsStatus> = {
      idle: 'idle' as AgentsStatus,
      active: 'active' as AgentsStatus,
      stopped: 'stopped' as AgentsStatus,
      error: 'error' as AgentsStatus
    };

    const validatedStatus = validStatuses[status];
    if (!validatedStatus) {
      throw new Error(`Invalid agent status: ${status}`);
    }
    return validatedStatus;
  }

  /**
   * Validates and returns task priority.
   * @param priority - Priority string to validate.
   * @returns The validated task priority.
   * @throws Error if the priority is invalid.
   */
  protected validateTaskPriority(priority: string): TaskPriority {
    const validPriorities: Record<string, TaskPriority> = {
      low: 'low' as TaskPriority,
      medium: 'medium' as TaskPriority,
      high: 'high' as TaskPriority,
      critical: 'critical' as TaskPriority
    };

    const validatedPriority = validPriorities[priority];
    if (!validatedPriority) {
      throw new Error(`Invalid task priority: ${priority}`);
    }
    return validatedPriority;
  }

  /**
   * Validates and returns task status.
   * @param status - Status string to validate.
   * @returns The validated task status.
   * @throws Error if the status is invalid.
   */
  protected validateTaskStatus(status: string): TaskStatus {
    const validStatuses: Record<string, TaskStatus> = {
      pending: 'pending' as TaskStatus,
      assigned: 'assigned' as TaskStatus,
      running: 'running' as TaskStatus,
      completed: 'completed' as TaskStatus,
      failed: 'failed' as TaskStatus,
      cancelled: 'cancelled' as TaskStatus
    };

    const validatedStatus = validStatuses[status];
    if (!validatedStatus) {
      throw new Error(`Invalid task status: ${status}`);
    }
    return validatedStatus;
  }

  /**
   * Type guard to check if a value is a valid IAgentsRow.
   * @param value - Value to check.
   * @returns True if value is IAgentsRow.
   */
  private isValidAgentsRow(value: unknown): value is IAgentsRow {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const record = value as Record<string, unknown>;
    return (
      typeof record.id === 'string'
      && typeof record.name === 'string'
      && typeof record.description === 'string'
      && typeof record.instructions === 'string'
      && typeof record.type === 'string'
      && typeof record.status === 'string'
      && (record.created_at === null || typeof record.created_at === 'string')
      && (record.updated_at === null || typeof record.updated_at === 'string')
    );
  }

  /**
   * Converts database row to agent object.
   * @param row - Database row data.
   * @returns Agent object.
   * @throws Error if row is not a valid agents row.
   */
  protected rowToAgent(row: unknown): IAgent {
    if (!this.isValidAgentsRow(row)) {
      throw new Error('Invalid agents row data');
    }
    return this.createAgentFromRow(row);
  }

  /**
   * Creates agent object from database row.
   * @param agentRow - Database row data.
   * @returns Agent object.
   */
  private createAgentFromRow(agentRow: IAgentsRow): IAgent {
    return {
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
  }
}
