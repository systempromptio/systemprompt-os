import { Container, Service, Inject } from 'typedi';
import type { IModule } from '../modules/types/index.js';
import { ModuleStatus } from '../modules/types/index.js';
import type { ILogger } from '../logger/types/index.js';
import { LOGGER_TOKEN } from '../logger/types/index.js';
import type { IDatabaseService } from '../database/types/index.js';
import { DATABASE_TOKEN } from '../database/types/index.js';
import { EventService } from './services/event.service.js';
import { EventTriggerType, ScheduleType, ExecutorType } from './types/index.js';
import type { EventExecution } from './types/index.js';
import { EventBus } from './services/event-bus.service.js';
import { EventRepository } from './repositories/event.repository.js';
import { WorkflowRepository } from './repositories/workflow.repository.js';

/**
 * Webhook received event data
 */
interface WebhookReceivedData {
  webhook_id: string;
  payload: Record<string, unknown>;
  source_ip: string;
  headers: Record<string, string>;
}

/**
 * Execution event data
 */
interface ExecutionEventData {
  execution: EventExecution;
}

// Export all types
export * from './types/index.js';

// Export services
export { EventService } from './services/event.service.js';
export { EventBus } from './services/event-bus.service.js';
export { ExecutorRegistry } from './services/executor-registry.service.js';

// Export repositories
export { EventRepository } from './repositories/event.repository.js';
export { WorkflowRepository } from './repositories/workflow.repository.js';

// Export executors
export { BaseEventExecutor } from './executors/base.executor.js';
export { WebhookExecutor } from './executors/webhook.executor.js';
export { CommandExecutor } from './executors/command.executor.js';
export { WorkflowExecutor } from './executors/workflow.executor.js';

@Service()
export class EventsModule implements IModule {
  /**
   * Start the module
   */
  async start(): Promise<void> {
    this.logger.info('Events module started');
  }

  /**
   * Stop the module
   */
  async stop(): Promise<void> {
    // Stop scheduler
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    this.logger.info('Events module stopped');
  }

  name = 'events';
  version = '1.0.0';
  dependencies = ['database', 'logger', 'auth'];
  status: ModuleStatus = ModuleStatus.PENDING;

