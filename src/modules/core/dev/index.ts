/**
 * Dev module - Development tools and utilities.
 * @file Dev module entry point.
 * @module modules/core/dev
 */

import { BaseModule, ModulesType, ModulesStatus } from '@/modules/core/modules/types/manual';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { LogSource } from '@/modules/core/logger/types/manual';
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

  /**
   * Perform health check on the dev module.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!this.initialized) {
        return {
          healthy: false,
          message: 'Dev module not initialized'
        };
      }

      if (this.status !== ModulesStatus.RUNNING) {
        return {
          healthy: false,
          message: `Dev module status: ${this.status}`
        };
      }

      // Check if dev service is available and functioning
      if (!this.devService) {
        return {
          healthy: false,
          message: 'Dev service not available'
        };
      }

      return {
        healthy: true,
        message: 'Dev module is healthy and operational'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
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
