/**
 * Auth module - Auto-generated type-safe implementation.
 * @file Auth module entry point with full Zod validation.
 * @module modules/core/auth
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { TokenService } from '@/modules/core/auth/services/token.service';
import { ProvidersService } from '@/modules/core/auth/services/providers.service';
import {
  AuthModuleExportsSchema,
  AuthServiceSchema,
  type IAuthModuleExports
} from '@/modules/core/auth/types/auth.service.generated';
import type { IAuthModuleExportsExtended } from '@/modules/core/auth/types/manual';
import type { ZodSchema } from 'zod';

/**
 * Auth module implementation using BaseModule.
 * Provides authentication services with full Zod validation.
 */
export class AuthModule extends BaseModule<IAuthModuleExportsExtended> {
  public readonly name = 'auth' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Authentication and authorization system';
  public readonly dependencies = ['logger', 'database', 'events'] as const;
  private authService!: AuthService;
  private tokenService!: TokenService;
  private providersService!: ProvidersService;
  get exports(): IAuthModuleExportsExtended {
    return {
      service: (): AuthService => {
        this.ensureInitialized();
        return this.validateServiceStructure(
          this.authService,
          AuthServiceSchema,
          'AuthService'
        );
      },
      tokenService: (): TokenService => {
        this.ensureInitialized();
        return this.tokenService;
      },
      providersService: (): ProvidersService => {
        this.ensureInitialized();
        return this.providersService;
      },
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return AuthModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.authService = AuthService.getInstance();
    await this.authService.initialize();

    this.tokenService = TokenService.getInstance();
    this.providersService = new ProvidersService();
    await this.providersService.initialize();
  }
}

/**
 * Create and return a new auth module instance.
 * @returns A new auth module instance.
 */
export const createModule = (): AuthModule => {
  return new AuthModule();
};

/**
 * Export module instance.
 */
export const authModule = new AuthModule();

/**
 * Initialize the auth module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await authModule.initialize();
};

/**
 * Gets the Auth module with type safety and validation.
 * @returns The Auth module with guaranteed typed exports.
 * @throws {Error} If Auth module is not available or missing required exports.
 */
export const getAuthModule = (): AuthModule => {
  return authModule;
};
