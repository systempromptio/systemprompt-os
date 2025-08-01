/**
 * Permissions module - Auto-generated type-safe implementation.
 * @file Permissions module entry point with full Zod validation.
 * @module modules/core/permissions
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/manual';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';
import {
  type IPermissionsModuleExports,
  PermissionsModuleExportsSchema,
  PermissionsServiceSchema
} from '@/modules/core/permissions/types/permissions.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Permissions module implementation using BaseModule.
 * Provides permissions management services with full Zod validation.
 */
export class PermissionsModule extends BaseModule<IPermissionsModuleExports> {
  public readonly name = 'permissions' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Role-based access control and permissions management';
  public readonly dependencies = ['logger', 'database'] as const;
  private permissionsService!: PermissionsService;
  get exports(): IPermissionsModuleExports {
    return {
      service: (): PermissionsService => {
        this.ensureInitialized();
        return this.validateServiceStructure(
          this.permissionsService,
          PermissionsServiceSchema,
          'PermissionsService'
        );
      },
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return PermissionsModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.permissionsService = PermissionsService.getInstance();

    await this.permissionsService.initialize();
  }
}

/**
 * Create and return a new permissions module instance.
 * @returns A new permissions module instance.
 */
export const createModule = (): PermissionsModule => {
  return new PermissionsModule();
};

/**
 * Export module instance.
 */
export const permissionsModule = new PermissionsModule();

/**
 * Initialize the permissions module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await permissionsModule.initialize();
};
