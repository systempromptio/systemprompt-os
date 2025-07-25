/**
 * Dev module - Development tools and utilities.
 * @file Dev module entry point.
 * @module modules/core/dev
 */

import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import { DevService } from '@/modules/core/dev/services/dev.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Strongly typed exports interface for Dev module.
 */
export interface IDevModuleExports {
  readonly service: () => DevService;
}

/**
 * Dev module implementation.
 */
export class DevModule implements IModule<IDevModuleExports> {
  public readonly name = 'dev';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Development tools and utilities';
  public readonly dependencies = ['logger', 'database'];
  public status: ModuleStatus = 'stopped' as ModuleStatus;
  private devService!: DevService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IDevModuleExports {
    return {
      service: () => { return this.getService(); },
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
      throw new Error('Dev module already started');
    }

    this.status = 'running';
    this.started = true;
    this.logger.info(LogSource.SYSTEM, 'Dev module started');
  }

  /**
   * Stop the dev module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = 'stopped';
      this.started = false;
      this.logger.info(LogSource.SYSTEM, 'Dev module stopped');
    }
  }

  /**
   * Health check for the dev module.
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
 */
export const createModule = (): DevModule => {
  return new DevModule();
};

/**
 * Initialize function for core module pattern.
 */
export const initialize = async (): Promise<DevModule> => {
  const devModule = new DevModule();
  await devModule.initialize();
  return devModule;
};
