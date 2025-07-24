/**
 * @fileoverview Webhook delivery service handles HTTP requests and retries
 * @module modules/core/webhooks/services
 */

import { createHmac } from 'crypto';
import { Container } from 'typedi';
import type {
  WebhookConfig,
  WebhookPayload,
  WebhookDelivery,
  WebhookTestResult,
} from '../types/webhook.types.js';
import type { WebhookRepository } from '../repositories/webhook-repository.js';

export class WebhookDeliveryService {
  private readonly activeDeliveries: Map<string, AbortController> = new Map();

  constructor(
    private readonly repository: WebhookRepository,
    private readonly logger?: any,
  ) {}

  async deliver(webhook: WebhookConfig, payload: WebhookPayload): Promise<void> {
    if (webhook.status !== 'active') {
      this.logger?.debug('Skipping inactive webhook', { webhookId: webhook.id });
      return;
    }

    // Start delivery with retry logic
    this.deliverWithRetry(webhook, payload, 1);
  }

  async deliverOnce(webhook: WebhookConfig, payload: WebhookPayload): Promise<WebhookTestResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const deliveryKey = `${webhook.id}_test_${Date.now()}`;

    try {
      this.activeDeliveries.set(deliveryKey, controller);

      // Prepare request
      const { headers, body } = this.prepareRequest(webhook, payload);

      // Set timeout
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, webhook.timeout || 30000);

      // Make request
      const requestInit: RequestInit = {
        method: webhook.method,
        headers,
        signal: controller.signal,
      };
      
      if (webhook.method !== 'GET') {
        requestInit.body = body;
      }
      
      const response = await fetch(webhook.url, requestInit);

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const responseBody = await response.text();

