/**
 * Core config module - provides configuration management.
 * @file Core config module - provides configuration management.
 * @module modules/core/config
 */

import { ConfigService } from '@/modules/core/config/services/config.service';
import type { IConfigService } from '@/modules/core/config/types/index';

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
      this.configService = ConfigService.getInstance();
      await this.configService.initialize();
      this.initialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize config module: ${errorMessage}`);
    }
  }

  /**
   * Start the config module.
   * @returns {void} Returns when started.
   * @throws {Error} If module not initialized or already started.
   */
  start(): void {
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
   * @returns {void} Returns when stopped.
   */
  stop(): void {
    if (this.started) {
      this.started = false;
      this.status = 'stopped';
    }
  }

  /**
   * Perform health check on the config module.
   * @returns {{ healthy: boolean; message?: string }} Health check result.
   */
  healthCheck(): {
    healthy: boolean;
    message?: string;
  } {
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
    if (this.configService === undefined) {
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

let moduleInstance: ConfigModule | undefined;

/**
 * Get singleton instance.
 * @returns {ConfigModule} Module instance.
 */
export const getInstance = (): ConfigModule => {
  moduleInstance ??= new ConfigModule();
  return moduleInstance;
};

/**
 * Initialize module with singleton pattern.
 * @returns {Promise<ConfigModule>} Initialized module.
 */
export const initialize = async (): Promise<ConfigModule> => {
  const configModule = getInstance();
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
