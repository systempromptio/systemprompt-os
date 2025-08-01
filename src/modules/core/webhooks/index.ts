import { ModulesType } from "@/modules/core/modules/types/database.generated";
/**
 * Webhooks module - Webhook management system.
 * @file Webhooks module entry point.
 * @module modules/core/webhooks
 */

import type { IModule } from '@/modules/core/modules/types/manual';
import { ModulesStatus } from "@/modules/core/modules/types/manual";
import type { ILogger } from '@/modules/core/logger/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { IWebhookService, IWebhooksModuleExports } from '@/modules/core/webhooks/types/index';

/**
 * Basic webhook service implementation.
 */
export class WebhookService implements IWebhookService {
  private static instance: WebhookService | undefined;

  /**
   * Get singleton instance.
   * @returns The WebhookService singleton instance.
   */
  static getInstance(): WebhookService {
    this.instance ||= new WebhookService();
    return this.instance;
  }

  /**
   * Initialize the webhook service.
   */
  async initialize(): Promise<void> {
    await Promise.resolve();
  }
}

/**
 * Webhooks module implementation.
 */
export class WebhooksModule implements IModule<IWebhooksModuleExports> {
  public readonly name = 'webhooks';
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Webhook management system';
  public readonly dependencies = ['logger', 'database', 'auth'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private webhookService!: WebhookService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IWebhooksModuleExports {
    return {
      service: (): WebhookService => { return this.getService() },
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
      return;
    }

    this.status = ModulesStatus.RUNNING;
    this.started = true;
    this.logger.info(LogSource.SYSTEM, 'Webhooks module started');
  }

  /**
   * Stop the webhooks module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModulesStatus.STOPPED;
      this.started = false;
      this.logger.info(LogSource.SYSTEM, 'Webhooks module stopped');
    }
  }

  /**
   * Health check for the webhooks module.
   * @returns Health check result with status and optional message.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Webhooks module not initialized'
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Webhooks module not started'
      };
    }
    return {
      healthy: true,
      message: 'Webhooks module is healthy'
    };
  }

  /**
   * Get the webhooks service.
   * @returns The WebhookService instance.
   * @throws {Error} If module is not initialized.
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
 * @returns A new WebhooksModule instance.
 */
export const createModule = (): WebhooksModule => {
  return new WebhooksModule();
};

/**
 * Initialize function for core module pattern.
 * @returns An initialized WebhooksModule instance.
 */
export const initialize = async (): Promise<WebhooksModule> => {
  const webhooksModule = new WebhooksModule();
  await webhooksModule.initialize();
  return webhooksModule;
};

/**
 * Gets the Webhooks module with type safety and validation.
 * @returns The Webhooks module with guaranteed typed exports.
 * @throws {Error} If Webhooks module is not available or missing required exports.
 */
export function getWebhooksModule(): IModule<IWebhooksModuleExports> {
  const { getModuleRegistry } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/module-names.types');

  const registry = getModuleRegistry();
  const webhooksModule = registry.get(ModuleName.WEBHOOKS);

  if (!webhooksModule) {
    throw new Error('Webhooks module not found');
  }

  const typedModule = webhooksModule as unknown as IModule<IWebhooksModuleExports>;

  if (!typedModule.exports?.service || typeof typedModule.exports.service !== 'function') {
    throw new Error('Webhooks module missing required service export');
  }

  return typedModule;
}

export default WebhooksModule;
