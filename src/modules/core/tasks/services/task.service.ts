/**
 * Task service implementation.
 * @file Task service implementation.
 * @module modules/core/tasks/services
 */

import type {
  ITask,
  ITaskFilter,
  ITaskHandler,
  ITaskService,
  ITaskStatistics
} from '@/modules/core/tasks/types/index';
import {
 TaskExecutionStatus, TaskPriority, TaskStatus
} from '@/modules/core/tasks/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { DatabaseService } from '@/modules/core/database/services/database.service';

export class TaskService implements ITaskService {
  private static instance: TaskService | null = null;
  private logger!: ILogger;
  private database!: DatabaseService;
  private readonly handlers: Map<string, ITaskHandler> = new Map();
  private initialized = false;

  private constructor() {}

  public static getInstance(): TaskService {
    TaskService.instance ||= new TaskService();
    return TaskService.instance;
  }

  public async initialize(logger: ILogger, database: DatabaseService): Promise<void> {
    if (this.initialized) {
      throw new Error('TaskService already initialized');
    }

    this.logger = logger;
    this.database = database;
    this.initialized = true;

    this.logger.info(LogSource.MODULES, 'TaskService initialized');
  }

  public async addTask(task: Partial<ITask>): Promise<ITask> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    const taskData = {
      type: task.type!,
      module_id: task.moduleId!,
      payload: task.payload ? JSON.stringify(task.payload) : null,
      priority: task.priority ?? TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      retry_count: 0,
      max_retries: task.maxRetries ?? 3,
      scheduled_at: task.scheduledAt?.toISOString(),
      created_by: task.createdBy,
      metadata: task.metadata ? JSON.stringify(task.metadata) : null
    };

