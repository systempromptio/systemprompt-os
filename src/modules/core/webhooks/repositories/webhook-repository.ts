/**
 * @file Webhook repository interface and implementation.
 * @module modules/core/webhooks/repositories
 */

import type {
  CreateWebhookDto,
  UpdateWebhookDto,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryRecord,
  WebhookEvent,
  WebhookStats
} from '@/modules/core/webhooks/types/webhook.types';

/**
 * Webhook repository interface for persistence operations.
 */
export interface WebhookRepository {
    createWebhook(dto: CreateWebhookDto): Promise<Webhook>;

    getWebhook(id: string): Promise<Webhook | null>;

    listWebhooks(options?: {
    status?: string;
    event?: string;
    limit?: number;
    offset?: number;
  }): Promise<Webhook[]>;

    updateWebhook(id: string, dto: UpdateWebhookDto): Promise<Webhook>;

    deleteWebhook(id: string): Promise<boolean>;

    getWebhooksByEvent(event: WebhookEvent): Promise<Webhook[]>;

    getWebhookStats(): Promise<WebhookStats>;

    getWebhookDeliveries(webhookId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<WebhookDelivery[]>;

    cleanupOldDeliveries(retentionDays: number): Promise<number>;

    recordDelivery(deliveryRecord: WebhookDeliveryRecord): Promise<void>;

    getActiveWebhooks?(): Promise<Webhook[]>;

    getDeliveryHistory?(webhookId: string, limit?: number): Promise<WebhookDeliveryRecord[]>;
}
