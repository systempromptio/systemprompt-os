/**
 * Dev module - Development tools and utilities.
 * @file Dev module entry point.
 * @module modules/core/dev
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModulesStatus, ModulesType } from '@/modules/core/modules/types/database.generated';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { IDevModuleExports } from '@/modules/core/dev/types/index';

/**
 * Dev module implementation.
 */
export class DevModule implements IModule<IDevModuleExports> {
  public readonly name = 'dev';
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Development tools and utilities';
  public readonly dependencies = ['logger', 'database'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private devService!: DevService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IDevModuleExports {
    return {
      service: (): DevService => { return this.getService(); }
    };
  }
  /**
   * Initialize the dev module.
   * @throws {Error} If module is already initialized or initialization fails.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Dev module already initialized');
    }

    this.logger = LoggerService.getInstance();
    this.devService = DevService.getInstance();

    try {
      await this.devService.initialize();
      this.initialized = true;
      this.logger.info(LogSource.SYSTEM, 'Dev module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize dev module: ${errorMessage}`);
    }
  }

  /**
   * Start the dev module.
   * @throws {Error} If module is not initialized.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Dev module not initialized');
    }

    if (this.started) {
      await Promise.resolve(); return;
    }

    const { RUNNING } = ModulesStatus;
    this.status = RUNNING;
    this.started = true;
    this.logger.info(LogSource.SYSTEM, 'Dev module started');
    await Promise.resolve();
  }

  /**
   * Stop the dev module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      const { STOPPED } = ModulesStatus;
      this.status = STOPPED;
      this.started = false;
      this.logger.info(LogSource.SYSTEM, 'Dev module stopped');
    }
    await Promise.resolve();
  }

  /**
   * Health check for the dev module.
   * @returns Health check result with status and message.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return await Promise.resolve({
        healthy: false,
        message: 'Dev module not initialized'
      });
    }
    if (!this.started) {
      return await Promise.resolve({
        healthy: false,
        message: 'Dev module not started'
      });
    }
    return await Promise.resolve({
      healthy: true,
      message: 'Dev module is healthy'
    });
  }

  /**
   * Get the dev service.
   * @returns The dev service instance.
   * @throws {Error} If module is not initialized.
   */
  getService(): DevService {
    if (!this.initialized) {
      throw new Error('Dev module not initialized');
    }
    return this.devService;
  }
}

/**
 * Factory function for creating the module.
 * @returns New instance of DevModule.
 */
export const createModule = (): DevModule => {
  return new DevModule();
};

/**
 * Initialize function for core module pattern.
 * @returns Initialized DevModule instance.
 */
export const initialize = async (): Promise<DevModule> => {
  const devModule = new DevModule();
  await devModule.initialize();
  return devModule;
};

/**
 * Singleton instance of DevModule.
 */
let devModuleInstance: DevModule | null = null;
let initializationPromise: Promise<DevModule> | null = null;

/**
 * Gets the Dev module with type safety and validation using singleton pattern.
 * Always returns an initialized module instance.
 * @returns The Dev module with guaranteed typed exports.
 * @throws {Error} If Dev module exports are invalid or missing service.
 */
export const getDevModule = (): IModule<IDevModuleExports> => {
  if (devModuleInstance && devModuleInstance.status !== ModulesStatus.PENDING) {
    return devModuleInstance;
  }

  if (!devModuleInstance) {
    devModuleInstance = new DevModule();
  }

  // Initialize synchronously if not already initialized
  if (!initializationPromise && devModuleInstance.status === ModulesStatus.PENDING) {
    initializationPromise = devModuleInstance.initialize().then(() => {
      initializationPromise = null;
      return devModuleInstance!;
    }).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  if (typeof devModuleInstance.exports.service !== 'function') {
    throw new Error(
      'Dev module missing required service export'
    );
  }

  return devModuleInstance;
};

/**
 * Gets the Dev module asynchronously with guaranteed initialization.
 * @returns Promise that resolves to the initialized Dev module.
 */
export const getDevModuleAsync = async (): Promise<IModule<IDevModuleExports>> => {
  if (devModuleInstance && devModuleInstance.status !== ModulesStatus.PENDING) {
    return devModuleInstance;
  }

  if (!devModuleInstance) {
    devModuleInstance = new DevModule();
  }

  if (devModuleInstance.status === ModulesStatus.PENDING) {
    if (!initializationPromise) {
      initializationPromise = devModuleInstance.initialize().then(() => {
        initializationPromise = null;
        return devModuleInstance!;
      }).catch((error) => {
        initializationPromise = null;
        throw error;
      });
    }
    await initializationPromise;
  }

  return devModuleInstance;
};

export default DevModule;
