import { ModuleTypeEnum } from "@/modules/core/modules/types/index";
/**
 * Dev module - Development tools and utilities.
 * @file Dev module entry point.
 * @module modules/core/dev
 */

import { type IModule, ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { IDevModuleExports } from '@/modules/core/dev/types/index';

/**
 * Dev module implementation.
 */
export class DevModule implements IModule<IDevModuleExports> {
  public readonly name = 'dev';
  public readonly type = ModuleTypeEnum.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Development tools and utilities';
  public readonly dependencies = ['logger', 'database'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private devService!: DevService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IDevModuleExports {
    return {
      service: (): DevService => { return this.getService() }
    };
  }

  /**
   * Initialize the dev module.
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
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Dev module not initialized');
    }

    if (this.started) {
      return;
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.SYSTEM, 'Dev module started');
  }

  /**
   * Stop the dev module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.SYSTEM, 'Dev module stopped');
    }
  }

  /**
   * Health check for the dev module.
   * @returns Health check result with status and message.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Dev module not initialized'
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Dev module not started'
      };
    }
    return {
      healthy: true,
      message: 'Dev module is healthy'
    };
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
 * Gets the Dev module with type safety and validation.
 * @returns The Dev module with guaranteed typed exports.
 * @throws {Error} If Dev module is not available or missing required exports.
 */
export const getDevModule = (): IModule<IDevModuleExports> => {
  const moduleLoader = require('@/modules/loader').getModuleLoader() as ReturnType<
    typeof import('@/modules/loader').getModuleLoader
  >;
  const { ModuleName } = require('@/modules/types/module-names.types') as {
    ModuleName: typeof import('@/modules/types/module-names.types').ModuleName;
  };

  const devModule = moduleLoader.getModule(ModuleName.DEV);

  if (!('exports' in devModule) || typeof devModule.exports !== 'object' || devModule.exports === null) {
    throw new Error('Dev module missing exports property');
  }

  const moduleExports = devModule.exports as Record<string, unknown>;
  if (!('service' in moduleExports) || typeof moduleExports.service !== 'function') {
    throw new Error('Dev module missing required service export');
  }

  return devModule as unknown as IModule<IDevModuleExports>;
};

export default DevModule;
