/**
 * Users module - Auto-generated type-safe implementation.
 * @file Users module entry point with full Zod validation.
 * @module modules/core/users
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import {
  type IUsersModuleExports,
  UsersModuleExportsSchema,
  UsersServiceSchema
} from '@/modules/core/users/types/users.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Users module implementation using BaseModule.
 * Provides users management services with full Zod validation.
 */
export class UsersModule extends BaseModule<IUsersModuleExports> {
  public readonly name = 'users' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Users management system';
  public readonly dependencies = ['logger', 'database'] as const;
  private usersService!: UsersService;
  get exports(): IUsersModuleExports {
    return {
      service: (): UsersService => {
        this.ensureInitialized();
        return this.validateServiceStructure(
          this.usersService,
          UsersServiceSchema,
          'UsersService'
        );
      },
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return UsersModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.usersService = UsersService.getInstance();

    await this.usersService.initialize();
  }
}

/**
 * Create and return a new users module instance.
 * @returns A new users module instance.
 */
export const createModule = (): UsersModule => {
  return new UsersModule();
};

/**
 * Export module instance.
 */
export const usersModule = new UsersModule();

/**
 * Initialize the users module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await usersModule.initialize();
};
