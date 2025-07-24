import { Service, Inject } from 'typedi';
import { 
  EventStatus
} from '../types/index.js';
import type { 
  Event, 
  EventExecution, 
  EventHandler,
  EventListener,
  EventSchedule,
  EventStats,
  EventQueryFilter
} from '../types/index.js';
import type { IDatabaseService } from '../../database/types/index.js';
import { TYPES } from '@/modules/core/types.js';

@Service()
export class EventRepository {
  constructor(
    @Inject(TYPES.Database) private readonly db: IDatabaseService
  ) {}
  
  /**
   * Create an event
   */
  async create(event: Event): Promise<void> {
    await this.db.run(
      `INSERT INTO events (
        id, name, type, priority, data, metadata, 
        trigger_type, trigger_id, scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.name,
        event.type,
        event.priority,
        JSON.stringify(event.data),
        JSON.stringify(event.metadata),
        event.trigger_type,
        event.trigger_id,
        event.scheduled_at?.toISOString(),
        event.created_at.toISOString(),
        event.updated_at.toISOString()
      ]
    );
  }
  
  /**
   * Get event by ID
   */
  async getById(id: string): Promise<Event | null> {
    const row = await this.db.get(
      'SELECT * FROM events WHERE id = ?',
      [id]
    );
    
    return row ? this.rowToEvent(row) : null;
  }
  
  /**
   * Query events
   */
  async query(filter: EventQueryFilter): Promise<{ events: Event[]; total: number }> {
    let query = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];
    
    // Build filters
    if (filter.type) {
      if (Array.isArray(filter.type)) {
        query += ` AND type IN (${filter.type.map(() => '?').join(',')})`;
        params.push(...filter.type);
      } else {
        query += ' AND type = ?';
        params.push(filter.type);
      }
    }
    
    if (filter.priority) {
      if (Array.isArray(filter.priority)) {
        query += ` AND priority IN (${filter.priority.map(() => '?').join(',')})`;
        params.push(...filter.priority);
      } else {
        query += ' AND priority = ?';
        params.push(filter.priority);
      }
    }
    
    if (filter.trigger_type) {
      if (Array.isArray(filter.trigger_type)) {
        query += ` AND trigger_type IN (${filter.trigger_type.map(() => '?').join(',')})`;
        params.push(...filter.trigger_type);
      } else {
        query += ' AND trigger_type = ?';
        params.push(filter.trigger_type);
      }
    }
    
    if (filter.created_after) {
      query += ' AND created_at >= ?';
      params.push(filter.created_after.toISOString());
    }
    
    if (filter.created_before) {
      query += ' AND created_at <= ?';
      params.push(filter.created_before.toISOString());
    }
    
    // Count total
    const countResult = await this.db.get(
      query.replace('SELECT *', 'SELECT COUNT(*) as count'),
      params
    );
    const total = countResult?.count || 0;
    
    // Add ordering
    const orderBy = filter.order_by || 'created_at';
    const orderDir = filter.order_direction || 'desc';
    query += ` ORDER BY ${orderBy} ${orderDir}`;
    
    // Add pagination
    if (filter.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }
    
    if (filter.offset) {
      query += ' OFFSET ?';
      params.push(filter.offset);
    }
    
    // Execute query
    const rows = await this.db.all(query, params);
    const events = rows.map(row => this.rowToEvent(row));
    
    return { events, total };
  }
  
  /**
   * Create an execution
   */
  async createExecution(execution: EventExecution): Promise<void> {
    await this.db.run(
      `INSERT INTO event_executions (
        id, event_id, status, started_at, completed_at, duration_ms,
        executor_type, executor_id, context, result, error,
        retry_count, max_retries, next_retry_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        execution.id,
        execution.event_id,
        execution.status,
        execution.started_at.toISOString(),
        execution.completed_at?.toISOString(),
        execution.duration_ms,
        execution.executor_type,
        execution.executor_id,
        JSON.stringify(execution.context),
        execution.result ? JSON.stringify(execution.result) : null,
        execution.error,
        execution.retry_count,
        execution.max_retries,
        execution.next_retry_at?.toISOString(),
        execution.created_at.toISOString(),
        execution.updated_at.toISOString()
      ]
    );
  }
  
  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<EventExecution | null> {
    const row = await this.db.get(
      'SELECT * FROM event_executions WHERE id = ?',
      [id]
    );
    
    return row ? this.rowToExecution(row) : null;
  }
  
