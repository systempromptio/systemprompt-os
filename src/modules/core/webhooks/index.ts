/**
 * Webhooks module - Webhook management system.
 * @file Webhooks module entry point.
 * @module modules/core/webhooks
 */

import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Basic webhook service interface.
 */
interface IWebhookService {
  initialize(): Promise<void>;
}

/**
 * Basic webhook service implementation.
 */
class WebhookService implements IWebhookService {
  private static instance: WebhookService;

  /**
   * Get singleton instance.
   */
  static getInstance(): WebhookService {
    if (!this.instance) {
      this.instance = new WebhookService();
    }
    return this.instance;
  }

  /**
   * Initialize the webhook service.
   */
  async initialize(): Promise<void> {
    // Basic initialization
    await Promise.resolve();
  }
}

/**
 * Strongly typed exports interface for Webhooks module.
 */
export interface IWebhooksModuleExports {
  readonly service: () => WebhookService;
}

/**
 * Webhooks module implementation.
 */
export class WebhooksModule implements IModule<IWebhooksModuleExports> {
  public readonly name = 'webhooks';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Webhook management system';
  public readonly dependencies = ['logger', 'database', 'auth'];
  public status: ModuleStatus = 'stopped' as ModuleStatus;
  private webhookService!: WebhookService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;

  get exports(): IWebhooksModuleExports {
    return {
      service: () => { return this.getService(); },
    };
  }

  /**
   * Initialize the webhooks module.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Webhooks module already initialized');
    }

    this.logger = LoggerService.getInstance();
    this.webhookService = WebhookService.getInstance();

    try {
      await this.webhookService.initialize();
      this.initialized = true;
      this.logger.info(LogSource.SYSTEM, 'Webhooks module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize webhooks module: ${errorMessage}`);
    }
  }

  /**
   * Start the webhooks module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Webhooks module not initialized');
    }

    if (this.started) {
      throw new Error('Webhooks module already started');
    }

    this.status = 'running';
    this.started = true;
    this.logger.info(LogSource.SYSTEM, 'Webhooks module started');
  }

  /**
   * Stop the webhooks module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = 'stopped';
      this.started = false;
      this.logger.info(LogSource.SYSTEM, 'Webhooks module stopped');
    }
  }

  /**
   * Health check for the webhooks module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return { healthy: false, message: 'Webhooks module not initialized' };
    }
    if (!this.started) {
      return { healthy: false, message: 'Webhooks module not started' };
    }
    return { healthy: true, message: 'Webhooks module is healthy' };
  }

  /**
   * Get the webhooks service.
   */
  getService(): WebhookService {
    if (!this.initialized) {
      throw new Error('Webhooks module not initialized');
    }
    return this.webhookService;
  }
}

/**
 * Factory function for creating the module.
 */
export const createModule = (): WebhooksModule => {
  return new WebhooksModule();
};

/**
 * Initialize function for core module pattern.
 */
export const initialize = async (): Promise<WebhooksModule> => {
  const webhooksModule = new WebhooksModule();
  await webhooksModule.initialize();
  return webhooksModule;
};