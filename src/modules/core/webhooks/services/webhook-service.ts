/**
 * @file Webhook service for managing webhooks and triggering events.
 * @module src/modules/core/webhooks/services
 * @description Provides comprehensive webhook management including creation, updates, deletion,
 * event triggering, and delivery tracking.
 */

import type { WebhookRepository } from '@/modules/core/webhooks/repositories/webhook-repository';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type {
  CreateWebhookDto,
  IWebhookDeliveryService,
  UpdateWebhookDto,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryResult,
  WebhookEvent,
  WebhookPayload,
  WebhookStats
} from '@/modules/core/webhooks/types/webhook.types';

/**
 * Webhook service for managing webhooks and triggering webhook events.
 */
export class WebhookService {
  /**
   * Creates an instance of WebhookService.
   * @param repository - The webhook repository for data access.
   * @param deliveryService - The service for delivering webhooks.
   * @param logger - The logger instance for logging operations.
   */
  constructor(
    private readonly repository: WebhookRepository,
    private readonly deliveryService: IWebhookDeliveryService,
    private readonly logger: ILogger
  ) {}

  /**
   * Create a new webhook.
   * @param dto - The webhook creation data transfer object.
   * @returns Promise that resolves to the created webhook.
   */
  async createWebhook(dto: CreateWebhookDto): Promise<Webhook> {
    try {
      if (!this.isValidUrl(dto.url)) {
        throw new Error('Invalid webhook URL');
      }

      if (dto.events === undefined || dto.events === null || dto.events.length === 0) {
        throw new Error('At least one event must be specified');
      }

      const webhook = await this.repository.createWebhook(dto);

      this.logger.info(LogSource.WEBHOOK, 'Webhook created', {
        metadata: {
          webhookId: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events
        }
      });

      return webhook;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(LogSource.WEBHOOK, 'Failed to create webhook', {
        error: errorMessage,
        data: { dto }
      });
      throw error;
    }
  }

  /**
   * Get a webhook by ID.
   * @param id - The webhook ID.
   * @returns Promise that resolves to the webhook or null if not found.
   */
  async getWebhook(id: string): Promise<Webhook | null> {
    return await this.repository.getWebhook(id);
  }

  /**
   * List all webhooks with optional filtering.
   * @param options - Optional filtering parameters.
   * @param options.status - Filter by webhook status.
   * @param options.event - Filter by webhook event.
   * @param options.limit - Maximum number of webhooks to return.
   * @param options.offset - Number of webhooks to skip.
   * @returns Promise that resolves to an array of webhooks.
   */
  async listWebhooks(options?: {
    status?: string;
    event?: string;
    limit?: number;
    offset?: number;
  }): Promise<Webhook[]> {
    return await this.repository.listWebhooks(options);
  }

  /**
   * Update a webhook.
   * @param id - The webhook ID.
   * @param dto - The webhook update data transfer object.
   * @returns Promise that resolves to the updated webhook.
   */
  async updateWebhook(id: string, dto: UpdateWebhookDto): Promise<Webhook> {
    try {
      if (dto.url && !this.isValidUrl(dto.url)) {
        throw new Error('Invalid webhook URL');
      }

      if (dto.events && dto.events.length === 0) {
        throw new Error('At least one event must be specified');
      }

      const webhook = await this.repository.updateWebhook(id, dto);

      this.logger.info(LogSource.WEBHOOK, 'Webhook updated', {
        data: {
          webhookId: webhook.id,
          updates: dto
        }
      });

      return webhook;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(LogSource.WEBHOOK, 'Failed to update webhook', {
        error: errorMessage,
        data: {
          webhookId: id,
          dto
        }
      });
      throw error;
    }
  }

  /**
   * Delete a webhook.
   * @param id - The webhook ID.
   * @returns Promise that resolves to true if deleted, false otherwise.
   */
  async deleteWebhook(id: string): Promise<boolean> {
    const result = await this.repository.deleteWebhook(id);

    if (result) {
      this.logger.info(LogSource.WEBHOOK, 'Webhook deleted', { data: { webhookId: id } });
    }

    return result;
  }

  /**
   * Trigger webhooks for a specific event.
   * @param event - The webhook event type.
   * @param data - The event data payload.
   * @returns Promise that resolves when all webhooks have been triggered.
   */
  async triggerWebhook(event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
    try {
      const webhooks = await this.repository.getWebhooksByEvent(event);

      if (webhooks.length === 0) {
        this.logger.debug(LogSource.WEBHOOK, 'No webhooks subscribed to event', { data: { event } });
        return;
      }

      const payload: WebhookPayload = {
        webhook_id: '',
        event,
        data,
        timestamp: new Date()
      };

      const deliveryPromises = webhooks.map(async (webhook: Webhook) => {
        const webhookPayload = {
          ...payload,
          webhook_id: webhook.id
        };
        try {
          await this.deliveryService.deliver(webhook, webhookPayload);
        } catch (error) {
          this.logger.error(LogSource.WEBHOOK, 'Webhook delivery failed', {
            data: {
              webhookId: webhook.id
            },
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.allSettled(deliveryPromises);

      this.logger.info(LogSource.WEBHOOK, 'Webhooks triggered', {
        data: {
          event,
          webhookCount: webhooks.length,
          payload: data
        }
      });
    } catch (error) {
      this.logger.error(LogSource.WEBHOOK, 'Failed to trigger webhooks', {
        data: { event },
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Test a webhook by sending a test payload.
   * @param id - The webhook ID.
   * @returns Promise that resolves to the delivery result.
   */
  async testWebhook(id: string): Promise<WebhookDeliveryResult> {
    const webhook = await this.repository.getWebhook(id);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      webhook_id: id,
      event: 'custom',
      data: {
        test: true,
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };

    return await this.deliveryService.deliverOnce(webhook, testPayload);
  }

  /**
   * Get webhook statistics.
   * @returns Promise that resolves to webhook statistics.
   */
  async getWebhookStats(): Promise<WebhookStats> {
    return await this.repository.getWebhookStats();
  }

  /**
   * Get webhook deliveries for a webhook.
   * @param webhookId - The webhook ID.
   * @param options - Optional pagination parameters.
   * @param options.limit - Maximum number of deliveries to return.
   * @param options.offset - Number of deliveries to skip.
   * @returns Promise that resolves to an array of webhook deliveries.
   */
  async getWebhookDeliveries(webhookId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<WebhookDelivery[]> {
    return await this.repository.getWebhookDeliveries(webhookId, options);
  }

  /**
   * Cleanup old webhook deliveries.
   * @param retentionDays - Number of days to retain deliveries.
   * @returns Promise that resolves to the number of deleted deliveries.
   */
  async cleanupOldDeliveries(retentionDays: number): Promise<number> {
    const deletedCount = await this.repository.cleanupOldDeliveries(retentionDays);

    if (deletedCount > 0) {
      this.logger.info(LogSource.WEBHOOK, 'Cleaned up old webhook deliveries', {
        data: {
          deleted: deletedCount,
          retentionDays
        }
      });
    }

    return deletedCount;
  }

  /**
   * Validate if a URL is valid.
   * @param url - The URL to validate.
   * @returns True if the URL is valid, false otherwise.
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