  private schedulerInterval?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
    @Inject(DATABASE_TOKEN) private readonly database: IDatabaseService,
    @Inject() private readonly eventService: EventService,
    @Inject() private readonly eventBus: EventBus,
  ) {}

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Events module');

      // Initialize database schema
      await this.initializeDatabase();

      // Register services in container
      this.registerServices();

      // Set up internal event listeners
      this.setupInternalListeners();

      // Start scheduled event processor
      this.startScheduler();

      // Migrate existing scheduler tasks and workflows
      await this.migrateExistingData();

      this.status = ModuleStatus.RUNNING;
      this.logger.info('Events module initialized successfully');
    } catch (error) {
      this.status = ModuleStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize Events module', { error: errorMessage });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Events module');

    // Stop scheduler
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    // Clean up event listeners
    this.eventBus.removeAllListeners();

    this.status = ModuleStatus.STOPPED;
    this.logger.info('Events module shut down successfully');
  }

  private async initializeDatabase(): Promise<void> {
    // Database schema is created by the migration service
    // using the schema.sql file specified in module.yaml
    this.logger.info('Database schema initialized for Events module');
  }

  private registerServices(): void {
    // Services are already registered via @Service decorator
    // This is just for any additional registration logic

    // Register WebhookService adapter if webhooks module is available
    if (Container.has('WebhookService')) {
      this.logger.info('Webhooks module detected, integration enabled');
    }
  }

  private setupInternalListeners(): void {
    // Listen for webhook events and create corresponding events
    this.eventBus.on('webhook.received', async (data: unknown) => {
      const webhookData = data as WebhookReceivedData;
      try {
        await this.eventService.createEvent({
          name: `webhook.${webhookData.webhook_id}`,
          type: 'webhook.received',
          data: webhookData.payload,
          metadata: {
            webhook_id: webhookData.webhook_id,
            source_ip: webhookData.source_ip,
            headers: webhookData.headers,
          },
          trigger_type: EventTriggerType.WEBHOOK,
          trigger_id: webhookData.webhook_id,
        });
      } catch (error) {
        this.logger.error('Failed to create event for webhook', {
          error: error instanceof Error ? error.message : 'Unknown error',
          webhook_id: webhookData.webhook_id,
        });
      }
    });

    // Listen for execution completion to update stats
    this.eventBus.on('execution.completed', async (data: unknown) => {
      const execData = data as ExecutionEventData;
      const { execution } = execData;
      const event = await this.eventService.getEvent(execution.event_id);
      if (event) {
        const eventRepo = Container.get(EventRepository);
        await eventRepo.updateStats(event.type, execution);
      }
    });

    // Listen for execution failure to update stats
    this.eventBus.on('execution.failed', async (data: unknown) => {
      const execData = data as ExecutionEventData;
      const { execution } = execData;
      const event = await this.eventService.getEvent(execution.event_id);
      if (event) {
        const eventRepo = Container.get(EventRepository);
        await eventRepo.updateStats(event.type, execution);
      }
    });
  }

  private startScheduler(): void {
    const checkInterval = 10000; // 10 seconds, configurable

    this.schedulerInterval = setInterval(async () => {
      try {
        await this.eventService.processScheduledEvents();
      } catch (error) {
        this.logger.error('Error processing scheduled events', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, checkInterval);

    this.logger.info('Event scheduler started', { checkInterval });
  }

  private async migrateExistingData(): Promise<void> {
    try {
      // Check if scheduler module tables exist
      const hasSchedulerTables = await this.checkTableExists('scheduled_tasks');
      const hasWorkflowTables = await this.checkTableExists('workflows');

      if (hasSchedulerTables) {
        await this.migrateSchedulerTasks();
      }

      if (hasWorkflowTables) {
        await this.migrateWorkflows();
      }
    } catch (error) {
      this.logger.warn('Migration skipped', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.database.get(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?',
        [tableName],
      );
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Map schedule type string to enum
   */
  private mapScheduleType(type: string): ScheduleType {
    switch (type) {
    case 'cron':
      return ScheduleType.CRON;
    case 'interval':
      return ScheduleType.INTERVAL;
    case 'once':
      return ScheduleType.ONCE;
    default:
      return ScheduleType.ONCE;
    }
  }

  private async migrateSchedulerTasks(): Promise<void> {
    this.logger.info('Migrating scheduler tasks to events module');

    try {
      const tasks = await this.database.all<{
        id: string;
        name: string;
        command: string;
        timeout: number;
        retry_config?: string;
        schedule: {
          type: string;
          cron?: string;
          interval?: number;
        };
        next_run_at: string;
      }>('SELECT * FROM scheduled_tasks WHERE enabled = 1');

      for (const task of tasks) {
        // Create event schedule
        const scheduleEventParams: any = {
          event_type: 'task.execute',
          event_data: {
            name: task.name,
            command: task.command,
            task_config: {
              command: task.command,
              timeout_ms: task.timeout * 1000,
              retry_policy: task.retry_config ? JSON.parse(task.retry_config) : undefined,
            },
          },
          schedule_type: this.mapScheduleType(task.schedule.type),
          next_run_at: new Date(task.next_run_at),
        };

        if (task.schedule.cron) {
          scheduleEventParams.cron_expression = task.schedule.cron;
        }

        if (task.schedule.interval) {
          scheduleEventParams.interval_ms = task.schedule.interval;
        }

        await this.eventService.scheduleEvent(scheduleEventParams);

        // Register handler for task execution
        await this.eventService.registerHandler({
          event_type: 'task.execute',
          executor_type: ExecutorType.COMMAND,
          configuration: {
            task_id: task.id,
          },
          retry_policy: task.retry_config ? JSON.parse(task.retry_config) : undefined,
          timeout_ms: task.timeout * 1000,
        });
      }

      this.logger.info(`Migrated ${tasks.length} scheduler tasks`);
    } catch (error) {
      this.logger.error('Failed to migrate scheduler tasks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async migrateWorkflows(): Promise<void> {
    this.logger.info('Migrating workflows to events module');

    try {
      const workflows = await this.database.all<{
        id: string;
        name: string;
        description?: string;
        version: number;
        steps?: string;
        inputs?: string;
        outputs?: string;
        error_handling?: string;
        triggers?: string;
      }>('SELECT * FROM workflows WHERE is_active = 1');

      const workflowRepo = Container.get(WorkflowRepository);
      for (const workflow of workflows) {
        // Create workflow definition
        const workflowDefinition: any = {
          id: workflow.id,
          name: workflow.name,
          version: workflow.version,
          steps: JSON.parse(workflow.steps || '[]'),
          inputs: workflow.inputs ? JSON.parse(workflow.inputs) : undefined,
          outputs: workflow.outputs ? JSON.parse(workflow.outputs) : undefined,
          error_handling: workflow.error_handling ? JSON.parse(workflow.error_handling) : undefined,
        };

        if (workflow.description) {
          workflowDefinition.description = workflow.description;
        }

        await workflowRepo.create(workflowDefinition);

        // Register handler for workflow triggers
        const triggers = JSON.parse(workflow.triggers || '[]');
        for (const trigger of triggers) {
          if (trigger.type === 'event') {
            await this.eventService.registerHandler({
              event_type: trigger.event,
              executor_type: ExecutorType.WORKFLOW,
              configuration: {
                workflow_id: workflow.id,
              },
            });
          } else if (trigger.type === 'schedule') {
            await this.eventService.scheduleEvent({
              event_type: 'workflow.execute',
              event_data: {
                workflow_id: workflow.id,
              },
              schedule_type: this.mapScheduleType(trigger.schedule.type),
              cron_expression: trigger.schedule.cron,
              next_run_at: new Date(),
            });
          }
        }
      }

      this.logger.info(`Migrated ${workflows.length} workflows`);
    } catch (error) {
      this.logger.error('Failed to migrate workflows', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Register module
Container.set('EventsModule', EventsModule);
