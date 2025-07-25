/**
 * Users module - User management system.
 * @file Users module entry point.
 * @module modules/core/users
 */

import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
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
  public readonly name = 'users';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'User management system';
  public readonly dependencies = ['logger', 'database', 'auth'];
  public status: ModuleStatus = 'stopped' as ModuleStatus;
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
      throw new Error('Users module already started');
    }

    this.status = 'running';
    this.started = true;
    this.logger.info(LogSource.AUTH, 'Users module started');
  }

  /**
   * Stop the users module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = 'stopped';
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
