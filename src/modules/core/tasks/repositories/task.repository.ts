/**
 * Task repository for task data access operations.
 * @file Task repository for managing task data access.
 * @module modules/core/tasks/repositories/task.repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import {
  type ITask,
  type ITaskFilter,
  type ITaskStatistics,
  TaskPriorityEnum,
  TaskStatusEnum
} from '@/modules/core/tasks/types/index';
import type { ITaskRow } from '@/modules/core/tasks/types/database.generated';

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
  async create(task: Partial<ITask>): Promise<ITask> {
    this.validateRequiredTaskFields(task);
    const taskData = this.prepareTaskDataForInsert(task);

    const sql = `INSERT INTO task 
      (type, module_id, instructions, priority, status, retry_count, max_executions, 
       max_time, result, scheduled_at, created_by, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`;

    const result = await this.database.query<{ id: number }>(sql, [
      taskData.type, taskData.moduleId, taskData.instructions, taskData.priority,
      taskData.status, taskData.retryCount, taskData.maxExecutions, taskData.maxTime,
      taskData.result, taskData.scheduledAt, taskData.createdBy, taskData.metadata
    ]);

    const taskId = result[0]?.id;
    if (taskId === undefined) {
      throw new Error('Failed to get task ID after insert');
    }

    return this.buildCreatedTaskResponse(taskId, taskData, task);
  }

  /**
   * Find the next available task matching criteria.
   * @param types - Optional task types to filter by.
   * @returns Promise resolving to next task or null.
   */
  async findNextAvailable(types?: string[]): Promise<ITask | null> {
    const now = new Date().toISOString();
    let sql = `SELECT * FROM task WHERE status = ? AND (scheduled_at IS NULL OR scheduled_at <= ?)`;
    const params: unknown[] = [TaskStatusEnum.PENDING, now];

    if (types !== undefined && types.length > 0) {
      const placeholders = types.map(() => { return '?' }).join(',');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    sql += ' ORDER BY priority DESC, created_at ASC LIMIT 1';
    const result = await this.database.query<ITaskRow>(sql, params);

    if (result.length === 0) {
      return null;
    }

    const [row] = result;
    return row === undefined ? null : this.mapRowToTask(row);
  }

  /**
   * Update task status.
   * @param taskId - Task ID to update.
   * @param status - New status.
   * @returns Promise that resolves when update is complete.
   */
  async updateStatus(taskId: number, status: TaskStatusEnum): Promise<void> {
    await this.database.execute('UPDATE task SET status = ? WHERE id = ?', [status, taskId]);
  }

  /**
   * Find task by ID.
   * @param taskId - Task ID to find.
   * @returns Promise resolving to task or null.
   */
  async findById(taskId: number): Promise<ITask | null> {
    const result = await this.database.query<ITaskRow>('SELECT * FROM task WHERE id = ?', [taskId]);

    if (result.length === 0) {
      return null;
    }

    const [row] = result;
    return row === undefined ? null : this.mapRowToTask(row);
  }

  /**
   * Find tasks with optional filtering.
   * @param filter - Optional filter criteria.
   * @returns Promise resolving to array of tasks.
   */
  async findWithFilter(filter?: ITaskFilter): Promise<ITask[]> {
    const { sql, params } = this.buildFilterQuery(filter);
    const result = await this.database.query<ITaskRow>(sql, params);
    return result.map((row): ITask => { return this.mapRowToTask(row) });
  }

  /**
   * Update task with partial data.
   * @param taskId - Task ID to update.
   * @param updates - Partial task data to update.
   * @returns Promise resolving to the updated task.
   */
  async update(taskId: number, updates: Partial<ITask>): Promise<ITask> {
    const { updateFields, updateValues } = this.buildUpdateQuery(updates);

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    await this.executeUpdateQuery(updateFields, updateValues, taskId);
    return await this.getUpdatedTask(taskId);
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

    return {
      total,
      pending: statusCounts[TaskStatusEnum.PENDING] ?? 0,
      inProgress: statusCounts[TaskStatusEnum.IN_PROGRESS] ?? 0,
      completed: statusCounts[TaskStatusEnum.COMPLETED] ?? 0,
      failed: statusCounts[TaskStatusEnum.FAILED] ?? 0,
      cancelled: statusCounts[TaskStatusEnum.CANCELLED] ?? 0,
      tasksByType
    };
  }

  /**
   * Validate required task fields.
   * @param task - Task data to validate.
   * @throws Error if validation fails.
   */
  private validateRequiredTaskFields(task: Partial<ITask>): void {
    if (typeof task.type !== 'string') {
      throw new Error('Task type is required and must be a string');
    }
    if (typeof task.moduleId !== 'string') {
      throw new Error('Task moduleId is required and must be a string');
    }
  }

  /**
   * Prepare task data for database insert.
   * @param task - Original task data.
   * @returns Prepared task data.
   */
  private prepareTaskDataForInsert(task: Partial<ITask>): Record<string, unknown> {
    return {
      type: task.type,
      moduleId: task.moduleId,
      instructions: task.instructions === undefined ? null : JSON.stringify(task.instructions),
      priority: task.priority ?? TaskPriorityEnum.NORMAL,
      status: task.status ?? TaskStatusEnum.PENDING,
      retryCount: 0,
      maxExecutions: task.maxExecutions ?? 3,
      maxTime: task.maxTime ?? null,
      result: task.result ?? null,
      scheduledAt: task.scheduledAt?.toISOString(),
      createdBy: task.createdBy,
      metadata: task.metadata === undefined ? null : JSON.stringify(task.metadata)
    };
  }

  /**
   * Build the response object for a created task.
   * @param taskId - ID of the created task.
   * @param taskData - Prepared task data.
   * @param originalTask - Original task input.
   * @returns Created task object.
   */
  private buildCreatedTaskResponse(
    taskId: number,
    taskData: Record<string, unknown>,
    originalTask: Partial<ITask>
  ): ITask {
    const task: ITask = {
      id: taskId,
      type: String(taskData.type),
      moduleId: String(taskData.moduleId),
      instructions: originalTask.instructions,
      priority: Number(taskData.priority),
      status: String(taskData.status) as TaskStatusEnum,
      retryCount: Number(taskData.retryCount),
      maxExecutions: Number(taskData.maxExecutions)
    };

    return this.addOptionalFieldsToTask(task, taskData, originalTask);
  }

  /**
   * Add optional fields to task object.
   * @param task - Base task object to modify.
   * @param baseTask
   * @param taskData - Prepared task data.
   * @param originalTask - Original task input.
   */
  private addOptionalFieldsToTask(
    baseTask: ITask,
    taskData: Record<string, unknown>,
    originalTask: Partial<ITask>
  ): ITask {
    const task = { ...baseTask };

    if (taskData.maxTime !== null && taskData.maxTime !== undefined) {
      task.maxTime = Number(taskData.maxTime);
    }

    if (taskData.result !== null && taskData.result !== undefined) {
      task.result = String(taskData.result);
    }

    if (originalTask.scheduledAt !== undefined) {
      const { scheduledAt } = originalTask;
      task.scheduledAt = scheduledAt;
    }

    if (taskData.createdBy !== null && taskData.createdBy !== undefined) {
      task.createdBy = String(taskData.createdBy);
    }

    if (originalTask.metadata !== undefined) {
      const { metadata } = originalTask;
      task.metadata = metadata;
    }

    return task;
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
    if (filter?.moduleId !== undefined) {
      sql += ' AND module_id = ?';
      params.push(filter.moduleId);
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
  private buildUpdateQuery(updates: Partial<ITask>): {
    updateFields: string[];
    updateValues: unknown[];
  } {
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updates.status);

      if (updates.status === TaskStatusEnum.COMPLETED || updates.status === TaskStatusEnum.FAILED) {
        updateFields.push('completed_at = ?');
        updateValues.push(new Date().toISOString());
      }
    }

    if (updates.instructions !== undefined) {
      updateFields.push('instructions = ?');
      const value = updates.instructions === null ? null : JSON.stringify(updates.instructions);
      updateValues.push(value);
    }

    if (updates.priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(updates.priority);
    }

    if (updates.maxExecutions !== undefined) {
      updateFields.push('max_executions = ?');
      updateValues.push(updates.maxExecutions);
    }

    if (updates.maxTime !== undefined) {
      updateFields.push('max_time = ?');
      updateValues.push(updates.maxTime);
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

    if (updates.assignedAgentId !== undefined) {
      updateFields.push('assigned_agent_id = ?');
      updateValues.push(updates.assignedAgentId);
    }

    if (updates.completedAt !== undefined) {
      updateFields.push('completed_at = ?');
      updateValues.push(updates.completedAt ? updates.completedAt.toISOString() : null);
    }

    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      const value = updates.metadata === null ? null : JSON.stringify(updates.metadata);
      updateValues.push(value);
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
   * Get the updated task after update operation.
   * @param taskId - Task ID to retrieve.
   * @returns Promise resolving to the updated task.
   * @throws Error if task not found after update.
   */
  private async getUpdatedTask(taskId: number): Promise<ITask> {
    const updatedTask = await this.findById(taskId);
    if (updatedTask === null) {
      throw new Error('Task not found after update');
    }
    return updatedTask;
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
    result.forEach((row) => {
      statusCounts[row.status] = row.count;
    });

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
    result.forEach((row) => {
      tasksByType[row.type] = row.count;
    });

    return tasksByType;
  }

  /**
   * Map database row to task interface.
   * @param row - Database row.
   * @returns Mapped task object.
   * @throws Error if task status is invalid.
   */
  private mapRowToTask(row: ITaskRow): ITask {
    this.validateTaskStatus(row.status ?? 'pending');

    const task: ITask = {
      id: row.id,
      type: row.type,
      moduleId: row.module_id,
      priority: row.priority ?? 0,
      status: (row.status ?? 'pending') as TaskStatusEnum,
      retryCount: row.retry_count ?? 0,
      maxExecutions: row.max_executions ?? 3,
      createdAt: new Date(row.created_at ?? new Date().toISOString()),
      updatedAt: new Date(row.updated_at ?? new Date().toISOString())
    };

    return this.addOptionalRowFieldsToTask(task, row);
  }

  /**
   * Validate task status from database row.
   * @param status - Status value to validate.
   * @throws Error if status is invalid.
   */
  private validateTaskStatus(status: string): void {
    const validStatuses: string[] = Object.values(TaskStatusEnum);
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid task status: ${status}`);
    }
  }

  /**
   * Add optional fields from database row to task object.
   * @param task - Base task object to modify.
   * @param baseTask
   * @param row - Database row with optional fields.
   */
  private addOptionalRowFieldsToTask(baseTask: ITask, row: ITaskRow): ITask {
    const task = { ...baseTask };

    if (row.instructions !== null) {
      task.instructions = this.safeJsonParse(row.instructions);
    }

    if (row.max_time !== null) {
      const { max_time: maxTime } = row;
      task.maxTime = maxTime;
    }

    if (row.result !== null) {
      const { result } = row;
      task.result = result;
    }

    if (row.error !== null) {
      const { error } = row;
      task.error = error;
    }

    if (row.progress !== null) {
      const { progress } = row;
      task.progress = progress;
    }

    if (row.assigned_agent_id !== null) {
      const { assigned_agent_id: assignedAgentId } = row;
      task.assignedAgentId = assignedAgentId;
    }

    if (row.scheduled_at !== null) {
      task.scheduledAt = new Date(row.scheduled_at);
    }

    if (row.completed_at !== null) {
      task.completedAt = new Date(row.completed_at);
    }

    if (row.created_by !== null) {
      const { created_by: createdBy } = row;
      task.createdBy = createdBy;
    }

    if (row.metadata !== null) {
      const parsedMetadata = this.safeJsonParse(row.metadata);
      if (parsedMetadata !== undefined) {
        task.metadata = parsedMetadata as Record<string, unknown>;
      }
    }

    return task;
  }

  /**
   * Safely parse JSON with proper error handling.
   * @param jsonString - JSON string to parse.
   * @returns Parsed object or undefined if parsing fails.
   */
  private safeJsonParse(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString) as unknown;
    } catch {
      return undefined;
    }
  }

  /**
   * Find tasks by assigned agent.
   * @param agentId - ID of the agent.
   * @returns Promise resolving to array of tasks.
   */
  async findByAgent(agentId: string): Promise<ITask[]> {
    const sql = 'SELECT * FROM task WHERE assigned_agent_id = ? ORDER BY priority DESC, created_at ASC';
    const result = await this.database.query<ITaskRow>(sql, [agentId]);
    return result.map(row => { return this.mapRowToTask(row) });
  }

  /**
   * Find tasks by status.
   * @param status - Task status to filter by.
   * @returns Promise resolving to array of tasks.
   */
  async findByStatus(status: TaskStatusEnum): Promise<ITask[]> {
    const sql = 'SELECT * FROM task WHERE status = ? ORDER BY priority DESC, created_at ASC';
    const result = await this.database.query<ITaskRow>(sql, [status]);
    return result.map(row => { return this.mapRowToTask(row) });
  }
}
