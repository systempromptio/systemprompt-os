/**
 * Users module - User management system.
 * @file Users module entry point.
 * @module modules/core/users
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Strongly typed exports interface for Users module.
 */
export interface IUsersModuleExports {
  readonly service: () => UsersService;
}

/**
 * Users module implementation.
 */
export class UsersModule implements IModule<IUsersModuleExports> {
  public readonly name = 'users' as const;
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'User management system';
  public readonly dependencies = ['logger', 'database', 'auth'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private usersService!: UsersService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IUsersModuleExports {
    return {
      service: () => { return this.getService(); },
    };
  }

  /**
   * Initialize the users module.
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
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Users module not initialized');
    }

    if (this.started) {
      return;
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.AUTH, 'Users module started');
  }

  /**
   * Stop the users module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.AUTH, 'Users module stopped');
    }
  }

  /**
   * Health check for the users module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
 healthy: false,
message: 'Users module not initialized'
};
    }
    if (!this.started) {
      return {
 healthy: false,
message: 'Users module not started'
};
    }
    return {
 healthy: true,
message: 'Users module is healthy'
};
  }

  /**
   * Get the users service.
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
 */
export const createModule = (): UsersModule => {
  return new UsersModule();
};

/**
 * Initialize function for core module pattern.
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
export function getUsersModule(): IModule<IUsersModuleExports> {
  const { getModuleLoader } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/module-names.types');

  const moduleLoader = getModuleLoader();
  const usersModule = moduleLoader.getModule(ModuleName.USERS);

  if (!usersModule.exports?.service || typeof usersModule.exports.service !== 'function') {
    throw new Error('Users module missing required service export');
  }

  return usersModule as IModule<IUsersModuleExports>;
}

export default UsersModule;
