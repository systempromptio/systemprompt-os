/**
 * @fileoverview Scheduler repository for database operations
 * @module modules/core/scheduler/repositories
 */

import type { 
  ScheduledTask, 
  TaskExecution, 
  CreateTaskDto, 
  UpdateTaskDto,
  TaskStatus,
  ExecutionStatus,
  TaskStats,
  NextRunInfo
} from '../types/scheduler.types.js';

export class SchedulerRepository {
  constructor(private database: any) {}

  async createTask(data: CreateTaskDto): Promise<ScheduledTask> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const task: ScheduledTask = {
      id,
      name: data.name,
      description: data.description,
      type: data.type || this.inferTaskType(data.schedule),
      schedule: data.schedule,
      command: data.command,
      data: data.data,
      status: 'active',
      enabled: data.enabled !== false,
      retries: data.retries || 3,
      retry_delay: data.retry_delay || 5000,
      timeout: data.timeout,
      run_count: 0,
      success_count: 0,
      failure_count: 0,
      created_at: now,
      updated_at: now,
      metadata: data.metadata
    };

    // Calculate next run
    task.next_run = this.calculateNextRun(task);

    await this.database.execute(
      `INSERT INTO scheduled_tasks (id, name, description, type, schedule, command, data, 
       status, enabled, retries, retry_delay, timeout, next_run, run_count, 
       success_count, failure_count, created_at, updated_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.name,
        task.description,
        task.type,
        task.schedule,
        task.command,
        JSON.stringify(task.data),
        task.status,
        task.enabled ? 1 : 0,
        task.retries,
        task.retry_delay,
        task.timeout,
        task.next_run,
        task.run_count,
        task.success_count,
        task.failure_count,
        task.created_at,
        task.updated_at,
        JSON.stringify(task.metadata)
      ]
    );

    return task;
  }

  async getTask(id: string): Promise<ScheduledTask | null> {
    const results = await this.database.query(
      'SELECT * FROM scheduled_tasks WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToTask(results[0]);
  }

  async listTasks(status?: TaskStatus, enabled?: boolean): Promise<ScheduledTask[]> {
    let query = 'SELECT * FROM scheduled_tasks';
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (enabled !== undefined) {
      conditions.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const results = await this.database.query(query, params);
    return results.map((row: any) => this.mapToTask(row));
  }

  async getTasksDueForExecution(limit: number = 100): Promise<ScheduledTask[]> {
    const now = new Date();
    
    const results = await this.database.query(
      `SELECT * FROM scheduled_tasks 
       WHERE enabled = 1 
       AND status = 'active' 
       AND (next_run IS NULL OR next_run <= ?) 
       ORDER BY next_run ASC 
       LIMIT ?`,
      [now, limit]
    );

    return results.map((row: any) => this.mapToTask(row));
  }

  async updateTask(id: string, data: UpdateTaskDto): Promise<ScheduledTask | null> {
    const task = await this.getTask(id);
    if (!task) {
      return null;
    }

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [new Date()];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.schedule !== undefined) {
      updates.push('schedule = ?');
      params.push(data.schedule);
      
      // Recalculate next run
      task.schedule = data.schedule;
      const nextRun = this.calculateNextRun(task);
      updates.push('next_run = ?');
      params.push(nextRun);
    }

    if (data.command !== undefined) {
      updates.push('command = ?');
      params.push(data.command);
    }

    if (data.data !== undefined) {
      updates.push('data = ?');
      params.push(JSON.stringify(data.data));
    }

    if (data.retries !== undefined) {
      updates.push('retries = ?');
      params.push(data.retries);
    }

    if (data.retry_delay !== undefined) {
      updates.push('retry_delay = ?');
      params.push(data.retry_delay);
    }

    if (data.timeout !== undefined) {
      updates.push('timeout = ?');
      params.push(data.timeout);
    }

    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(data.enabled ? 1 : 0);
    }

    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }

    params.push(id);

    await this.database.execute(
      `UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.getTask(id);
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    await this.database.execute(
      'UPDATE scheduled_tasks SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date(), id]
    );
  }

