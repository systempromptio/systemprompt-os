/**
 * Core config module - provides configuration management.
 * @file Core config module - provides configuration management.
 * @module modules/core/config
 */

import {
 type IModule, ModulesStatus, ModulesType
} from '@/modules/core/modules/types/index';
import { ConfigService } from '@/modules/core/config/services/config.service';
import type {
 ConfigValue, IConfigEntry, IConfigModuleExports, IConfigService
} from '@/modules/core/config/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Config module implementation.
 * @class ConfigModule
 */
export class ConfigModule implements IModule<IConfigModuleExports> {
  public readonly name = 'config';
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Configuration management module for SystemPrompt OS';
  public readonly dependencies = ['database', 'logger'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private configService!: ConfigService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IConfigModuleExports {
    return {
      service: (): IConfigService => { return this.configService; },
      get: async (key?: string): Promise<ConfigValue | IConfigEntry[]> => {
        return await this.get(key);
      },
      set: async (key: string, value: ConfigValue): Promise<void> => {
        await this.set(key, value);
      }
    };
  }

  /**
   * Initialize the config module.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Config module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();

      this.configService = ConfigService.getInstance();
      await this.configService.initialize();

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Config module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize config module: ${errorMessage}`);
    }
  }

  /**
   * Start the config module.
   * @returns {void} Synchronously starts the module.
   * @throws {Error} If module not initialized or already started.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Config module not initialized');
    }

    if (this.started) {
      return;
    }

    this.status = ModulesStatus.RUNNING;
    this.started = true;
    this.logger.info(LogSource.MODULES, 'Config module started');
  }

  /**
   * Stop the config module.
   * @returns {void} Synchronously stops the module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModulesStatus.STOPPED;
      this.started = false;
      this.logger.info(LogSource.MODULES, 'Config module stopped');
    }
  }

  /**
   * Perform health check on the config module.
   * @returns {{ healthy: boolean; message?: string }} Health check result.
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
   * Get configuration value(s).
   * @param {string | undefined} key - Configuration key. If undefined, returns all configuration.
   * @returns {Promise<ConfigValue | IConfigEntry[]>} Configuration value or all configuration.
   * @throws {Error} If module not initialized.
   */
  async get(key?: string): Promise<ConfigValue | IConfigEntry[]> {
    if (key === undefined) {
      return await this.configService.list();
    }

    return await this.configService.get(key);
  }

  /**
   * Set configuration value.
   * @param {string} key - Configuration key.
   * @param {ConfigValue} value - Configuration value.
   * @returns {Promise<void>} Promise that resolves when value is set.
   * @throws {Error} If module not initialized.
   */
  async set(key: string, value: ConfigValue): Promise<void> {
    await this.configService.set(key, value);
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
 * Initialize module.
 * @returns {Promise<ConfigModule>} Initialized module.
 */
export const initialize = async (): Promise<ConfigModule> => {
  const configModule = new ConfigModule();
  await configModule.initialize();
  return configModule;
};

/**
 * Gets the Config module with type safety and validation.
 * This should only be used after bootstrap when the module loader is available.
 * @returns The Config module with guaranteed typed exports.
 * @throws {Error} If Config module is not available or missing required exports.
 */
export async function getConfigModule(): Promise<IModule<IConfigModuleExports>> {
  const { getModuleRegistry } = await import('@/modules/core/modules/index');
  const { ModuleName } = await import('@/modules/types/index');

  const registry = getModuleRegistry();
  const configModule = registry.get(ModuleName.CONFIG);

  if (!configModule.exports?.service || typeof configModule.exports.service !== 'function') {
    throw new Error('Config module missing required service export');
  }

  if (!configModule.exports?.get || typeof configModule.exports.get !== 'function') {
    throw new Error('Config module missing required get export');
  }

  if (!configModule.exports?.set || typeof configModule.exports.set !== 'function') {
    throw new Error('Config module missing required set export');
  }

  return configModule as IModule<IConfigModuleExports>;
}

/**
 * Re-export ConfigService.
 */
export { ConfigService };

export default ConfigModule;
