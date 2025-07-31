/**
 * Task repository for task data access operations.
 * @file Task repository for managing task data access.
 * @module modules/core/tasks/repositories/task.repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import {
 type ITaskMetadataRow, type ITaskRow, TaskStatus
} from '@/modules/core/tasks/types/database.generated';
import {
  type ITaskFilter,
  type ITaskStatistics,
  TaskPriority
} from '@/modules/core/tasks/types/manual';

/**
 * Task repository for database operations.
 */
export class TaskRepository {
  /**
   * Constructor for TaskRepository.
   * @param database - Database service instance.
   */
  constructor(private readonly database: DatabaseService) {}

  /**
   * Create a new task in the database.
   * @param task - Task data to create.
   * @returns Promise resolving to the created task.
   */
  async create(task: Partial<ITaskRow>): Promise<ITaskRow> {
    this.validateRequiredTaskFields(task);

    const sql = `INSERT INTO task 
      (type, module_id, instructions, priority, status, retry_count, max_executions, 
       max_time, result, scheduled_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`;

    const result = await this.database.query<ITaskRow>(sql, [
      task.type,
      task.module_id,
      task.instructions ?? null,
      task.priority ?? TaskPriority.NORMAL,
      task.status ?? TaskStatus.PENDING,
      task.retry_count ?? 0,
      task.max_executions ?? 3,
      task.max_time ?? null,
      task.result ?? null,
      task.scheduled_at ?? null,
      task.created_by ?? null
    ]);

    if (result.length === 0 || !result[0]) {
      throw new Error('Failed to create task');
    }

    return result[0];
  }

  /**
   * Find the next available task matching criteria.
   * @param types - Optional task types to filter by.
   * @returns Promise resolving to next task or null.
   */
  async findNextAvailable(types?: string[]): Promise<ITaskRow | null> {
    const now = new Date().toISOString();
    let sql = `SELECT * FROM task WHERE status = ? AND (scheduled_at IS NULL OR scheduled_at <= ?)`;
    const params: unknown[] = [TaskStatus.PENDING, now];

    if (types !== undefined && types.length > 0) {
      const placeholders = types.map(() => { return '?' }).join(',');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    sql += ' ORDER BY priority DESC, created_at ASC LIMIT 1';
    const result = await this.database.query<ITaskRow>(sql, params);

    return result.length > 0 && result[0] ? result[0] : null;
  }

  /**
   * Update task status.
   * @param taskId - Task ID to update.
   * @param status - New status.
   * @returns Promise that resolves when update is complete.
   */
  async updateStatus(taskId: number, status: TaskStatus): Promise<void> {
    await this.database.execute('UPDATE task SET status = ? WHERE id = ?', [status, taskId]);
  }

  /**
   * Find task by ID.
   * @param taskId - Task ID to find.
   * @returns Promise resolving to task or null.
   */
  async findById(taskId: number): Promise<ITaskRow | null> {
    const result = await this.database.query<ITaskRow>('SELECT * FROM task WHERE id = ?', [taskId]);
    return result.length > 0 && result[0] ? result[0] : null;
  }

  /**
   * Find tasks with optional filtering.
   * @param filter - Optional filter criteria.
   * @returns Promise resolving to array of tasks.
   */
  async findWithFilter(filter?: ITaskFilter): Promise<ITaskRow[]> {
    const { sql, params } = this.buildFilterQuery(filter);
    return await this.database.query<ITaskRow>(sql, params);
  }

  /**
   * Update task with partial data.
   * @param taskId - Task ID to update.
   * @param updates - Partial task data to update.
   * @returns Promise resolving to the updated task.
   */
  async update(taskId: number, updates: Partial<ITaskRow>): Promise<ITaskRow> {
    const { updateFields, updateValues } = this.buildUpdateQuery(updates);

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    await this.executeUpdateQuery(updateFields, updateValues, taskId);

    const updatedTask = await this.findById(taskId);
    if (!updatedTask) {
      throw new Error('Task not found after update');
    }

    return updatedTask;
  }

  /**
   * Get task statistics.
   * @returns Promise resolving to task statistics.
   */
  async getStatistics(): Promise<ITaskStatistics> {
    const [statusCounts, tasksByType] = await Promise.all([
      this.getStatusCounts(),
      this.getTypeCounts()
    ]);

    const total = Object.values(statusCounts).reduce((sum, count) => { return sum + count }, 0);

    const stats: ITaskStatistics = {
      total,
      pending: statusCounts[TaskStatus.PENDING] ?? 0,
      inProgress: statusCounts[TaskStatus.IN_PROGRESS] ?? 0,
      completed: statusCounts[TaskStatus.COMPLETED] ?? 0,
      failed: statusCounts[TaskStatus.FAILED] ?? 0,
      cancelled: statusCounts[TaskStatus.CANCELLED] ?? 0,
      averageExecutionTime: undefined,
      tasksByType
    };

    return stats;
  }

  /**
   * Get metadata for a task.
   * @param taskId - Task ID.
   * @returns Promise resolving to metadata key-value pairs.
   */
  async getMetadata(taskId: number): Promise<Record<string, string>> {
    const sql = 'SELECT key, value FROM task_metadata WHERE task_id = ?';
    const result = await this.database.query<ITaskMetadataRow>(sql, [taskId]);

    const metadata: Record<string, string> = {};
    for (const row of result) {
      if (row.value !== null) {
        metadata[row.key] = row.value;
      }
    }

    return metadata;
  }

  /**
   * Set metadata for a task.
   * @param taskId - Task ID.
   * @param key - Metadata key.
   * @param value - Metadata value.
   * @returns Promise that resolves when metadata is set.
   */
  async setMetadata(taskId: number, key: string, value: string): Promise<void> {
    const sql = `INSERT INTO task_metadata (task_id, key, value) 
                 VALUES (?, ?, ?) 
                 ON CONFLICT(task_id, key) 
                 DO UPDATE SET value = excluded.value`;
    await this.database.execute(sql, [taskId, key, value]);
  }

  /**
   * Validate required task fields.
   * @param task - Task data to validate.
   * @throws Error if validation fails.
   */
  private validateRequiredTaskFields(task: Partial<ITaskRow>): void {
    if (typeof task.type !== 'string') {
      throw new Error('Task type is required and must be a string');
    }
    if (typeof task.module_id !== 'string') {
      throw new Error('Task module_id is required and must be a string');
    }
  }

  /**
   * Build SQL query with filters.
   * @param filter - Optional filter criteria.
   * @returns Object containing SQL query and parameters.
   */
  private buildFilterQuery(filter?: ITaskFilter): { sql: string; params: unknown[] } {
    let sql = 'SELECT * FROM task WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status !== undefined) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.type !== undefined) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter?.module_id !== undefined) {
      sql += ' AND module_id = ?';
      params.push(filter.module_id);
    }

    sql += ' ORDER BY priority DESC, created_at ASC';

    if (filter?.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    if (filter?.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(filter.offset);
    }

    return {
 sql,
params
};
  }

  /**
   * Build update query fields and values.
   * @param updates - Partial task data to update.
   * @returns Object containing update fields and values.
   */
  private buildUpdateQuery(updates: Partial<ITaskRow>): {
    updateFields: string[];
    updateValues: unknown[];
  } {
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updates.status);

      if (updates.status === TaskStatus.COMPLETED || updates.status === TaskStatus.FAILED) {
        updateFields.push('completed_at = ?');
        updateValues.push(new Date().toISOString());
      }
    }

