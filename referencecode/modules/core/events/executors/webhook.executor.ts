import { Service, Inject, Container } from 'typedi';
import { BaseEventExecutor } from './base.executor.js';
import {
  ExecutorType,
} from '../types/index.js';
import type {
  Event,
  EventExecution,
  ExecutionResult,
  ExecutorCapabilities,
} from '../types/index.js';
import type { ILogger } from '../../logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';

/**
 * Webhook executor - triggers webhooks when events occur
 */
@Service()
export class WebhookExecutor extends BaseEventExecutor {
  readonly type = ExecutorType.WEBHOOK;

  constructor(@Inject(TYPES.Logger) private readonly logger: ILogger) {
    super();
  }

  /**
   * Execute webhook event by triggering the webhook module
   */
  async execute(event: Event, execution: EventExecution): Promise<ExecutionResult> {
    try {
      // Get webhook service from container
      const webhookService = Container.get<{
        triggerWebhook: (
          event: string,
          data?: Record<string, unknown>,
          metadata?: Record<string, unknown>,
        ) => Promise<void>;
      }>('WebhookService');

      if (!webhookService) {
        throw new Error('WebhookService not available');
      }

      // Trigger webhooks for this event
      await webhookService.triggerWebhook(event.type, event.data, {
        ...event.metadata,
        event_id: event.id,
        execution_id: execution.id,
        trigger_type: event.trigger_type,
        trigger_id: event.trigger_id,
      });

      return this.success({
        message: 'Webhooks triggered successfully',
        event_type: event.type,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to execute webhook', { error: errorMessage, event_id: event.id });

      // Webhook failures should retry
      return this.failure(errorMessage, true, this.calculateRetryDelay(execution.retry_count));
    }
  }

  /**
   * Validate webhook executor configuration
   */
  override async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    // Webhook executor doesn't need specific configuration
    // The webhook module handles the actual webhook configurations
    void config; // Explicitly mark as intentionally unused
    return true;
  }

  /**
   * Get executor capabilities
   */
  getCapabilities(): ExecutorCapabilities {
    return {
      supportsAsync: true,
      supportsRetry: true,
      supportsTimeout: true,
      maxConcurrency: 100,
      requiredPermissions: ['webhook:trigger'],
    };
  }
}
