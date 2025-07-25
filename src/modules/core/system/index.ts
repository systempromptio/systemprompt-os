/**
 * System module - Core system management and configuration functionality.
 * @file System module entry point.
 * @module modules/core/system
 */

import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import { SystemService } from '@/modules/core/system/services/system.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Strongly typed exports interface for System module.
 */
export interface ISystemModuleExports {
  readonly service: () => SystemService;
}

/**
 * System module implementation.
 */
export class SystemModule implements IModule<ISystemModuleExports> {
  public readonly name = 'system';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Core system management and configuration functionality';
  public readonly dependencies = ['logger', 'database'];
  public status: ModuleStatus = 'stopped' as ModuleStatus;
  private systemService!: SystemService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;

  get exports(): ISystemModuleExports {
    return {
      service: () => { return this.getService(); },
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

    try {
      await this.systemService.initialize();
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
      throw new Error('System module already started');
    }

    this.status = 'running';
    this.started = true;
    this.logger.info(LogSource.SYSTEM, 'System module started');
  }

  /**
   * Stop the system module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = 'stopped';
      this.started = false;
      this.logger.info(LogSource.SYSTEM, 'System module stopped');
    }
  }

  /**
   * Health check for the system module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return { healthy: false, message: 'System module not initialized' };
    }
    if (!this.started) {
      return { healthy: false, message: 'System module not started' };
    }
    return { healthy: true, message: 'System module is healthy' };
  }

  /**
   * Get the system service.
   */
  getService(): SystemService {
    if (!this.initialized) {
      throw new Error('System module not initialized');
    }
    return this.systemService;
  }
}

/**
 * Factory function for creating the module.
 */
export const createModule = (): SystemModule => {
  return new SystemModule();
};

/**
 * Initialize function for core module pattern.
 */
export const initialize = async (): Promise<SystemModule> => {
  const systemModule = new SystemModule();
  await systemModule.initialize();
  return systemModule;
};

/**
 * Re-export enums for convenience.
 */
export {
  ConfigTypeEnum,
  ModuleStatusEnum,
  EventSeverityEnum,
  MaintenanceTypeEnum
} from '@/modules/core/system/types/index';
