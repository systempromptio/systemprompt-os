/**
 * Config module - Auto-generated type-safe implementation.
 * @file Config module entry point with full Zod validation.
 * @module modules/core/config
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { ConfigService } from '@/modules/core/config/services/config.service';
import {
  ConfigModuleExportsSchema,
  ConfigServiceSchema,
  type IConfigModuleExports,
  type IConfigService
} from '@/modules/core/config/types/config.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Config module implementation using BaseModule.
 * Provides configuration management services with full Zod validation.
 */
export class ConfigModule extends BaseModule<IConfigModuleExports> {
  public readonly name = 'config' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Configuration management module for SystemPrompt OS';
  public readonly dependencies = ['logger', 'database'] as const;
  private configService!: ConfigService;
  get exports(): IConfigModuleExports {
    return {
      service: (): IConfigService => {
        this.ensureInitialized();
        return this.validateServiceStructure(
          this.configService,
          ConfigServiceSchema,
          'ConfigService'
        ) as IConfigService;
      },
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return ConfigModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.configService = ConfigService.getInstance();
    await this.configService.initialize();
  }
}

/**
 * Create and return a new config module instance.
 * @returns A new config module instance.
 */
export const createModule = (): ConfigModule => {
  return new ConfigModule();
};

/**
 * Export module instance.
 */
export const configModule = new ConfigModule();

/**
 * Initialize the config module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await configModule.initialize();
};
