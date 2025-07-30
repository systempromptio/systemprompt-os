import { ModulesType } from "@/modules/core/modules/types/database.generated";
/**
 * System module - Core system management and configuration functionality.
 * @file System module entry point.
 * @module modules/core/system
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModulesStatus } from "@/modules/core/modules/types/database.generated";
import { SystemService } from '@/modules/core/system/services/system.service';
import { UrlConfigService } from '@/modules/core/system/services/url-config.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { ISystemModuleExports } from '@/modules/core/system/types/index';

/**
 * System module implementation.
 */
export class SystemModule implements IModule<ISystemModuleExports> {
  public readonly name = 'system';
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Core system management and configuration functionality';
  public readonly dependencies = ['logger', 'database'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private systemService!: SystemService;
  private urlConfigService!: UrlConfigService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): ISystemModuleExports {
    return {
      service: (): SystemService => { return this.getService() },
      urlConfigService: (): UrlConfigService => { return this.getUrlConfigService() },
    };
  }

  /**
   * Initialize the system module.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('System module already initialized');
    }

    this.logger = LoggerService.getInstance();
    this.systemService = SystemService.getInstance();
    this.urlConfigService = UrlConfigService.getInstance();

    try {
      await this.systemService.initialize();
      await this.urlConfigService.initialize();
      this.initialized = true;
      this.logger.info(LogSource.SYSTEM, 'System module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize system module: ${errorMessage}`);
    }
  }

  /**
   * Start the system module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('System module not initialized');
    }

    if (this.started) {
      return;
    }

    this.status = ModulesStatus.RUNNING;
    this.started = true;
    this.logger.info(LogSource.SYSTEM, 'System module started');
  }

  /**
   * Stop the system module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModulesStatus.STOPPED;
      this.started = false;
      this.logger.info(LogSource.SYSTEM, 'System module stopped');
    }
  }

  /**
   * Health check for the system module.
   * @returns The health check result.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'System module not initialized'
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'System module not started'
      };
    }
    return {
      healthy: true,
      message: 'System module is healthy'
    };
  }

  /**
   * Get the system service.
   * @returns The system service instance.
   * @throws {Error} If the module is not initialized.
   */
  getService(): SystemService {
    if (!this.initialized) {
      throw new Error('System module not initialized');
    }
    return this.systemService;
  }

  /**
   * Get the URL configuration service.
   * @returns The URL configuration service instance.
   * @throws {Error} If the module is not initialized.
   */
  getUrlConfigService(): UrlConfigService {
    if (!this.initialized) {
      throw new Error('System module not initialized');
    }
    return this.urlConfigService;
  }
}

/**
 * Factory function for creating the module.
 * @returns A new system module instance.
 */
export const createModule = (): SystemModule => {
  return new SystemModule();
};

/**
 * Initialize function for core module pattern.
 * @returns A promise that resolves to an initialized system module.
 */
export const initialize = async (): Promise<SystemModule> => {
  const systemModule = new SystemModule();
  await systemModule.initialize();
  return systemModule;
};

/**
 * Gets the System module with type safety and validation.
 * @returns The System module with guaranteed typed exports.
 * @throws {Error} If System module is not available or missing required exports.
 */
export const getSystemModule = (): IModule<ISystemModuleExports> => {
  throw new Error('getSystemModule requires async initialization - use module registry directly');
};

/**
 * Re-export ModulesStatus from modules/types to avoid conflicts.
 */
export { ModulesStatus } from '@/modules/core/modules/types/database.generated';

export default SystemModule;
