/**
 * @fileoverview Webhooks module for event-driven HTTP notifications
 * @module modules/core/webhooks
 */

import { WebhookService } from './services/webhook-service.js';
import { WebhookDeliveryService } from './services/webhook-delivery-service.js';
import { WebhookRepository } from './repositories/webhook-repository.js';
import type { ModuleInterface } from '../../../types/module.interface.js';

export class WebhooksModule implements ModuleInterface {
  name = 'webhooks';
  version = '1.0.0';
  type = 'service' as const;
  dependencies = ['database', 'logger'];

  private config: any;
  private logger: any;
  private webhookService?: WebhookService;
  private deliveryService?: WebhookDeliveryService;
  private repository?: WebhookRepository;
  private database?: any;
  private cleanupInterval?: NodeJS.Timer;

  async initialize(config: any, deps: any): Promise<boolean> {
    this.config = config;
    this.logger = deps.logger;

    try {
      // Initialize database adapter
      this.database = deps.database.getAdapter('webhooks');
      
      // Initialize repository and services
      this.repository = new WebhookRepository(this.database);
      this.deliveryService = new WebhookDeliveryService(this.repository, this.logger);
      this.webhookService = new WebhookService(
        this.repository,
        this.deliveryService,
        this.logger
      );

      this.logger?.info('Webhooks module initialized');
      return true;
    } catch (error) {
      this.logger?.error('Failed to initialize webhooks module', { error });
      return false;
    }
  }

  async start(): Promise<boolean> {
    try {
      // Start cleanup interval
      const cleanupInterval = this.config?.cleanup?.interval || 86400000; // 24 hours
      const retentionDays = this.config?.cleanup?.retentionDays || 30;

      this.cleanupInterval = setInterval(async () => {
        try {
          await this.webhookService?.cleanupOldDeliveries(retentionDays);
        } catch (error) {
          this.logger?.error('Webhook cleanup failed', { error });
        }
      }, cleanupInterval);
      
      this.logger?.info('Webhooks module started');
      return true;
    } catch (error) {
      this.logger?.error('Failed to start webhooks module', { error });
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      // Cancel all active deliveries
      if (this.deliveryService && this.deliveryService.cancelAllDeliveries) {
        await this.deliveryService.cancelAllDeliveries();
      }
      
      this.logger?.info('Webhooks module stopped');
      return true;
    } catch (error) {
      this.logger?.error('Error stopping webhooks module', { error });
      return false;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; checks: any }> {
    try {
      // Check database connection
      const dbHealthy = await this.database?.query('SELECT 1');
      
      const healthy = !!dbHealthy;
      
      return {
        healthy,
        checks: {
          services: healthy,
          database: healthy
        }
      };
    } catch (error) {
      return {
        healthy: false,
        checks: {
          services: false,
          database: false
        }
      };
    }
  }

  get exports() {
    return {
      WebhookService: this.webhookService,
      triggerWebhook: this.webhookService && this.webhookService.triggerWebhook ? 
        this.webhookService.triggerWebhook.bind(this.webhookService) : 
        undefined
    };
  }

  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'Event-driven webhook notifications',
      author: 'SystemPrompt OS Team'
    };
  }
}