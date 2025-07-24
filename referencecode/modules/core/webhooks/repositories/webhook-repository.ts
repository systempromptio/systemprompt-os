/**
 * @fileoverview Webhook repository for database operations
 * @module modules/core/webhooks/repositories
 */

import type { 
  WebhookConfig, 
  WebhookDelivery, 
  WebhookFilter,
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookStats
} from '../types/webhook.types.js';

export class WebhookRepository {
  constructor(private readonly database: any) {}

  async createWebhook(data: CreateWebhookDto): Promise<WebhookConfig> {
    const id = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const webhook: WebhookConfig = {
      id,
      name: data.name,
      url: data.url,
      method: data.method || 'POST',
      events: data.events,
      ...(data.headers && { headers: data.headers }),
      ...(data.auth && { auth: data.auth }),
      retry: data.retry || {
        enabled: true,
        max_attempts: 3,
        strategy: 'exponential',
        initial_delay: 1000,
        max_delay: 60000,
        multiplier: 2
      },
      timeout: data.timeout || 30000,
      status: 'active',
      metadata: data.metadata || {},
      created_at: now,
      updated_at: now
    };

    await this.database.insert('webhooks', {
      id,
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      events: JSON.stringify(webhook.events),
      headers: JSON.stringify(webhook.headers),
      auth: webhook.auth ? JSON.stringify(webhook.auth) : null,
      retry: JSON.stringify(webhook.retry),
      timeout: webhook.timeout,
      status: webhook.status,
      metadata: JSON.stringify(webhook.metadata),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    });

    return webhook;
  }

  async getWebhook(id: string): Promise<WebhookConfig | null> {
    const result = await this.database.select(
      'SELECT * FROM webhooks WHERE id = ?',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToWebhook(result.rows[0]);
  }

  async listWebhooks(filter?: WebhookFilter): Promise<WebhookConfig[]> {
    let query = 'SELECT * FROM webhooks WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.active !== undefined) {
      query += ' AND status = ?';
      params.push(filter.active ? 'active' : 'inactive');
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.database.select(query, params);
    return result.rows.map((row: any) => this.mapToWebhook(row));
  }

  async updateWebhook(id: string, data: UpdateWebhookDto): Promise<WebhookConfig | null> {
    const webhook = await this.getWebhook(id);
    if (!webhook) {
      return null;
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (data.name !== undefined) {updates.name = data.name;}
    if (data.url !== undefined) {updates.url = data.url;}
    if (data.method !== undefined) {updates.method = data.method;}
    if (data.events !== undefined) {updates.events = JSON.stringify(data.events);}
    if (data.headers !== undefined) {updates.headers = JSON.stringify(data.headers);}
    if (data.auth !== undefined) {updates.auth = JSON.stringify(data.auth);}
    if (data.retry !== undefined) {updates.retry = JSON.stringify(data.retry);}
    if (data.timeout !== undefined) {updates.timeout = data.timeout;}
    if (data.status !== undefined) {updates.status = data.status;}
    if (data.metadata !== undefined) {updates.metadata = JSON.stringify(data.metadata);}

    await this.database.update('webhooks', updates, { id });

    return this.getWebhook(id);
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const result = await this.database.delete('webhooks', { id });
    return result.changes > 0;
  }

  async recordDelivery(delivery: Omit<WebhookDelivery, 'id'>): Promise<void> {
    const id = `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await this.database.insert('webhook_deliveries', {
      id,
      webhook_id: delivery.webhook_id,
      event: delivery.event,
      url: delivery.url,
      method: delivery.method,
      headers: JSON.stringify(delivery.headers),
      payload: JSON.stringify(delivery.payload),
      attempt: delivery.attempt,
      status_code: delivery.status_code,
      response_body: delivery.response_body,
      response_headers: delivery.response_headers ? JSON.stringify(delivery.response_headers) : null,
      duration: delivery.duration,
      error: delivery.error,
      delivered_at: delivery.delivered_at.toISOString(),
      success: delivery.success ? 1 : 0
    });
  }

  async getWebhookDeliveries(
    webhookId: string,
    limit: number = 100
  ): Promise<WebhookDelivery[]> {
    const result = await this.database.select(
      `SELECT * FROM webhook_deliveries 
       WHERE webhook_id = ? 
       ORDER BY delivered_at DESC 
       LIMIT ?`,
      [webhookId, limit]
    );

    return result.rows.map((row: any) => this.mapToDelivery(row));
  }

  async getWebhookStats(webhookId: string): Promise<WebhookStats> {
    const result = await this.database.select(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(duration) as avg_duration,
        MAX(delivered_at) as last_delivery,
        MAX(CASE WHEN success = 1 THEN delivered_at ELSE NULL END) as last_success,
        MAX(CASE WHEN success = 0 THEN delivered_at ELSE NULL END) as last_failure
       FROM webhook_deliveries
       WHERE webhook_id = ?`,
      [webhookId]
    );

    const stats = result.rows[0] || {};

    return {
      webhook_id: webhookId,
      total_deliveries: stats.total || 0,
      successful_deliveries: stats.successful || 0,
      failed_deliveries: stats.failed || 0,
      average_duration: Math.round(stats.avg_duration || 0),
      ...(stats.last_delivery && { last_delivery: new Date(stats.last_delivery) }),
      ...(stats.last_success && { last_success: new Date(stats.last_success) }),
      ...(stats.last_failure && { last_failure: new Date(stats.last_failure) }),
      failure_rate: stats.total > 0 ? (stats.failed / stats.total) : 0
    };
  }

  async getWebhooksByEvent(event: string): Promise<WebhookConfig[]> {
    const result = await this.database.select(
      `SELECT * FROM webhooks 
       WHERE status = 'active' 
       AND events LIKE ?
       ORDER BY created_at`,
      [`%"${event}"%`]
    );

    return result.rows.map((row: any) => this.mapToWebhook(row));
  }

  async cleanupOldDeliveries(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.database.delete(
      'webhook_deliveries',
      { delivered_at: { $lt: cutoffDate.toISOString() } }
    );

    return result.changes;
  }

  private mapToWebhook(row: any): WebhookConfig {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      method: row.method,
      events: JSON.parse(row.events),
      headers: JSON.parse(row.headers),
      auth: row.auth ? JSON.parse(row.auth) : undefined,
      retry: JSON.parse(row.retry),
      timeout: row.timeout,
      status: row.status,
      metadata: JSON.parse(row.metadata),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  private mapToDelivery(row: any): WebhookDelivery {
    return {
      id: row.id,
      webhook_id: row.webhook_id,
      event: row.event,
      url: row.url,
      method: row.method,
      headers: JSON.parse(row.headers),
      payload: JSON.parse(row.payload),
      attempt: row.attempt,
      status_code: row.status_code,
      response_body: row.response_body,
      response_headers: row.response_headers ? JSON.parse(row.response_headers) : undefined,
      duration: row.duration,
      error: row.error,
      delivered_at: new Date(row.delivered_at),
      success: row.success === 1
    };
  }
}