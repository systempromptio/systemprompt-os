/**
 * Core config module - provides configuration management.
 * @file Core config module - provides configuration management.
 * @module modules/core/config
 */

import { ConfigService } from '@/modules/core/config/services/config.service.js';
import type { IConfigService } from '@/modules/core/config/types/index.js';

/**
 * Config module implementation.
 * @class ConfigModule
 */
export class ConfigModule {
  public readonly name = 'config';
  public readonly type = 'core' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Configuration management module for SystemPrompt OS';
  public readonly dependencies = ['database'];
  public status: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
  private configService?: ConfigService;
  private initialized = false;
  private started = false;

  /**
   * Initialize the config module.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Config module already initialized');
    }

    try {
      this.configService = new ConfigService();
      await this.configService.initialize();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize config module: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start the config module.
   * @returns {Promise<void>} Promise that resolves when started.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Config module not initialized');
    }

    if (this.started) {
      throw new Error('Config module already started');
    }

    this.started = true;
    this.status = 'running';
  }

  /**
   * Stop the config module.
   * @returns {Promise<void>} Promise that resolves when stopped.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.started = false;
      this.status = 'stopped';
    }
  }

  /**
   * Perform health check on the config module.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
  }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Config module not initialized',
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Config module not started',
      };
    }
    return {
      healthy: true,
      message: 'Config module is healthy',
    };
  }

  /**
   * Get the config service.
   * @returns {IConfigService} Config service instance.
   * @throws {Error} If module not initialized.
   */
  getService(): IConfigService {
    if (!this.configService) {
      throw new Error('Config module not initialized');
    }
    return this.configService;
  }
}

/**
 * Factory function for creating the module.
 * @returns {ConfigModule} Config module instance.
 */
export const createModule = (): ConfigModule => {
  return new ConfigModule();
};

/**
 * Initialize function for core module pattern.
 * @returns {Promise<ConfigModule>} Initialized config module.
 */
export const initialize = async (): Promise<ConfigModule> => {
  const configModule = new ConfigModule();
  await configModule.initialize();
  return configModule;
};

/**
 * Re-export ConfigService.
 */
export { ConfigService };

/**
 * Default export of initialize for module pattern.
 */
export default initialize;
