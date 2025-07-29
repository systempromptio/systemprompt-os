/**
 * Users module - User management system.
 * @file Users module entry point.
 * @module modules/core/users
 */

import {
 type IModule, ModulesStatus, ModulesType
} from '@/modules/core/modules/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { IUsersModuleExports } from '@/modules/core/users/types/index';
import { getModuleRegistry } from '@/modules/core/modules/index';
import { ModuleName } from '@/modules/types/module-names.types';

/**
 * Users module implementation.
 */
export class UsersModule implements IModule<IUsersModuleExports> {
  public readonly name = 'users' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'User management system';
  public readonly dependencies = ['logger', 'database', 'auth'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private usersService!: UsersService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IUsersModuleExports {
    return {
      service: (): UsersService => {
        return this.getService();
      },
    };
  }

  /**
   * Initialize the users module.
   * @throws {Error} If the module is already initialized or initialization fails.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Users module already initialized');
    }

    this.logger = LoggerService.getInstance();
    this.usersService = UsersService.getInstance();

    try {
      await this.usersService.initialize();
      this.initialized = true;
      this.logger.info(LogSource.AUTH, 'Users module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize users module: ${errorMessage}`);
    }
  }

  /**
   * Start the users module.
   * @throws {Error} If the module is not initialized.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Users module not initialized');
    }

    if (this.started) {
      return;
    }

    this.status = ModulesStatus.RUNNING;
    this.started = true;
    this.logger.info(LogSource.AUTH, 'Users module started');
  }

  /**
   * Stop the users module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModulesStatus.STOPPED;
      this.started = false;
      this.logger.info(LogSource.AUTH, 'Users module stopped');
    }
  }

  /**
   * Health check for the users module.
   * @returns Promise resolving to health status object.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Users module not initialized',
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Users module not started',
      };
    }
    return {
      healthy: true,
      message: 'Users module is healthy',
    };
  }

  /**
   * Get the users service.
   * @returns The initialized UsersService instance.
   * @throws {Error} If the module is not initialized.
   */
  getService(): UsersService {
    if (!this.initialized) {
      throw new Error('Users module not initialized');
    }
    return this.usersService;
  }
}

/**
 * Factory function for creating the module.
 * @returns A new UsersModule instance.
 */
export const createModule = (): UsersModule => {
  return new UsersModule();
};

/**
 * Initialize function for core module pattern.
 * @returns Promise resolving to initialized UsersModule.
 */
export const initialize = async (): Promise<UsersModule> => {
  const usersModule = new UsersModule();
  await usersModule.initialize();
  return usersModule;
};

/**
 * Gets the Users module with type safety and validation.
 * @returns The Users module with guaranteed typed exports.
 * @throws {Error} If Users module is not available or missing required exports.
 */
export const getUsersModule = (): IModule<IUsersModuleExports> => {
  const registry = getModuleRegistry();
  const usersModule = registry.get(ModuleName.USERS) as IModule<IUsersModuleExports>;

  if (!usersModule) {
    throw new Error('Users module not found in registry');
  }

  if (!usersModule.exports) {
    throw new Error('Users module not properly initialized');
  }

  if (typeof usersModule.exports.service !== 'function') {
    throw new Error('Users module missing required service export');
  }

  return usersModule;
};

export default UsersModule;
