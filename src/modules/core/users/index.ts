/**
 * Users module - Auto-generated type-safe implementation
 * @file Users module entry point with full Zod validation
 * @module modules/core/users
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IUsersModuleExports } from '@/modules/core/users/types/users.service.generated';
import { UsersModuleExportsSchema, UsersServiceSchema } from '@/modules/core/users/types/users.service.generated';
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
  
  /**
   * Get module exports with lazy initialization.
   */
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
   */
  protected getExportsSchema(): ZodSchema<any> {
    return UsersModuleExportsSchema;
  }
  
  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.usersService = UsersService.getInstance();
    
    if (this.logger) {
      this.usersService.setLogger(this.logger);
    }
    
    await this.usersService.initialize();
    
    this.logger?.info(LogSource.USERS, 'Users module initialized');
  }
  }

// Export module instance
export const usersModule = new UsersModule();
