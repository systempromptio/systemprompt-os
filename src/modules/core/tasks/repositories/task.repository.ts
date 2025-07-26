/**
 * Task repository for task data access operations.
 * @file Task repository for managing task data access.
 * @module modules/core/tasks/repositories/task.repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type {
  ITask,
  ITaskFilter,
  ITaskStatistics
} from '@/modules/core/tasks/types/index';
import {
  TaskExecutionStatus,
  TaskPriority,
  TaskStatus
} from '@/modules/core/tasks/types/index';

/**
 * Database row interface for tasks.
 */
interface ITaskRow {
  id: number;
  type: string;
  module_id: string;
  payload: string | null;
  priority: number;
  status: string;
  retry_count: number;
  max_retries: number;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: string | null;
}

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
    if (task.type == null || typeof task.type !== 'string') {
      throw new Error('Task type is required and must be a string');
    }
    if (task.moduleId == null || typeof task.moduleId !== 'string') {
      throw new Error('Task moduleId is required and must be a string');
    }

    const taskData = {
      type: task.type,
      moduleId: task.moduleId,
      payload: task.payload != null ? JSON.stringify(task.payload) : null,
      priority: task.priority ?? TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: task.maxRetries ?? 3,
      scheduledAt: task.scheduledAt?.toISOString(),
      createdBy: task.createdBy,
      metadata: task.metadata != null ? JSON.stringify(task.metadata) : null
    };

    await this.database.execute(
      `INSERT INTO tasks_queue 
       (type, module_id, payload, priority, status, retry_count, max_retries, 
        scheduled_at, created_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskData.type,
        taskData.moduleId,
        taskData.payload,
        taskData.priority,
        taskData.status,
        taskData.retryCount,
        taskData.maxRetries,
        taskData.scheduledAt,
        taskData.createdBy,
        taskData.metadata
      ]
    );

    const idResult = await this.database.query<{ id: number }>(
      'SELECT last_insert_rowid() as id'
    );
    const taskId = idResult[0]?.id;

    if (taskId == null) {
      throw new Error('Failed to get task ID after insert');
    }

    return {
      id: taskId,
      type: taskData.type,
      moduleId: taskData.moduleId,
      payload: task.payload,
      priority: taskData.priority,
      status: taskData.status,
      retryCount: taskData.retryCount,
      maxRetries: taskData.maxRetries,
      ...task.scheduledAt != null && { scheduledAt: task.scheduledAt },
      ...taskData.createdBy != null && { createdBy: taskData.createdBy },
      ...task.metadata != null && { metadata: task.metadata }
    };
  }

  /**
   * Find the next available task matching criteria.
   * @param types - Optional task types to filter by.
   * @returns Promise resolving to next task or null.
   */
  async findNextAvailable(types?: string[]): Promise<ITask | null> {
    const now = new Date().toISOString();
    let sql = `
      SELECT * FROM tasks_queue 
      WHERE status = ? 
      AND (scheduled_at IS NULL OR scheduled_at <= ?)
    `;
    const params: unknown[] = [TaskStatus.PENDING, now];

    if (types != null && types.length > 0) {
      const placeholders = types.map((): string => { return '?' }).join(',');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    sql += ' ORDER BY priority DESC, created_at ASC LIMIT 1';

    const result = await this.database.query<ITaskRow>(sql, params);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (row === undefined) {
      return null;
    }

    return this.mapRowToTask(row);
  }

  /**
   * Update task status.
   * @param taskId - Task ID to update.
   * @param status - New status.
   * @returns Promise that resolves when update is complete.
   */
  async updateStatus(taskId: number, status: TaskStatus): Promise<void> {
    await this.database.execute(
      'UPDATE tasks_queue SET status = ? WHERE id = ?',
      [status, taskId]
    );
  }

  /**
   * Find task by ID.
   * @param taskId - Task ID to find.
   * @returns Promise resolving to task or null.
   */
  async findById(taskId: number): Promise<ITask | null> {
    const result = await this.database.query<ITaskRow>(
      'SELECT * FROM tasks_queue WHERE id = ?',
      [taskId]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (row === undefined) {
      return null;
    }

    return this.mapRowToTask(row);
  }

  /**
   * Find tasks with optional filtering.
   * @param filter - Optional filter criteria.
   * @returns Promise resolving to array of tasks.
   */
  async findWithFilter(filter?: ITaskFilter): Promise<ITask[]> {
    let sql = 'SELECT * FROM tasks_queue WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status != null) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.type != null) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }

    if (filter?.moduleId != null) {
      sql += ' AND module_id = ?';
      params.push(filter.moduleId);
    }

    sql += ' ORDER BY priority DESC, created_at ASC';

    if (filter?.limit != null) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    if (filter?.offset != null) {
      sql += ' OFFSET ?';
      params.push(filter.offset);
    }

    const result = await this.database.query<ITaskRow>(sql, params);
    return result.map(row => { return this.mapRowToTask(row) });
  }

  /**
   * Create task execution record.
   * @param taskId - Task ID.
   * @param status - Execution status.
   * @returns Promise that resolves when record is created.
   */
  async createExecution(taskId: number, status: TaskExecutionStatus): Promise<void> {
    await this.database.execute(
      'INSERT INTO tasks_executions (task_id, status) VALUES (?, ?)',
      [taskId, status]
    );
  }

  /**
   * Update task execution status.
   * @param taskId - Task ID.
   * @param status - New execution status.
   * @returns Promise that resolves when update is complete.
   */
  async updateExecution(taskId: number, status: TaskExecutionStatus): Promise<void> {
    await this.database.execute(
      `UPDATE tasks_executions 
       SET status = ?, completed_at = CURRENT_TIMESTAMP,
       duration_ms = (strftime('%s', 'now') - strftime('%s', started_at)) * 1000
       WHERE task_id = ? AND completed_at IS NULL`,
      [status, taskId]
    );
  }

  /**
   * Get task statistics.
   * @returns Promise resolving to task statistics.
   */
  async getStatistics(): Promise<ITaskStatistics> {
    const statusCountsResult = await this.database.query<{
      status: string;
      count: number;
    }>('SELECT status, COUNT(*) as count FROM tasks_queue GROUP BY status');

    const statusCounts: Record<string, number> = {};
    statusCountsResult.forEach(row => {
      statusCounts[row.status] = row.count;
    });

    const typeCountsResult = await this.database.query<{
      type: string;
      count: number;
    }>('SELECT type, COUNT(*) as count FROM tasks_queue GROUP BY type');

    const tasksByType: Record<string, number> = {};
    typeCountsResult.forEach(row => {
      tasksByType[row.type] = row.count;
    });

    const avgTimeResult = await this.database.query<{ avg_time: number | null }>(
      'SELECT AVG(duration_ms) as avg_time FROM tasks_executions WHERE status = ?',
      [TaskExecutionStatus.SUCCESS]
    );

    const avgTime = avgTimeResult[0]?.avg_time;
    const total = Object.values(statusCounts).reduce((sum, count) => { return sum + count }, 0);

    return {
      total,
      pending: statusCounts[TaskStatus.PENDING] ?? 0,
      inProgress: statusCounts[TaskStatus.IN_PROGRESS] ?? 0,
      completed: statusCounts[TaskStatus.COMPLETED] ?? 0,
      failed: statusCounts[TaskStatus.FAILED] ?? 0,
      cancelled: statusCounts[TaskStatus.CANCELLED] ?? 0,
      ...avgTime != null && { averageExecutionTime: avgTime },
      tasksByType
    };
  }

  /**
   * Register or update task type.
   * @param type - Task type name.
   * @param moduleId - Module ID.
   * @param description - Task description.
   * @returns Promise that resolves when type is registered.
   */
  async registerTaskType(
    type: string,
    moduleId: string,
    description: string
  ): Promise<void> {
    await this.database.execute(
      `INSERT OR REPLACE INTO tasks_types (type, module_id, description, enabled)
       VALUES (?, ?, ?, ?)`,
      [type, moduleId, description, 1]
    );
  }

  /**
   * Disable task type.
   * @param type - Task type to disable.
   * @returns Promise that resolves when type is disabled.
   */
  async disableTaskType(type: string): Promise<void> {
    await this.database.execute(
      'UPDATE tasks_types SET enabled = 0 WHERE type = ?',
      [type]
    );
  }

  /**
   * Map database row to task interface.
   * @param row - Database row.
   * @returns Mapped task object.
   */
  private mapRowToTask(row: ITaskRow): ITask {
    if (!Object.values(TaskStatus).includes(row.status as TaskStatus)) {
      throw new Error(`Invalid task status: ${row.status}`);
    }

    const task: ITask = {
      id: row.id,
      type: row.type,
      moduleId: row.module_id,
      priority: row.priority,
      status: row.status as TaskStatus,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };

    if (row.payload != null) {
      task.payload = this.safeJsonParse(row.payload);
    }

    if (row.scheduled_at != null) {
      task.scheduledAt = new Date(row.scheduled_at);
    }

    if (row.created_by != null) {
      task.createdBy = row.created_by;
    }

    if (row.metadata != null) {
      const parsedMetadata = this.safeJsonParse<Record<string, unknown>>(row.metadata);
      if (parsedMetadata != null) {
        task.metadata = parsedMetadata;
      }
    }

    return task;
  }

  /**
   * Safely parse JSON with proper error handling.
   * @param jsonString - JSON string to parse.
   * @returns Parsed object or undefined if parsing fails.
   */
  private safeJsonParse<T = unknown>(jsonString: string): T | undefined {
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return undefined;
    }
  }
}
