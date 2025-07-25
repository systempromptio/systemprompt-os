/**
 * Permissions module - Role-based access control and permissions management.
 * @file Permissions module entry point.
 * @module modules/core/permissions
 */

import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Strongly typed exports interface for Permissions module.
 */
export interface IPermissionsModuleExports {
  readonly service: () => PermissionsService;
}

/**
 * Permissions module implementation.
 */
export class PermissionsModule implements IModule<IPermissionsModuleExports> {
  public readonly name = 'permissions';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Role-based access control and permissions management';
  public readonly dependencies = ['logger', 'database', 'auth'];
  public status: ModuleStatus = 'stopped' as ModuleStatus;
  private permissionsService!: PermissionsService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;

  get exports(): IPermissionsModuleExports {
    return {
      service: () => { return this.getService(); },
    };
  }

  /**
   * Initialize the permissions module.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Permissions module already initialized');
    }

    this.logger = LoggerService.getInstance();
    this.permissionsService = PermissionsService.getInstance();

    try {
      await this.permissionsService.initialize();
      this.initialized = true;
      this.logger.info(LogSource.AUTH, 'Permissions module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize permissions module: ${errorMessage}`);
    }
  }

  /**
   * Start the permissions module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Permissions module not initialized');
    }

    if (this.started) {
      throw new Error('Permissions module already started');
    }

    this.status = 'running';
    this.started = true;
    this.logger.info(LogSource.AUTH, 'Permissions module started');
  }

  /**
   * Stop the permissions module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = 'stopped';
      this.started = false;
      this.logger.info(LogSource.AUTH, 'Permissions module stopped');
    }
  }

  /**
   * Health check for the permissions module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return { healthy: false, message: 'Permissions module not initialized' };
    }
    if (!this.started) {
      return { healthy: false, message: 'Permissions module not started' };
    }
    return { healthy: true, message: 'Permissions module is healthy' };
  }

  /**
   * Get the permissions service.
   */
  getService(): PermissionsService {
    if (!this.initialized) {
      throw new Error('Permissions module not initialized');
    }
    return this.permissionsService;
  }
}

/**
 * Factory function for creating the module.
 */
export const createModule = (): PermissionsModule => {
  return new PermissionsModule();
};

/**
 * Initialize function for core module pattern.
 */
export const initialize = async (): Promise<PermissionsModule> => {
  const permissionsModule = new PermissionsModule();
  await permissionsModule.initialize();
  return permissionsModule;
};

/**
 * Re-export enums for convenience.
 */
export {
  PermissionActionEnum
} from '@/modules/core/permissions/types/index';