    await this.database.execute(
      `INSERT INTO tasks_queue 
       (type, module_id, payload, priority, status, retry_count, max_retries, scheduled_at, created_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskData.type,
        taskData.module_id,
        taskData.payload,
        taskData.priority,
        taskData.status,
        taskData.retry_count,
        taskData.max_retries,
        taskData.scheduled_at,
        taskData.created_by,
        taskData.metadata
      ]
    );

    const idResult = await this.database.query<{id: number}>('SELECT last_insert_rowid() as id');
    const taskId = idResult[0]?.id;

    if (!taskId) {
      throw new Error('Failed to get task ID after insert');
    }

    const newTask: ITask = {
      id: taskId,
      type: taskData.type,
      moduleId: taskData.module_id,
      payload: task.payload,
      priority: taskData.priority,
      status: taskData.status,
      retryCount: taskData.retry_count,
      maxRetries: taskData.max_retries,
      ...task.scheduledAt && { scheduledAt: task.scheduledAt },
      ...taskData.created_by && { createdBy: taskData.created_by },
      ...task.metadata && { metadata: task.metadata }
    };

    this.logger.info(LogSource.MODULES, `Task added: ${newTask.id} (${newTask.type})`);
    return newTask;
  }

  public async receiveTask(types?: string[]): Promise<ITask | null> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    const now = new Date().toISOString();
    let sql = `
      SELECT * FROM tasks_queue 
      WHERE status = ? 
      AND (scheduled_at IS NULL OR scheduled_at <= ?)
    `;
    const params: any[] = [TaskStatus.PENDING, now];

    if (types && types.length > 0) {
      const placeholders = types.map(() => { return '?' }).join(',');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    sql += ' ORDER BY priority DESC, created_at ASC LIMIT 1';

    const result = await this.database.query<any>(sql, params);

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    const taskId = row.id as number;

    await this.database.execute('UPDATE tasks_queue SET status = ? WHERE id = ?', [TaskStatus.IN_PROGRESS, taskId]);

    await this.database.execute('INSERT INTO tasks_executions (task_id, status) VALUES (?, ?)', [taskId, TaskExecutionStatus.RUNNING]);

    const task: ITask = {
      id: taskId,
      type: row.type as string,
      moduleId: row.module_id as string,
      payload: row.payload ? JSON.parse(row.payload as string) : undefined,
      priority: row.priority as number,
      status: TaskStatus.IN_PROGRESS,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      ...row.scheduled_at && { scheduledAt: new Date(row.scheduled_at as string) },
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      ...row.created_by && { createdBy: row.created_by as string },
      ...row.metadata && { metadata: JSON.parse(row.metadata as string) }
    };

    this.logger.info(LogSource.MODULES, `Task received: ${task.id} (${task.type})`);
    return task;
  }

  public async updateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    await this.database.execute('UPDATE tasks_queue SET status = ? WHERE id = ?', [status, taskId]);

    if ([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(status)) {
      const executionStatus = status === TaskStatus.COMPLETED
        ? TaskExecutionStatus.SUCCESS
        : status === TaskStatus.FAILED
          ? TaskExecutionStatus.FAILED
          : TaskExecutionStatus.CANCELLED;

      await this.database.execute(
        `UPDATE tasks_executions 
         SET status = ?, completed_at = CURRENT_TIMESTAMP,
         duration_ms = (strftime('%s', 'now') - strftime('%s', started_at)) * 1000
         WHERE task_id = ? AND completed_at IS NULL`,
        [executionStatus, taskId]
      );
    }

    this.logger.info(LogSource.MODULES, `Task ${taskId} status updated to ${status}`);
  }

  public async getTaskById(taskId: number): Promise<ITask | null> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    const result = await this.database.query<any>('SELECT * FROM tasks_queue WHERE id = ?', [taskId]);

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id as number,
      type: row.type as string,
      moduleId: row.module_id as string,
      payload: row.payload ? JSON.parse(row.payload as string) : undefined,
      priority: row.priority as number,
      status: row.status as TaskStatus,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      ...row.scheduled_at && { scheduledAt: new Date(row.scheduled_at as string) },
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      ...row.created_by && { createdBy: row.created_by as string },
      ...row.metadata && { metadata: JSON.parse(row.metadata as string) }
    };
  }

  public async listTasks(filter?: ITaskFilter): Promise<ITask[]> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    let sql = 'SELECT * FROM tasks_queue WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }

    if (filter?.moduleId) {
      sql += ' AND module_id = ?';
      params.push(filter.moduleId);
    }

    sql += ' ORDER BY priority DESC, created_at ASC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    if (filter?.offset) {
      sql += ' OFFSET ?';
      params.push(filter.offset);
    }

    const result = await this.database.query<any>(sql, params);

    if (!result) {
      return [];
    }

    return result.map(row => { return {
      id: row.id as number,
      type: row.type as string,
      moduleId: row.module_id as string,
      payload: row.payload ? JSON.parse(row.payload as string) : undefined,
      priority: row.priority as number,
      status: row.status as TaskStatus,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      ...row.scheduled_at && { scheduledAt: new Date(row.scheduled_at as string) },
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      ...row.created_by && { createdBy: row.created_by as string },
      ...row.metadata && { metadata: JSON.parse(row.metadata as string) }
    } });
  }

  public async cancelTask(taskId: number): Promise<void> {
    await this.updateTaskStatus(taskId, TaskStatus.CANCELLED);
  }

  public async registerHandler(handler: ITaskHandler): Promise<void> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    if (this.handlers.has(handler.type)) {
      throw new Error(`Handler for task type '${handler.type}' already registered`);
    }

    this.handlers.set(handler.type, handler);

    await this.database.execute(
      `INSERT OR REPLACE INTO tasks_types (type, module_id, description, enabled)
       VALUES (?, ?, ?, ?)`,
      [handler.type, 'unknown', `Handler for ${handler.type}`, 1]
    );

    this.logger.info(LogSource.MODULES, `Task handler registered: ${handler.type}`);
  }

  public async unregisterHandler(type: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    this.handlers.delete(type);

    await this.database.execute('UPDATE tasks_types SET enabled = 0 WHERE type = ?', [type]);

    this.logger.info(LogSource.MODULES, `Task handler unregistered: ${type}`);
  }

  public async getStatistics(): Promise<ITaskStatistics> {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }

    const statusCountsResult = await this.database.query<{status: string; count: number}>(
      `SELECT status, COUNT(*) as count FROM tasks_queue GROUP BY status`
    );

    const statusCounts: Record<string, number> = {};
    if (statusCountsResult) {
      for (const row of statusCountsResult) {
        statusCounts[row.status] = row.count;
      }
    }

    const typeCountsResult = await this.database.query<{type: string; count: number}>(
      `SELECT type, COUNT(*) as count FROM tasks_queue GROUP BY type`
    );

    const tasksByType: Record<string, number> = {};
    if (typeCountsResult) {
      for (const row of typeCountsResult) {
        tasksByType[row.type] = row.count;
      }
    }

    const avgTimeResult = await this.database.query<{avg_time: number | null}>(
      `SELECT AVG(duration_ms) as avg_time FROM tasks_executions WHERE status = ?`,
      [TaskExecutionStatus.SUCCESS]
    );

    const avgTime = avgTimeResult[0]?.avg_time;
    const total = Object.values(statusCounts).reduce((sum, count) => { return sum + count }, 0);

    return {
      total,
      pending: statusCounts[TaskStatus.PENDING] || 0,
      inProgress: statusCounts[TaskStatus.IN_PROGRESS] || 0,
      completed: statusCounts[TaskStatus.COMPLETED] || 0,
      failed: statusCounts[TaskStatus.FAILED] || 0,
      cancelled: statusCounts[TaskStatus.CANCELLED] || 0,
      ...avgTime && { averageExecutionTime: avgTime },
      tasksByType
    };
  }

  public getHandlers(): Map<string, ITaskHandler> {
    return new Map(this.handlers);
  }
}