      return {
        success: response.ok,
        status_code: response.status,
        response_body: responseBody,
        response_headers: Object.fromEntries(response.headers.entries()),
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        duration,
        error: error.name === 'AbortError' ? 'Request timeout' : error.message,
      };
    } finally {
      this.activeDeliveries.delete(deliveryKey);
    }
  }

  private async deliverWithRetry(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    attempt: number,
  ): Promise<void> {
    const startTime = Date.now();
    const controller = new AbortController();
    const deliveryKey = `${webhook.id}_${payload.event}_${Date.now()}`;

    try {
      this.activeDeliveries.set(deliveryKey, controller);

      // Prepare request
      const { headers, body } = this.prepareRequest(webhook, payload);

      // Set timeout
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, webhook.timeout || 30000);

      // Make request
      const requestInit: RequestInit = {
        method: webhook.method,
        headers,
        signal: controller.signal,
      };
      
      if (webhook.method !== 'GET') {
        requestInit.body = body;
      }
      
      const response = await fetch(webhook.url, requestInit);

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const responseBody = await response.text();

      // Record delivery
      await this.recordDelivery({
        webhook_id: webhook.id,
        event: payload.event,
        url: webhook.url,
        method: webhook.method,
        headers,
        payload,
        attempt,
        status_code: response.status,
        response_body: responseBody.substring(0, 10000), // Limit stored response
        response_headers: Object.fromEntries(response.headers.entries()),
        duration,
        delivered_at: new Date(),
        success: response.ok,
      });

      // Emit delivery event
      if (Container.has('EventBus')) {
        const eventBus = Container.get<any>('EventBus');
        await eventBus.emit('webhook.delivered', {
          webhookId: webhook.id,
          event: payload.event,
          success: response.ok,
          statusCode: response.status,
          duration,
          attempt,
        });
      }

      if (!response.ok && this.shouldRetry(webhook, attempt)) {
        this.scheduleRetry(webhook, payload, attempt + 1);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Record failed delivery
      // Delivery recorded but not used in this context
      await this.recordDelivery({
        webhook_id: webhook.id,
        event: payload.event,
        url: webhook.url,
        method: webhook.method,
        headers: {},
        payload,
        attempt,
        duration,
        error: error.name === 'AbortError' ? 'Request timeout' : error.message,
        delivered_at: new Date(),
        success: false,
      });

      // Emit delivery failure event
      if (Container.has('EventBus')) {
        const eventBus = Container.get<any>('EventBus');
        await eventBus.emit('webhook.delivery.failed', {
          webhookId: webhook.id,
          event: payload.event,
          error: error.name === 'AbortError' ? 'Request timeout' : error.message,
          duration,
          attempt,
        });
      }

      if (this.shouldRetry(webhook, attempt)) {
        this.scheduleRetry(webhook, payload, attempt + 1);
      }
    } finally {
      this.activeDeliveries.delete(deliveryKey);
    }
  }

  private prepareRequest(
    webhook: WebhookConfig,
    payload: WebhookPayload,
  ): { headers: Record<string, string>; body: string } {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SystemPrompt-Webhook/1.0',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Id': webhook.id,
      'X-Webhook-Timestamp': payload.timestamp.toISOString(),
      ...webhook.headers,
    };

    // Add authentication
    if (webhook.auth) {
      switch (webhook.auth.type) {
        case 'basic':
          if (webhook.auth.credentials?.username && webhook.auth.credentials?.password) {
            const auth = Buffer.from(
              `${webhook.auth.credentials.username}:${webhook.auth.credentials.password}`,
            ).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
          }
          break;

        case 'bearer':
          if (webhook.auth.credentials?.token) {
            headers['Authorization'] = `Bearer ${webhook.auth.credentials.token}`;
          }
          break;

        case 'api-key':
          if (webhook.auth.credentials?.api_key && webhook.auth.credentials?.header_name) {
            headers[webhook.auth.credentials.header_name] = webhook.auth.credentials.api_key;
          }
          break;

        case 'hmac':
          if (webhook.auth.credentials?.secret) {
            const signature = createHmac('sha256', webhook.auth.credentials.secret)
              .update(body)
              .digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
          }
          break;
      }
    }

    return { headers, body };
  }

  private shouldRetry(webhook: WebhookConfig, attempt: number): boolean {
    return webhook.retry?.enabled === true && attempt < (webhook.retry.max_attempts || 3);
  }

  private scheduleRetry(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    nextAttempt: number,
  ): void {
    const delay = this.calculateRetryDelay(webhook, nextAttempt);

    this.logger?.debug('Scheduling webhook retry', {
      webhookId: webhook.id,
      attempt: nextAttempt,
      delay,
    });

    setTimeout(() => {
      this.deliverWithRetry(webhook, payload, nextAttempt);
    }, delay);
  }

  private calculateRetryDelay(webhook: WebhookConfig, attempt: number): number {
    if (!webhook.retry) {
      return 5000; // Default 5 seconds
    }

    const { strategy, initial_delay, max_delay, multiplier } = webhook.retry;
    let delay: number;

    switch (strategy) {
      case 'exponential':
        delay = initial_delay * Math.pow(multiplier || 2, attempt - 1);
        break;

      case 'linear':
        delay = initial_delay * attempt;
        break;

      case 'fixed':
      default:
        delay = initial_delay;
        break;
    }

    // Apply max delay cap
    if (max_delay) {
      delay = Math.min(delay, max_delay);
    }

    return delay;
  }

  private async recordDelivery(delivery: Omit<WebhookDelivery, 'id'>): Promise<void> {
    try {
      await this.repository.recordDelivery(delivery);
    } catch (error) {
      this.logger?.error('Failed to record webhook delivery', { error });
    }
  }

  async cancelDelivery(webhookId: string): Promise<void> {
    // Cancel all active deliveries for this webhook
    for (const [key, controller] of this.activeDeliveries.entries()) {
      if (key.startsWith(webhookId)) {
        controller.abort();
        this.activeDeliveries.delete(key);
      }
    }
  }

  async cancelAllDeliveries(): Promise<void> {
    // Cancel all active deliveries
    for (const [, controller] of this.activeDeliveries.entries()) {
      controller.abort();
    }
    this.activeDeliveries.clear();
  }
}