  async updateTaskNextRun(id: string, nextRun: Date | null): Promise<void> {
    await this.database.execute(
      'UPDATE scheduled_tasks SET next_run = ?, updated_at = ? WHERE id = ?',
      [nextRun, new Date(), id]
    );
  }

  async updateTaskLastRun(id: string, lastRun: Date): Promise<void> {
    await this.database.execute(
      'UPDATE scheduled_tasks SET last_run = ?, updated_at = ? WHERE id = ?',
      [lastRun, new Date(), id]
    );
  }

  async incrementTaskCounters(
    id: string, 
    success: boolean
  ): Promise<void> {
    const field = success ? 'success_count' : 'failure_count';
    
    await this.database.execute(
      `UPDATE scheduled_tasks 
       SET run_count = run_count + 1, 
           ${field} = ${field} + 1,
           updated_at = ? 
       WHERE id = ?`,
      [new Date(), id]
    );
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await this.database.execute(
      'DELETE FROM scheduled_tasks WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  async createExecution(
    taskId: string,
    status: ExecutionStatus = 'pending'
  ): Promise<TaskExecution> {
    const id = crypto.randomUUID();
    const now = new Date();

    const execution: TaskExecution = {
      id,
      task_id: taskId,
      status,
      started_at: now,
      retry_count: 0
    };

    await this.database.execute(
      `INSERT INTO task_executions (id, task_id, status, started_at, retry_count)
       VALUES (?, ?, ?, ?, ?)`,
      [
        execution.id,
        execution.task_id,
        execution.status,
        execution.started_at,
        execution.retry_count
      ]
    );

    return execution;
  }

  async updateExecution(
    id: string,
    status: ExecutionStatus,
    result?: Record<string, any>,
    error?: string
  ): Promise<void> {
    const now = new Date();
    const execution = await this.getExecution(id);
    
    if (!execution) {
      throw new Error('Execution not found');
    }

    const duration = now.getTime() - execution.started_at.getTime();

    await this.database.execute(
      `UPDATE task_executions 
       SET status = ?, completed_at = ?, duration = ?, result = ?, error = ?
       WHERE id = ?`,
      [
        status,
        now,
        duration,
        result ? JSON.stringify(result) : null,
        error,
        id
      ]
    );
  }

  async getExecution(id: string): Promise<TaskExecution | null> {
    const results = await this.database.query(
      'SELECT * FROM task_executions WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToExecution(results[0]);
  }

  async listExecutions(
    taskId?: string,
    status?: ExecutionStatus,
    limit: number = 100
  ): Promise<TaskExecution[]> {
    let query = 'SELECT * FROM task_executions';
    const conditions: string[] = [];
    const params: any[] = [];

    if (taskId) {
      conditions.push('task_id = ?');
      params.push(taskId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);

    const results = await this.database.query(query, params);
    return results.map((row: any) => this.mapToExecution(row));
  }

  async getNextRuns(limit: number = 10, taskId?: string): Promise<NextRunInfo[]> {
    let query = `
      SELECT id, name, next_run, schedule 
      FROM scheduled_tasks 
      WHERE enabled = 1 
      AND status = 'active' 
      AND next_run IS NOT NULL
    `;
    
    const params: any[] = [];
    
    if (taskId) {
      query += ' AND id = ?';
      params.push(taskId);
    }

    query += ' ORDER BY next_run ASC LIMIT ?';
    params.push(limit);

    const results = await this.database.query(query, params);
    
    return results.map((row: any) => ({
      task_id: row.id,
      task_name: row.name,
      next_run: new Date(row.next_run),
      schedule: row.schedule
    }));
  }

  async getTaskStats(): Promise<TaskStats> {
    const stats = await this.database.query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'active' AND enabled = 1 THEN 1 ELSE 0 END) as active_tasks,
        SUM(CASE WHEN status = 'paused' OR enabled = 0 THEN 1 ELSE 0 END) as paused_tasks,
        SUM(run_count) as total_runs,
        SUM(success_count) as total_successes,
        SUM(failure_count) as total_failures
      FROM scheduled_tasks
    `);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const executionsToday = await this.database.query(
      'SELECT COUNT(*) as count FROM task_executions WHERE started_at >= ?',
      [today]
    );

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const executionsWeek = await this.database.query(
      'SELECT COUNT(*) as count FROM task_executions WHERE started_at >= ?',
      [weekAgo]
    );

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const executionsMonth = await this.database.query(
      'SELECT COUNT(*) as count FROM task_executions WHERE started_at >= ?',
      [monthAgo]
    );

    const avgDuration = await this.database.query(
      'SELECT AVG(duration) as avg FROM task_executions WHERE status = "completed"'
    );

    const totalRuns = stats[0].total_runs || 0;
    const totalSuccesses = stats[0].total_successes || 0;
    const successRate = totalRuns > 0 ? (totalSuccesses / totalRuns) * 100 : 0;

    return {
      total_tasks: stats[0].total_tasks || 0,
      active_tasks: stats[0].active_tasks || 0,
      paused_tasks: stats[0].paused_tasks || 0,
      executions_today: executionsToday[0].count || 0,
      executions_this_week: executionsWeek[0].count || 0,
      executions_this_month: executionsMonth[0].count || 0,
      success_rate: Math.round(successRate * 100) / 100,
      average_duration: Math.round(avgDuration[0].avg || 0)
    };
  }

  async cleanupOldExecutions(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.database.execute(
      'DELETE FROM task_executions WHERE completed_at < ?',
      [cutoffDate]
    );

    return result.affectedRows || 0;
  }

  private inferTaskType(schedule: string): 'cron' | 'interval' | 'once' {
    // Simple heuristic to determine task type
    if (schedule.includes(' ') && schedule.split(' ').length >= 5) {
      return 'cron';
    } else if (schedule.match(/^\d+[smhd]$/)) {
      return 'interval';
    } else {
      return 'once';
    }
  }

  private calculateNextRun(task: ScheduledTask): Date | undefined {
    const now = new Date();
    
    if (task.type === 'once') {
      return task.last_run ? undefined : now;
    }
    
    if (task.type === 'interval') {
      // Parse interval (e.g., "5m", "1h", "30s")
      const match = task.schedule.match(/^(\d+)([smhd])$/);
      if (!match) return undefined;
      
      const value = parseInt(match[1]);
      const unit = match[2];
      
      let intervalMs = 0;
      switch (unit) {
        case 's': intervalMs = value * 1000; break;
        case 'm': intervalMs = value * 60 * 1000; break;
        case 'h': intervalMs = value * 60 * 60 * 1000; break;
        case 'd': intervalMs = value * 24 * 60 * 60 * 1000; break;
      }
      
      const base = task.last_run || now;
      return new Date(base.getTime() + intervalMs);
    }
    
    // For cron, we'd use a cron parser library
    // For now, return a placeholder
    return new Date(now.getTime() + 60000); // 1 minute from now
  }

  private mapToTask(row: any): ScheduledTask {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      schedule: row.schedule,
      command: row.command,
      data: row.data ? JSON.parse(row.data) : undefined,
      status: row.status,
      enabled: row.enabled === 1,
      retries: row.retries,
      retry_delay: row.retry_delay,
      timeout: row.timeout,
      last_run: row.last_run ? new Date(row.last_run) : undefined,
      next_run: row.next_run ? new Date(row.next_run) : undefined,
      run_count: row.run_count,
      success_count: row.success_count,
      failure_count: row.failure_count,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  private mapToExecution(row: any): TaskExecution {
    return {
      id: row.id,
      task_id: row.task_id,
      status: row.status,
      started_at: new Date(row.started_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      duration: row.duration,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      retry_count: row.retry_count,
      logs: row.logs
    };
  }
}