import { ModulesType } from "@/modules/core/modules/types/database.generated";
/**
 * Permissions module - Role-based access control and permissions management.
 * @file Permissions module entry point.
 * @module modules/core/permissions
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModulesStatus } from "@/modules/core/modules/types/database.generated";
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';
import type { IPermissionsService } from '@/modules/core/permissions/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { getModuleRegistry } from '@/modules/core/modules/index';
import { ModuleName } from '@/modules/types/module-names.types';
import type { IPermissionsModuleExports } from '@/modules/core/permissions/types/index';

/**
 * Permissions module implementation.
 */
export class PermissionsModule implements IModule<IPermissionsModuleExports> {
  public readonly name = 'permissions';
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Role-based access control and permissions management';
  public readonly dependencies = ['logger', 'database', 'auth'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private permissionsService!: PermissionsService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IPermissionsModuleExports {
    return {
      service: (): IPermissionsService => { return this.getService() },
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
      return;
    }

    this.status = ModulesStatus.RUNNING;
    this.started = true;
    this.logger.info(LogSource.AUTH, 'Permissions module started');
  }

  /**
   * Stop the permissions module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModulesStatus.STOPPED;
      this.started = false;
      this.logger.info(LogSource.AUTH, 'Permissions module stopped');
    }
  }

  /**
   * Health check for the permissions module.
   * @returns Health status of the module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Permissions module not initialized',
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Permissions module not started',
      };
    }
    return {
      healthy: true,
      message: 'Permissions module is healthy',
    };
  }

  /**
   * Get the permissions service.
   * @returns The permissions service instance.
   * @throws Error if module is not initialized.
   */
  getService(): IPermissionsService {
    if (!this.initialized) {
      throw new Error('Permissions module not initialized');
    }
    return this.permissionsService;
  }
}

/**
 * Factory function for creating the module.
 * @returns A new PermissionsModule instance.
 */
export const createModule = (): PermissionsModule => {
  return new PermissionsModule();
};

/**
 * Initialize function for core module pattern.
 * @returns An initialized PermissionsModule instance.
 */
export const initialize = async (): Promise<PermissionsModule> => {
  const permissionsModule = new PermissionsModule();
  await permissionsModule.initialize();
  return permissionsModule;
};

/**
 * Gets the Permissions module with type safety and validation.
 * @returns The Permissions module with guaranteed typed exports.
 * @throws {Error} If Permissions module is not available or missing required exports.
 */
export const getPermissionsModule = (): IModule<IPermissionsModuleExports> => {
  const registry = getModuleRegistry();
  const permissionsModule = registry.get(ModuleName.PERMISSIONS) as unknown as IModule<IPermissionsModuleExports>;

  if (
    !permissionsModule
    || !permissionsModule.exports
    || !permissionsModule.exports.service
    || typeof permissionsModule.exports.service !== 'function'
  ) {
    throw new Error('Permissions module missing required service export');
  }

  return permissionsModule;
};

/**
 * Re-export enums for convenience.
 */
export {
  PermissionActionEnum
} from '@/modules/core/permissions/types/index';

export default PermissionsModule;
