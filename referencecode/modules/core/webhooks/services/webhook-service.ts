/**
 * @fileoverview Webhook management service
 * @module modules/core/webhooks/services
 */

import { Container } from 'typedi';
import type {
  WebhookConfig,
  WebhookEvent,
  WebhookPayload,
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookFilter,
  WebhookStats,
  WebhookTestResult,
} from '../types/webhook.types.js';
import type { WebhookRepository } from '../repositories/webhook-repository.js';
import type { WebhookDeliveryService } from './webhook-delivery-service.js';

export class WebhookService {
  constructor(
    private readonly repository: WebhookRepository,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly logger?: any,
  ) {}

  async createWebhook(data: CreateWebhookDto): Promise<WebhookConfig> {
    try {
      // Validate URL
      new URL(data.url);

      // Validate events
      if (!data.events || data.events.length === 0) {
        throw new Error('At least one event must be specified');
      }

      const webhook = await this.repository.createWebhook(data);

      this.logger?.info('Webhook created', {
        webhookId: webhook.id,
        name: webhook.name,
        events: webhook.events,
      });

      return webhook;
    } catch (error) {
      this.logger?.error('Failed to create webhook', { error, data });
      throw error;
    }
  }

  async getWebhook(id: string): Promise<WebhookConfig | null> {
    return this.repository.getWebhook(id);
  }

  async listWebhooks(filter?: WebhookFilter): Promise<WebhookConfig[]> {
    return this.repository.listWebhooks(filter);
  }

  async updateWebhook(id: string, data: UpdateWebhookDto): Promise<WebhookConfig | null> {
    try {
      // Validate URL if provided
      if (data.url) {
        new URL(data.url);
      }

      const webhook = await this.repository.updateWebhook(id, data);

      if (webhook) {
        this.logger?.info('Webhook updated', {
          webhookId: id,
          updates: Object.keys(data),
        });
      }

      return webhook;
    } catch (error) {
      this.logger?.error('Failed to update webhook', { error, id, data });
      throw error;
    }
  }

  async deleteWebhook(id: string): Promise<boolean> {
    try {
      const deleted = await this.repository.deleteWebhook(id);

      if (deleted) {
        this.logger?.info('Webhook deleted', { webhookId: id });
      }

      return deleted;
    } catch (error) {
      this.logger?.error('Failed to delete webhook', { error, id });
      throw error;
    }
  }

  async triggerWebhook(
    event: WebhookEvent,
    data: any,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Emit event to the events system
      if (Container.has('EventBus')) {
        const eventBus = Container.get<any>('EventBus');
        await eventBus.emit('webhook.triggered', {
          event,
          data,
          metadata,
          timestamp: new Date(),
        });
      }

      // Get all active webhooks subscribed to this event
      const webhooks = await this.repository.getWebhooksByEvent(event);

      if (webhooks.length === 0) {
        this.logger?.debug('No webhooks subscribed to event', { event });
        return;
      }

      // Create payload
      const payload: WebhookPayload = {
        webhook_id: '', // Will be set for each webhook
        event,
        timestamp: new Date(),
        data,
        ...(metadata && { metadata }),
      };

      // Trigger delivery for each webhook
      const promises = webhooks.map(async (webhook) => {
        payload.webhook_id = webhook.id;
        return this.deliveryService.deliver(webhook, payload);
      });

      // Fire and forget - don't wait for deliveries
      Promise.all(promises).catch((error) => {
        this.logger?.error('Error delivering webhooks', { error, event });
      });

      this.logger?.info('Webhooks triggered', {
        event,
        count: webhooks.length,
      });
    } catch (error) {
      this.logger?.error('Failed to trigger webhooks', { error, event });
      // Don't throw - webhook failures shouldn't break the main flow
    }
  }

  async testWebhook(id: string): Promise<WebhookTestResult> {
    try {
      const webhook = await this.getWebhook(id);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Create test payload
      const payload: WebhookPayload = {
        webhook_id: webhook.id,
        event: 'custom',
        timestamp: new Date(),
        data: {
          test: true,
          message: 'This is a test webhook delivery',
        },
        metadata: {
          test_id: `test_${Date.now()}`,
        },
      };

      const result = await this.deliveryService.deliverOnce(webhook, payload);

      this.logger?.info('Webhook tested', {
        webhookId: id,
        success: result.success,
      });

      return result;
    } catch (error) {
      this.logger?.error('Failed to test webhook', { error, id });
      throw error;
    }
  }

  async getWebhookStats(id: string): Promise<WebhookStats> {
    return this.repository.getWebhookStats(id);
  }

  async getWebhookDeliveries(id: string, limit?: number) {
    return this.repository.getWebhookDeliveries(id, limit);
  }

  async retryFailedDelivery(webhookId: string, deliveryId: string): Promise<void> {
    try {
      const webhook = await this.getWebhook(webhookId);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      const deliveries = await this.repository.getWebhookDeliveries(webhookId, 1000);
      const delivery = deliveries.find((d) => d.id === deliveryId);

      if (!delivery) {
        throw new Error('Delivery not found');
      }

      // Recreate payload from delivery record
      const payload: WebhookPayload = {
        webhook_id: webhook.id,
        event: delivery.event,
        timestamp: new Date(),
        data: delivery.payload.data,
        metadata: delivery.payload.metadata,
      };

      await this.deliveryService.deliver(webhook, payload);

      this.logger?.info('Webhook delivery retried', {
        webhookId,
        deliveryId,
      });
    } catch (error) {
      this.logger?.error('Failed to retry webhook delivery', {
        error,
        webhookId,
        deliveryId,
      });
      throw error;
    }
  }

  async pauseWebhook(id: string): Promise<void> {
    await this.updateWebhook(id, { status: 'inactive' });
  }

  async resumeWebhook(id: string): Promise<void> {
    await this.updateWebhook(id, { status: 'active' });
  }

  async cleanupOldDeliveries(retentionDays: number = 30): Promise<number> {
    try {
      const deleted = await this.repository.cleanupOldDeliveries(retentionDays);

      if (deleted > 0) {
        this.logger?.info('Cleaned up old webhook deliveries', {
          deleted,
          retentionDays,
        });
      }

      return deleted;
    } catch (error) {
      this.logger?.error('Failed to cleanup webhook deliveries', { error });
      throw error;
    }
  }
}
