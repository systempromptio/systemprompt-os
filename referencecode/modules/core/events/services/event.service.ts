import { Service, Inject } from 'typedi';
import { nanoid } from 'nanoid';
import {
  EventStatus,
  EventPriority,
  EventTriggerType,
  ExecutorType,
  ScheduleType,
  HandlerType,
} from '../types/index.js';
import type {
  Event,
  EventExecution,
  EventHandler,
  EventListener,
  EventSchedule,
  EventQueryFilter,
  ExecutionResult,
  EventCondition,
  RetryPolicy,
} from '../types/index.js';
import type { ILogger } from '../../logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { EventRepository } from '../repositories/event.repository.js';
import { EventBus } from './event-bus.service.js';
import { ExecutorRegistry } from './executor-registry.service.js';

@Service()
export class EventService {
  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject() private readonly eventRepository: EventRepository,
    @Inject() private readonly eventBus: EventBus,
    @Inject() private readonly executorRegistry: ExecutorRegistry,
  ) {}

  /**
   * Create a new event
   */
  async createEvent(params: {
    name: string;
    type: string;
    priority?: EventPriority;
    data?: Record<string, any>;
    metadata?: Record<string, any>;
    trigger_type: EventTriggerType;
    trigger_id?: string;
    scheduled_at?: Date;
  }): Promise<Event> {
    const event: Event = {
      id: nanoid(),
      name: params.name,
      type: params.type,
      priority: params.priority || EventPriority.NORMAL,
      data: params.data || {},
      metadata: params.metadata || {},
      trigger_type: params.trigger_type,
      created_at: new Date(),
      updated_at: new Date(),
    };
    if (params.trigger_id) {
      event.trigger_id = params.trigger_id;
    }
    if (params.scheduled_at) {
      event.scheduled_at = params.scheduled_at;
    }

    // Save to database
    await this.eventRepository.create(event);

    // Emit event created
    await this.eventBus.emit('event.created', { event });

    // If not scheduled, process immediately
    if (!event.scheduled_at || event.scheduled_at <= new Date()) {
      await this.processEvent(event);
    }

    return event;
  }

  /**
   * Process an event by finding handlers and creating executions
   */
  async processEvent(event: Event): Promise<void> {
    try {
      // Find all handlers for this event type
      const handlers = await this.eventRepository.getHandlersForEvent(event.type);

      // Find all listeners matching this event
      const listeners = await this.eventRepository.getListenersForEvent(event.type);

      // Create executions for handlers
      for (const handler of handlers) {
        if (!handler.enabled) {continue;}

        // Check conditions
        if (handler.conditions && !this.checkConditions(event, handler.conditions)) {
          continue;
        }

        await this.createExecution(event, handler);
      }

      // Create executions for listeners
      for (const listener of listeners) {
        if (!listener.enabled) {continue;}

        // Check filter conditions
        if (
          listener.filter_conditions &&
          !this.checkConditions(event, listener.filter_conditions)
        ) {
          continue;
        }

        await this.createListenerExecution(event, listener);
      }

      // Emit event processed
      await this.eventBus.emit('event.processed', { event });
    } catch (error) {
      this.logger.error('Failed to process event', {
        event_id: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Emit event failed
      await this.eventBus.emit('event.failed', { event, error });
    }
  }

  /**
   * Create an execution for an event handler
   */
  private async createExecution(event: Event, handler: EventHandler): Promise<void> {
    const execution: EventExecution = {
      id: nanoid(),
      event_id: event.id,
      status: EventStatus.PENDING,
      started_at: new Date(),
      executor_type: handler.executor_type,
      executor_id: handler.id,
      context: {
        ...handler.configuration,
        handler_id: handler.id,
      },
      retry_count: 0,
      max_retries: handler.retry_policy?.max_attempts || 3,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Save execution
    await this.eventRepository.createExecution(execution);

    // Execute asynchronously
    this.executeAsync(execution, event);
  }

  /**
   * Create an execution for an event listener
   */
  private async createListenerExecution(event: Event, listener: EventListener): Promise<void> {
    // Map listener type to executor type
    const executorType = this.mapListenerToExecutor(listener.handler_type);

    const execution: EventExecution = {
      id: nanoid(),
      event_id: event.id,
      status: EventStatus.PENDING,
      started_at: new Date(),
      executor_type: executorType,
      executor_id: listener.id,
      context: {
        ...listener.handler_config,
        listener_id: listener.id,
      },
      retry_count: 0,
      max_retries: 3,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Save execution
    await this.eventRepository.createExecution(execution);

    // Execute asynchronously
    this.executeAsync(execution, event);
  }

  /**
   * Execute an event asynchronously
   */
  private async executeAsync(execution: EventExecution, event: Event): Promise<void> {
    try {
      // Get executor
      const executor = this.executorRegistry.getExecutor(execution.executor_type);
      if (!executor) {
        throw new Error(`Executor not found: ${execution.executor_type}`);
      }

      // Update status to processing
      await this.eventRepository.updateExecution(execution.id, {
        status: EventStatus.PROCESSING,
        started_at: new Date(),
      });

      // Execute
      const result = await executor.execute(event, execution);

      // Update execution based on result
      if (result.success) {
        const updateData: Parameters<typeof this.eventRepository.updateExecution>[1] = {
          status: EventStatus.COMPLETED,
          completed_at: new Date(),
          duration_ms: Date.now() - execution.started_at.getTime(),
        };
        if (result.data) {
          updateData.result = result.data;
        }
        await this.eventRepository.updateExecution(execution.id, updateData);

        // Emit execution completed
        await this.eventBus.emit('execution.completed', { execution, result });
      } else {
        await this.handleExecutionFailure(execution, event, result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.handleExecutionFailure(execution, event, {
        success: false,
        error: errorMessage,
        shouldRetry: true,
      });
    }
  }

  /**
   * Handle execution failure
   */
  private async handleExecutionFailure(
    execution: EventExecution,
    event: Event,
    result: ExecutionResult,
  ): Promise<void> {
    const shouldRetry = result.shouldRetry && execution.retry_count < execution.max_retries;

    if (shouldRetry) {
      // Calculate next retry time
      const nextRetryAt = new Date(Date.now() + (result.nextRetryDelay || 1000));

      const retryData: Parameters<typeof this.eventRepository.updateExecution>[1] = {
        status: EventStatus.RETRYING,
        retry_count: execution.retry_count + 1,
        next_retry_at: nextRetryAt,
      };
      if (result.error) {
        retryData.error = result.error;
      }
      await this.eventRepository.updateExecution(execution.id, retryData);

      // Schedule retry
      setTimeout(() => {
        this.retryExecution(execution.id, event);
      }, result.nextRetryDelay || 1000);
    } else {
      // Mark as failed
      const failData: Parameters<typeof this.eventRepository.updateExecution>[1] = {
        status: EventStatus.FAILED,
        completed_at: new Date(),
        duration_ms: Date.now() - execution.started_at.getTime(),
      };
      if (result.error) {
        failData.error = result.error;
      }
      await this.eventRepository.updateExecution(execution.id, failData);

      // Emit execution failed
      await this.eventBus.emit('execution.failed', { execution, error: result.error });
    }
  }

  /**
   * Retry an execution
   */
  private async retryExecution(executionId: string, event: Event): Promise<void> {
    const execution = await this.eventRepository.getExecution(executionId);
    if (!execution) {
      return;
    }

    // Re-execute
    await this.executeAsync(execution, event);
  }

  /**
   * Execute an event synchronously (wait for result)
   */
  async executeEvent(eventId: string): Promise<ExecutionResult> {
    const event = await this.eventRepository.getById(eventId);
    if (!event) {
      return {
        success: false,
        error: 'Event not found',
      };
    }

    // Create a single execution
    const execution: EventExecution = {
      id: nanoid(),
      event_id: event.id,
      status: EventStatus.PROCESSING,
      started_at: new Date(),
      executor_type: ExecutorType.SYNC,
      executor_id: ExecutorType.SYNC,
      context: {},
      retry_count: 0,
      max_retries: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Find appropriate executor based on event type
    const handlers = await this.eventRepository.getHandlersForEvent(event.type);
    if (handlers.length === 0) {
      return {
        success: false,
        error: 'No handlers found for event type',
      };
    }

    const handler = handlers[0]; // Use first handler
    if (!handler) {throw new Error('handler is required');}
    const executor = this.executorRegistry.getExecutor(handler.executor_type);

    if (!executor) {
      return {
        success: false,
        error: `Executor not found: ${handler.executor_type}`,
      };
    }

    // Execute synchronously
    execution.executor_type = handler.executor_type;
    execution.context = handler.configuration;

    return executor.execute(event, execution);
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<Event | null> {
    return this.eventRepository.getById(eventId);
  }

  /**
   * Query events
   */
  async queryEvents(filter: EventQueryFilter): Promise<{ events: Event[]; total: number }> {
    return this.eventRepository.query(filter);
  }

  /**
   * Get event executions
   */
  async getEventExecutions(eventId: string): Promise<EventExecution[]> {
    return this.eventRepository.getExecutions(eventId);
  }

  /**
   * Cancel an event
   */
  async cancelEvent(eventId: string): Promise<void> {
    const executions = await this.eventRepository.getExecutions(eventId);

    for (const execution of executions) {
      if (execution.status === EventStatus.PENDING || execution.status === EventStatus.PROCESSING) {
        await this.eventRepository.updateExecution(execution.id, {
          status: EventStatus.CANCELLED,
          completed_at: new Date(),
        });
      }
    }

    // Emit event cancelled
    await this.eventBus.emit('event.cancelled', { event_id: eventId });
  }

  /**
   * Register an event handler
   */
  async registerHandler(params: {
    event_type: string;
    executor_type: ExecutorType;
    configuration?: Record<string, unknown>;
    priority?: number;
    conditions?: EventCondition[];
    retry_policy?: RetryPolicy;
    timeout_ms?: number;
  }): Promise<EventHandler> {
    const handler: EventHandler = {
      id: nanoid(),
      event_type: params.event_type,
      executor_type: params.executor_type,
      configuration: params.configuration || {},
      priority: params.priority || 0,
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    if (params.conditions) {
      handler.conditions = params.conditions;
    }
    if (params.retry_policy) {
      handler.retry_policy = params.retry_policy;
    }
    if (params.timeout_ms !== undefined) {
      handler.timeout_ms = params.timeout_ms;
    }

    // Validate executor exists
    const executor = this.executorRegistry.getExecutor(handler.executor_type);
    if (!executor) {
      throw new Error(`Executor not found: ${handler.executor_type}`);
    }

    // Validate configuration
    const isValid = await executor.validateConfig(handler.configuration);
    if (!isValid) {
      throw new Error('Invalid handler configuration');
    }

    // Save handler
    await this.eventRepository.createHandler(handler);

    // Emit handler registered
    await this.eventBus.emit('handler.registered', { handler });

    return handler;
  }

  /**
   * Register an event listener
   */
  async registerListener(params: {
    event_pattern: string;
    handler_type: HandlerType;
    handler_config?: Record<string, unknown>;
    filter_conditions?: EventCondition[];
    priority?: number;
  }): Promise<EventListener> {
    const listener: EventListener = {
      id: nanoid(),
      event_pattern: params.event_pattern,
      handler_type: params.handler_type,
      handler_config: params.handler_config || {},
      priority: params.priority || 0,
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    if (params.filter_conditions) {
      listener.filter_conditions = params.filter_conditions;
    }

    // Save listener
    await this.eventRepository.createListener(listener);

    // Emit listener registered
    await this.eventBus.emit('listener.registered', { listener });

    return listener;
  }

  /**
   * Schedule an event
   */
  async scheduleEvent(params: {
    event_type: string;
    event_data?: Record<string, any>;
    schedule_type: ScheduleType;
    cron_expression?: string;
    interval_ms?: number;
    next_run_at: Date;
    timezone?: string;
  }): Promise<EventSchedule> {
    const schedule: EventSchedule = {
      id: nanoid(),
      event_type: params.event_type,
      event_data: params.event_data || {},
      schedule_type: params.schedule_type,
      next_run_at: params.next_run_at,
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    if (params.cron_expression) {
      schedule.cron_expression = params.cron_expression;
    }
    if (params.interval_ms !== undefined) {
      schedule.interval_ms = params.interval_ms;
    }
    if (params.timezone) {
      schedule.timezone = params.timezone;
    }

    // Validate schedule
    if (schedule.schedule_type === 'cron' && !schedule.cron_expression) {
      throw new Error('Cron expression required for cron schedule');
    }

    if (schedule.schedule_type === 'interval' && !schedule.interval_ms) {
      throw new Error('Interval required for interval schedule');
    }

    // Save schedule
    await this.eventRepository.createSchedule(schedule);

    // Emit schedule created
    await this.eventBus.emit('schedule.created', { schedule });

    return schedule;
  }

  /**
   * Process scheduled events
   */
  async processScheduledEvents(): Promise<void> {
    const schedules = await this.eventRepository.getDueSchedules();

    for (const schedule of schedules) {
      try {
        // Create event
        await this.createEvent({
          name: `scheduled.${schedule.event_type}`,
          type: schedule.event_type,
          data: schedule.event_data,
          metadata: {
            schedule_id: schedule.id,
            schedule_type: schedule.schedule_type,
          },
          trigger_type: EventTriggerType.SCHEDULED,
          trigger_id: schedule.id,
        });

        // Update schedule
        await this.eventRepository.updateSchedule(schedule.id, {
          last_run_at: new Date(),
          next_run_at: this.calculateNextRun(schedule),
        });
      } catch (error) {
        this.logger.error('Failed to process scheduled event', {
          schedule_id: schedule.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Calculate next run time for a schedule
   */
  private calculateNextRun(schedule: EventSchedule): Date {
    const now = new Date();

    switch (schedule.schedule_type) {
    case 'once':
      // Disable after running once
      return new Date('9999-12-31');

    case 'interval':
      return new Date(now.getTime() + (schedule.interval_ms || 0));

    case 'cron':
      // TODO: Implement cron parser
      // For now, just add 1 hour
      return new Date(now.getTime() + 3600000);

    default:
      return now;
    }
  }

  /**
   * Check if conditions match the event
   */
  private checkConditions(_event: Event, _conditions: any[]): boolean {
    // TODO: Implement condition checking
    return true;
  }

  /**
   * Map listener handler type to executor type
   */
  private mapListenerToExecutor(handlerType: string): string {
    switch (handlerType) {
    case 'webhook':
      return 'webhook';
    case 'workflow':
      return 'workflow';
    case 'command':
      return 'command';
    case 'function':
    default:
      return 'function';
    }
  }
}