    if (updates.instructions !== undefined) {
      updateFields.push('instructions = ?');
      updateValues.push(updates.instructions);
    }

    if (updates.priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(updates.priority);
    }

    if (updates.max_executions !== undefined) {
      updateFields.push('max_executions = ?');
      updateValues.push(updates.max_executions);
    }

    if (updates.max_time !== undefined) {
      updateFields.push('max_time = ?');
      updateValues.push(updates.max_time);
    }

    if (updates.result !== undefined) {
      updateFields.push('result = ?');
      updateValues.push(updates.result);
    }

    if (updates.error !== undefined) {
      updateFields.push('error = ?');
      updateValues.push(updates.error);
    }

    if (updates.progress !== undefined) {
      updateFields.push('progress = ?');
      updateValues.push(updates.progress);
    }

    if (updates.assigned_agent_id !== undefined) {
      updateFields.push('assigned_agent_id = ?');
      updateValues.push(updates.assigned_agent_id);
    }

    if (updates.completed_at !== undefined) {
      updateFields.push('completed_at = ?');
      updateValues.push(updates.completed_at);
    }

    return {
      updateFields,
      updateValues
    };
  }

  /**
   * Execute the update query.
   * @param updateFields - Array of update field strings.
   * @param updateValues - Array of update values.
   * @param taskId - Task ID to update.
   * @returns Promise that resolves when update is complete.
   */
  private async executeUpdateQuery(
    updateFields: string[],
    updateValues: unknown[],
    taskId: number
  ): Promise<void> {
    updateValues.push(taskId);
    await this.database.execute(`UPDATE task SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
  }

  /**
   * Get status counts for statistics.
   * @returns Promise resolving to status counts.
   */
  private async getStatusCounts(): Promise<Record<string, number>> {
    const result = await this.database.query<{ status: string; count: number }>(
      'SELECT status, COUNT(*) as count FROM task GROUP BY status'
    );

    const statusCounts: Record<string, number> = {};
    for (const row of result) {
      statusCounts[row.status] = row.count;
    }

    return statusCounts;
  }

  /**
   * Get type counts for statistics.
   * @returns Promise resolving to type counts.
   */
  private async getTypeCounts(): Promise<Record<string, number>> {
    const result = await this.database.query<{ type: string; count: number }>(
      'SELECT type, COUNT(*) as count FROM task GROUP BY type'
    );

    const tasksByType: Record<string, number> = {};
    for (const row of result) {
      tasksByType[row.type] = row.count;
    }

    return tasksByType;
  }

  /**
   * Find tasks by assigned agent.
   * @param agentId - ID of the agent.
   * @returns Promise resolving to array of tasks.
   */
  async findByAgent(agentId: string): Promise<ITaskRow[]> {
    const sql = 'SELECT * FROM task WHERE assigned_agent_id = ? ORDER BY priority DESC, created_at ASC';
    return await this.database.query<ITaskRow>(sql, [agentId]);
  }

  /**
   * Find tasks by status.
   * @param status - Task status to filter by.
   * @returns Promise resolving to array of tasks.
   */
  async findByStatus(status: TaskStatus): Promise<ITaskRow[]> {
    const sql = 'SELECT * FROM task WHERE status = ? ORDER BY priority DESC, created_at ASC';
    return await this.database.query<ITaskRow>(sql, [status]);
  }
}
