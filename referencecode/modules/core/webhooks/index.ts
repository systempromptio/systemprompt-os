/**
 * @fileoverview Webhooks module for event-driven HTTP notifications
 * @module modules/core/webhooks
 */

import { Service, Inject } from 'typedi';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { IDatabaseService } from '@/modules/core/database/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { WebhookService } from './services/webhook-service.js';
import { WebhookDeliveryService } from './services/webhook-delivery-service.js';
import { WebhookRepository } from './repositories/webhook-repository.js';

// Export types and tokens for external use
export * from './types/webhook.types.js';

@Service()
export class WebhooksModule implements IModule {
  name = 'webhooks';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;
  dependencies = ['database', 'logger'];

  private config: any;
  private webhookService?: WebhookService;
  private deliveryService?: WebhookDeliveryService;
  private repository?: WebhookRepository;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Database) private readonly database: IDatabaseService,
    @Inject(TYPES.Config) private readonly globalConfig: GlobalConfiguration,
  ) {}

  async initialize(): Promise<void> {
    this.config = this.globalConfig?.modules?.['webhooks'] || {};

    try {
      // Initialize database adapter
      const databaseAdapter = this.database;

      // Initialize repository and services
      this.repository = new WebhookRepository(databaseAdapter);
      this.deliveryService = new WebhookDeliveryService(this.repository, this.logger);
      this.webhookService = new WebhookService(this.repository, this.deliveryService, this.logger);

      this.logger.info('Webhooks module initialized');
    } catch (error) {
      this.logger.error('Failed to initialize webhooks module', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      // Start cleanup interval
      const cleanupInterval = this.config?.cleanup?.interval || 86400000; // 24 hours
      const retentionDays = this.config?.cleanup?.retentionDays || 30;

      this.cleanupInterval = setInterval(async () => {
        try {
          await this.webhookService?.cleanupOldDeliveries(retentionDays);
        } catch (error) {
          this.logger.error('Webhook cleanup failed', { error });
        }
      }, cleanupInterval);

      this.logger.info('Webhooks module started');
    } catch (error) {
      this.logger.error('Failed to start webhooks module', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        delete this.cleanupInterval;
      }

      // Cancel all active deliveries
      if (this.deliveryService?.cancelAllDeliveries) {
        await this.deliveryService.cancelAllDeliveries();
      }

      this.logger.info('Webhooks module stopped');
    } catch (error) {
      this.logger.error('Error stopping webhooks module', { error });
      // Don't throw on stop errors
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; checks: any }> {
    try {
      // Check database connection
      const dbHealthy = await this.database.get('SELECT 1 as healthy');

      const healthy = !!dbHealthy;

      return {
        healthy,
        checks: {
          services: healthy,
          database: healthy,
        },
      };
    } catch {
      return {
        healthy: false,
        checks: {
          services: false,
          database: false,
        },
      };
    }
  }

  get exports() {
    return {
      WebhookService: this.webhookService,
      triggerWebhook:
        this.webhookService?.triggerWebhook
          ? this.webhookService.triggerWebhook.bind(this.webhookService)
          : undefined,
    };
  }

  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'Event-driven webhook notifications',
      author: 'SystemPrompt OS Team',
    };
  }
}

// Export for dynamic loading
export default WebhooksModule;