  /**
   * Get executions for an event
   */
  async getExecutions(eventId: string): Promise<EventExecution[]> {
    const rows = await this.db.all(
      'SELECT * FROM event_executions WHERE event_id = ? ORDER BY created_at DESC',
      [eventId]
    );
    
    return rows.map(row => this.rowToExecution(row));
  }
  
  /**
   * Update execution
   */
  async updateExecution(id: string, updates: Partial<EventExecution>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    
    if (updates.started_at !== undefined) {
      fields.push('started_at = ?');
      values.push(updates.started_at.toISOString());
    }
    
    if (updates.completed_at !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completed_at.toISOString());
    }
    
    if (updates.duration_ms !== undefined) {
      fields.push('duration_ms = ?');
      values.push(updates.duration_ms);
    }
    
    if (updates.result !== undefined) {
      fields.push('result = ?');
      values.push(JSON.stringify(updates.result));
    }
    
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }
    
    if (updates.retry_count !== undefined) {
      fields.push('retry_count = ?');
      values.push(updates.retry_count);
    }
    
    if (updates.next_retry_at !== undefined) {
      fields.push('next_retry_at = ?');
      values.push(updates.next_retry_at?.toISOString());
    }
    
    if (fields.length > 0) {
      values.push(id);
      await this.db.run(
        `UPDATE event_executions SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }
  
  /**
   * Get handlers for an event type
   */
  async getHandlersForEvent(eventType: string): Promise<EventHandler[]> {
    const rows = await this.db.all(
      'SELECT * FROM event_handlers WHERE event_type = ? AND enabled = 1 ORDER BY priority DESC',
      [eventType]
    );
    
    return rows.map(row => this.rowToHandler(row));
  }
  
  /**
   * Create a handler
   */
  async createHandler(handler: EventHandler): Promise<void> {
    await this.db.run(
      `INSERT INTO event_handlers (
        id, event_type, executor_type, configuration, priority,
        enabled, conditions, retry_policy, timeout_ms, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        handler.id,
        handler.event_type,
        handler.executor_type,
        JSON.stringify(handler.configuration),
        handler.priority,
        handler.enabled ? 1 : 0,
        handler.conditions ? JSON.stringify(handler.conditions) : null,
        handler.retry_policy ? JSON.stringify(handler.retry_policy) : null,
        handler.timeout_ms,
        handler.created_at.toISOString(),
        handler.updated_at.toISOString()
      ]
    );
  }
  
  /**
   * Get listeners matching an event
   */
  async getListenersForEvent(eventType: string): Promise<EventListener[]> {
    // Get all enabled listeners
    const rows = await this.db.all(
      'SELECT * FROM event_listeners WHERE enabled = 1 ORDER BY priority DESC'
    );
    
    // Filter by pattern matching
    const listeners = rows.map(row => this.rowToListener(row));
    return listeners.filter(listener => 
      this.matchesPattern(eventType, listener.event_pattern)
    );
  }
  
  /**
   * Create a listener
   */
  async createListener(listener: EventListener): Promise<void> {
    await this.db.run(
      `INSERT INTO event_listeners (
        id, event_pattern, handler_type, handler_config,
        filter_conditions, priority, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        listener.id,
        listener.event_pattern,
        listener.handler_type,
        JSON.stringify(listener.handler_config),
        listener.filter_conditions ? JSON.stringify(listener.filter_conditions) : null,
        listener.priority,
        listener.enabled ? 1 : 0,
        listener.created_at.toISOString(),
        listener.updated_at.toISOString()
      ]
    );
  }
  
  /**
   * Get due schedules
   */
  async getDueSchedules(): Promise<EventSchedule[]> {
    const now = new Date().toISOString();
    const rows = await this.db.all(
      'SELECT * FROM event_schedules WHERE enabled = 1 AND next_run_at <= ?',
      [now]
    );
    
    return rows.map(row => this.rowToSchedule(row));
  }
  
  /**
   * Create a schedule
   */
  async createSchedule(schedule: EventSchedule): Promise<void> {
    await this.db.run(
      `INSERT INTO event_schedules (
        id, event_type, event_data, schedule_type, cron_expression,
        interval_ms, next_run_at, last_run_at, enabled, timezone,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.event_type,
        JSON.stringify(schedule.event_data),
        schedule.schedule_type,
        schedule.cron_expression,
        schedule.interval_ms,
        schedule.next_run_at.toISOString(),
        schedule.last_run_at?.toISOString(),
        schedule.enabled ? 1 : 0,
        schedule.timezone,
        schedule.created_at.toISOString(),
        schedule.updated_at.toISOString()
      ]
    );
  }
  
  /**
   * Update a schedule
   */
  async updateSchedule(id: string, updates: Partial<EventSchedule>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.next_run_at !== undefined) {
      fields.push('next_run_at = ?');
      values.push(updates.next_run_at.toISOString());
    }
    
    if (updates.last_run_at !== undefined) {
      fields.push('last_run_at = ?');
      values.push(updates.last_run_at.toISOString());
    }
    
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    
    if (fields.length > 0) {
      values.push(id);
      await this.db.run(
        `UPDATE event_schedules SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }
  
  /**
   * Get event statistics
   */
  async getStats(eventType?: string): Promise<EventStats[]> {
    let query = 'SELECT * FROM event_stats';
    const params: any[] = [];
    
    if (eventType) {
      query += ' WHERE event_type = ?';
      params.push(eventType);
    }
    
    const rows = await this.db.all(query, params);
    return rows.map(row => this.rowToStats(row));
  }
  
  /**
   * Update event statistics
   */
  async updateStats(eventType: string, execution: EventExecution): Promise<void> {
    // This would typically be done by a background job or trigger
    // For now, we'll do a simple update
    const stats = await this.db.get(
      'SELECT * FROM event_stats WHERE event_type = ?',
      [eventType]
    );
    
    if (stats) {
      // Update existing stats
      await this.db.run(
        `UPDATE event_stats SET
          total_count = total_count + 1,
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          last_execution_at = ?,
          last_success_at = ?,
          last_failure_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE event_type = ?`,
        [
          execution.status === EventStatus.COMPLETED ? 1 : 0,
          execution.status === EventStatus.FAILED ? 1 : 0,
          execution.completed_at?.toISOString(),
          execution.status === EventStatus.COMPLETED ? execution.completed_at?.toISOString() : stats.last_success_at,
          execution.status === EventStatus.FAILED ? execution.completed_at?.toISOString() : stats.last_failure_at,
          eventType
        ]
      );
    } else {
      // Create new stats
      await this.db.run(
        `INSERT INTO event_stats (
          event_type, total_count, success_count, failure_count,
          average_duration_ms, last_execution_at, last_success_at,
          last_failure_at, updated_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          eventType,
          execution.status === EventStatus.COMPLETED ? 1 : 0,
          execution.status === EventStatus.FAILED ? 1 : 0,
          execution.duration_ms || 0,
          execution.completed_at?.toISOString(),
          execution.status === EventStatus.COMPLETED ? execution.completed_at?.toISOString() : null,
          execution.status === EventStatus.FAILED ? execution.completed_at?.toISOString() : null
        ]
      );
    }
  }
  
  /**
   * Check if event type matches pattern
   */
  private matchesPattern(eventType: string, pattern: string): boolean {
    const regexPattern = pattern
      .split('.')
      .map(part => part === '*' ? '[^.]+' : part)
      .join('\\.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventType);
  }
  
  // Row conversion methods
  
  private rowToEvent(row: any): Event {
    const event: Event = {
      id: row.id,
      name: row.name,
      type: row.type,
      priority: row.priority,
      data: JSON.parse(row.data || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      trigger_type: row.trigger_type,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
    if (row.trigger_id) {
      event.trigger_id = row.trigger_id;
    }
    if (row.scheduled_at) {
      event.scheduled_at = new Date(row.scheduled_at);
    }
    return event;
  }
  
  private rowToExecution(row: any): EventExecution {
    const execution: EventExecution = {
      id: row.id,
      event_id: row.event_id,
      status: row.status,
      started_at: new Date(row.started_at),
      executor_type: row.executor_type,
      executor_id: row.executor_id,
      context: JSON.parse(row.context || '{}'),
      retry_count: row.retry_count,
      max_retries: row.max_retries,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
    if (row.completed_at) {
      execution.completed_at = new Date(row.completed_at);
    }
    if (row.duration_ms !== null && row.duration_ms !== undefined) {
      execution.duration_ms = row.duration_ms;
    }
    if (row.result) {
      execution.result = JSON.parse(row.result);
    }
    if (row.error) {
      execution.error = row.error;
    }
    if (row.next_retry_at) {
      execution.next_retry_at = new Date(row.next_retry_at);
    }
    return execution;
  }
  
  private rowToHandler(row: any): EventHandler {
    return {
      id: row.id,
      event_type: row.event_type,
      executor_type: row.executor_type,
      configuration: JSON.parse(row.configuration || '{}'),
      priority: row.priority,
      enabled: Boolean(row.enabled),
      conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
      retry_policy: row.retry_policy ? JSON.parse(row.retry_policy) : undefined,
      timeout_ms: row.timeout_ms,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
  
  private rowToListener(row: any): EventListener {
    return {
      id: row.id,
      event_pattern: row.event_pattern,
      handler_type: row.handler_type,
      handler_config: JSON.parse(row.handler_config || '{}'),
      filter_conditions: row.filter_conditions ? JSON.parse(row.filter_conditions) : undefined,
      priority: row.priority,
      enabled: Boolean(row.enabled),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
  
  private rowToSchedule(row: any): EventSchedule {
    const schedule: EventSchedule = {
      id: row.id,
      event_type: row.event_type,
      event_data: JSON.parse(row.event_data || '{}'),
      schedule_type: row.schedule_type,
      next_run_at: new Date(row.next_run_at),
      enabled: Boolean(row.enabled),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
    if (row.cron_expression) {
      schedule.cron_expression = row.cron_expression;
    }
    if (row.interval_ms !== null && row.interval_ms !== undefined) {
      schedule.interval_ms = row.interval_ms;
    }
    if (row.last_run_at) {
      schedule.last_run_at = new Date(row.last_run_at);
    }
    if (row.timezone) {
      schedule.timezone = row.timezone;
    }
    return schedule;
  }
  
  private rowToStats(row: any): EventStats {
    const stats: EventStats = {
      event_type: row.event_type,
      total_count: row.total_count,
      success_count: row.success_count,
      failure_count: row.failure_count,
      pending_count: row.pending_count,
      average_duration_ms: row.average_duration_ms
    };
    if (row.last_execution_at) {
      stats.last_execution_at = new Date(row.last_execution_at);
    }
    if (row.last_success_at) {
      stats.last_success_at = new Date(row.last_success_at);
    }
    if (row.last_failure_at) {
      stats.last_failure_at = new Date(row.last_failure_at);
    }
    return stats;
  }
}