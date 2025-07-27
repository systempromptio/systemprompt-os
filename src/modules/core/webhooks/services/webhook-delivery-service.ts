/**
 * @file Webhook delivery service implementation.
 * @description Service for delivering webhooks with retry logic and delivery tracking.
 * @module modules/core/webhooks/services
 */

import type { WebhookRepository } from '@/modules/core/webhooks/repositories/webhook-repository';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import type {
  IWebhookDeliveryService,
  Webhook,
  WebhookAuth,
  WebhookDeliveryRecord,
  WebhookDeliveryResult,
  WebhookPayload
} from '@/modules/core/webhooks/types/webhook.types';

/**
 * Service for delivering webhooks with retry logic and delivery tracking.
 */
export class WebhookDeliveryService implements IWebhookDeliveryService {
  private readonly activeDeliveries = new Map<string, AbortController>();

  /**
   * Creates an instance of WebhookDeliveryService.
   * @param repository - The webhook repository.
   * @param logger - The logger instance.
   */
  constructor(
    private readonly repository: WebhookRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Deliver a webhook once without retry logic.
   * @param webhook - Webhook configuration.
   * @param payload - Payload to send.
   * @returns Promise that resolves to delivery result.
   */
  async deliverOnce(webhook: Webhook, payload: WebhookPayload): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const deliveryKey = `${webhook.id}_${payload.event}_${Date.now()}`;
    const controller = new AbortController();

    this.activeDeliveries.set(deliveryKey, controller);

    try {
      const headers = this.buildHeaders(webhook, payload);

      const requestOptions: RequestInit = {
        method: webhook.method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      };

      if (webhook.timeout) {
        setTimeout(() => { controller.abort(); }, webhook.timeout);
      }

      const response = await fetch(webhook.url, requestOptions);
      const responseBody = await response.text();
      const duration = Date.now() - startTime;

      const result: WebhookDeliveryResult = {
        success: response.ok,
        status_code: response.status,
        response_body: responseBody,
        duration
      };

      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = String(error);
      }

      return {
        success: false,
        error: errorMessage,
        duration
      };
    } finally {
      this.activeDeliveries.delete(deliveryKey);
    }
  }

  /**
   * Deliver a webhook with retry logic and delivery recording.
   * @param webhook - Webhook configuration.
   * @param payload - Payload to send.
   * @returns Promise that resolves when delivery is complete.
   */
  async deliver(webhook: Webhook, payload: WebhookPayload): Promise<void> {
    if (webhook.status !== 'active') {
      this.logger.debug(LogSource.WEBHOOK, 'Skipping inactive webhook', { data: { webhookId: webhook.id } });
      return;
    }

    if (webhook.retry?.enabled) {
      await this.deliverWithRetry(webhook, payload);
    } else {
      await this.deliverSingle(webhook, payload);
    }
  }

  /**
   * Deliver webhook once and record the result.
   * @param webhook - Webhook configuration.
   * @param payload - Payload to send.
   */
  private async deliverSingle(webhook: Webhook, payload: WebhookPayload): Promise<void> {
    const result = await this.deliverOnce(webhook, payload);

    const deliveryRecord: WebhookDeliveryRecord = {
      webhook_id: webhook.id,
      attempt: 1,
      success: result.success,
      ...result.status_code !== undefined && { status_code: result.status_code },
      ...result.response_body !== undefined && { response_body: result.response_body },
      ...result.error !== undefined && { error: result.error },
      duration: result.duration,
      delivered_at: new Date()
    };

    await this.repository.recordDelivery(deliveryRecord);

    if (result.success) {
      this.logger.info(LogSource.WEBHOOK, 'Webhook delivered successfully', {
        data: {
          webhookId: webhook.id,
          event: payload.event,
          duration: result.duration
        }
      });
    } else {
      this.logger.error(LogSource.WEBHOOK, 'Webhook delivery failed', {
        error: result.error,
        data: {
          webhookId: webhook.id,
          event: payload.event,
          statusCode: result.status_code
        }
      });
    }
  }

  /**
   * Deliver webhook with retry logic.
   * @param webhook - Webhook configuration.
   * @param payload - Payload to send.
   */
  private async deliverWithRetry(webhook: Webhook, payload: WebhookPayload): Promise<void> {
    const maxAttempts = webhook.retry?.max_attempts || 3;
    const strategy = webhook.retry?.strategy || 'exponential';
    const initialDelay = webhook.retry?.initial_delay || 1000;
    const multiplier = webhook.retry?.multiplier || 2;
    const maxDelay = webhook.retry?.max_delay || 60000;

    let attempt = 1;
    let delay = initialDelay;

    while (attempt <= maxAttempts) {
      const result = await this.deliverOnce(webhook, payload);

      const deliveryRecord: WebhookDeliveryRecord = {
        webhook_id: webhook.id,
        attempt,
        success: result.success,
        ...result.status_code !== undefined && { status_code: result.status_code },
        ...result.response_body !== undefined && { response_body: result.response_body },
        ...result.error !== undefined && { error: result.error },
        duration: result.duration,
        delivered_at: new Date()
      };

      await this.repository.recordDelivery(deliveryRecord);

      if (result.success) {
        this.logger.info(LogSource.WEBHOOK, 'Webhook delivered successfully', {
          data: {
            webhookId: webhook.id,
            event: payload.event,
            attempt,
            duration: result.duration
          }
        });
        return;
      }

      if (attempt === maxAttempts) {
        this.logger.error(LogSource.WEBHOOK, 'Webhook delivery failed after all retry attempts', {
          error: result.error,
          data: {
            webhookId: webhook.id,
            event: payload.event,
            attempts: maxAttempts,
            finalStatusCode: result.status_code
          }
        });
        return;
      }

      this.logger.warn(LogSource.WEBHOOK, 'Webhook delivery failed, retrying', {
        error: result.error,
        data: {
          webhookId: webhook.id,
          event: payload.event,
          attempt,
          nextAttemptIn: delay
        }
      });

      await this.sleep(delay);

      if (strategy === 'exponential') {
        delay = Math.min(delay * multiplier, maxDelay);
      }

      attempt++;
    }
  }

  /**
   * Cancel all active deliveries for a specific webhook.
   * @param webhookId - The webhook ID to cancel deliveries for.
   */
  async cancelDelivery(webhookId: string): Promise<void> {
    const keysToCancel = Array.from(this.activeDeliveries.keys()).filter(key => { return key.startsWith(`${webhookId}_`) });

    for (const key of keysToCancel) {
      const controller = this.activeDeliveries.get(key);
      if (controller) {
        controller.abort();
        this.activeDeliveries.delete(key);
      }
    }

    this.logger.info(LogSource.WEBHOOK, 'Cancelled active deliveries for webhook', {
      data: {
        webhookId,
        cancelledCount: keysToCancel.length
      }
    });
  }

  /**
   * Cancel all active deliveries.
   */
  async cancelAllDeliveries(): Promise<void> {
    const cancelledCount = this.activeDeliveries.size;

    Array.from(this.activeDeliveries.values()).forEach(controller => {
      controller.abort();
    });

    this.activeDeliveries.clear();

    this.logger.info(LogSource.WEBHOOK, 'Cancelled all active deliveries', {
      data: { cancelledCount }
    });
  }

  /**
   * Build HTTP headers for webhook request.
   * @param webhook - Webhook configuration.
   * @param payload - Payload being sent.
   * @returns Headers object.
   */
  private buildHeaders(webhook: Webhook, payload: WebhookPayload): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event
    };

    if (webhook.headers) {
      Object.assign(headers, webhook.headers);
    }

    if (webhook.auth) {
      this.addAuthHeaders(headers, webhook.auth);
    }

    return headers;
  }

  /**
   * Add authentication headers based on auth configuration.
   * @param headers - Headers object to modify.
   * @param auth - Authentication configuration.
   */
  private addAuthHeaders(headers: Record<string, string>, auth: WebhookAuth): void {
    switch (auth.type) {
      case 'bearer':
        if (auth.credentials.token) {
          headers.Authorization = `Bearer ${auth.credentials.token}`;
        }
        break;
      case 'basic':
        if (auth.credentials.username && auth.credentials.password) {
          const credentials = Buffer.from(
            `${auth.credentials.username}:${auth.credentials.password}`
          ).toString('base64');
          headers.Authorization = `Basic ${credentials}`;
        }
        break;
      case 'api_key':
        if (auth.credentials.api_key) {
          headers['X-API-Key'] = auth.credentials.api_key;
        }
        break;
    }
  }

  /**
   * Sleep for specified milliseconds.
   * @param ms - Milliseconds to sleep.
   */
  private async sleep(ms: number): Promise<void> {
    await new Promise<void>(resolve => { return setTimeout(resolve, ms) });
  }
}
