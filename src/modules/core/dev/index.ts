/**
 * Dev module - Development tools and utilities.
 * @file Dev module entry point.
 * @module modules/core/dev
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { LogSource } from '@/modules/core/logger/types/index';
import {
  DevModuleExportsSchema,
  type IDevModuleExports
} from '@/modules/core/dev/types/dev.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Dev module implementation using BaseModule.
 * Provides development tools and utilities with full Zod validation.
 */
export class DevModule extends BaseModule<IDevModuleExports> {
  public readonly name = 'dev' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Development tools and utilities';
  public readonly dependencies = ['logger', 'database'] as const;
  private devService!: DevService;
  override get exports(): IDevModuleExports {
    return {
      service: (): DevService => {
        this.ensureInitialized();
        return this.devService;
      }
    } as any;
  }
  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected override getExportsSchema(): ZodSchema {
    return DevModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected override async initializeModule(): Promise<void> {
    this.devService = DevService.getInstance();
    await this.devService.initialize();
  }

  /**
   * Get the log source for this module.
   */
  protected override getLogSource(): LogSource {
    return LogSource.DEV;
  }

  /**
   * Get the dev service.
   * @returns The dev service instance.
   * @throws {Error} If module is not initialized.
   */
  getService(): DevService {
    this.ensureInitialized();
    return this.devService;
  }
}

/**
 * Factory function for creating the module.
 * @returns New instance of DevModule.
 */
export const createModule = (): DevModule => {
  return new DevModule();
};

export default DevModule;
export { DevService } from '@/modules/core/dev/services/dev.service';
