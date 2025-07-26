/**
 * Modules module - Module lifecycle and registry management.
 * This is a self-contained core module that manages the discovery,
 * registration, and lifecycle of all extension modules.
 * @file Modules module entry point.
 * @module modules/core/modules
 */

import {
 type IModule, type IModuleInfo, ModuleStatusEnum
} from '@/modules/core/modules/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';

/**
 * Strongly typed exports interface for Modules module.
 */
export interface IModulesModuleExports {
  readonly service: () => ModuleManagerService | undefined;
  readonly scanForModules: () => Promise<any>;
  readonly getEnabledModules: () => Promise<IModuleInfo[]>;
  readonly getModule: (name: string) => Promise<IModuleInfo | undefined>;
  readonly enableModule: (name: string) => Promise<void>;
  readonly disableModule: (name: string) => Promise<void>;
  readonly registerCoreModule: (
    name: string,
    path: string,
    dependencies?: string[],
  ) => Promise<void>;
}

/**
 * Self-contained modules module for managing SystemPrompt OS modules.
 */
export class ModulesModule implements IModule<IModulesModuleExports> {
  public readonly name = 'modules';
  public readonly version = '1.0.0';
  public readonly type = 'service' as const;
  public readonly description = 'Module lifecycle and registry management';
  public readonly dependencies = ['logger', 'database'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private service!: ModuleManagerService;
  private logger!: ILogger;
  private database!: DatabaseService;
  private initialized = false;
  private started = false;
  get exports(): IModulesModuleExports {
    return {
      service: () => {
        return this.getService();
      },
      scanForModules: async () => {
        const svc = this.getService();
        return await svc.scanForModules();
      },
      getEnabledModules: async () => {
        const svc = this.getService();
        return await svc.getEnabledModules();
      },
      getModule: async (name: string) => {
        const svc = this.getService();
        return await svc.getModule(name);
      },
      enableModule: async (name: string) => {
        const svc = this.getService();
        await svc.enableModule(name);
      },
      disableModule: async (name: string) => {
        const svc = this.getService();
        await svc.disableModule(name);
      },
      registerCoreModule: async (name: string, path: string, dependencies: string[] = []) => {
        const svc = this.getService();
        await svc.registerCoreModule(name, path, dependencies);
      },
    };
  }

  /**
   * Initialize the modules module.
   */
  async initialize(): Promise<void> {
    this.database = DatabaseService.getInstance();
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Modules module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();
      this.database = DatabaseService.getInstance();

      const config = {
        modulesPath: './src/modules',
        injectablePath: './src/modules/extension',
        extensionsPath: './extensions',
      };

      this.service = ModuleManagerService.getInstance(config, this.logger, this.database);
      await this.service.initialize();

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Modules module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize Modules module: ${errorMessage}`);
    }
  }

  /**
   * Start the modules module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Modules module not initialized');
    }

    if (this.started) {
      return;
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.MODULES, 'Modules module started');
  }

  /**
   * Stop the modules module.
   */
  async stop(): Promise<void> {
    this.status = ModuleStatusEnum.STOPPED;
    this.started = false;
    this.logger.info(LogSource.MODULES, 'Modules module stopped');
  }

  /**
   * Health check.
   * @returns Health status and optional message.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Modules module not initialized'
      };
    }

    if (!this.started) {
      return {
        healthy: false,
        message: 'Modules module not started'
      };
    }

    return {
      healthy: true,
      message: 'Modules module is healthy'
    };
  }

  /**
   * Get the module manager service instance.
   * @returns The module manager service instance.
   * @throws {Error} If module not initialized.
   */
  getService(): ModuleManagerService {
    if (!this.initialized) {
      throw new Error('Modules module not initialized');
    }
    return this.service;
  }
}

/**
 * Factory function for creating the module.
 * @returns New ModulesModule instance.
 */
export const createModule = (): ModulesModule => {
  return new ModulesModule();
};

/**
 * Initialize function for core module pattern.
 * @returns Promise that resolves to the initialized module.
 */
export const initialize = async (): Promise<ModulesModule> => {
  const modulesModule = new ModulesModule();
  await modulesModule.initialize();
  return modulesModule;
};

/**
 * Gets the Modules module with type safety and validation.
 * @returns The Modules module with guaranteed typed exports.
 * @throws {Error} If Modules module is not available or missing required exports.
 */
export function getModulesModule(): IModule<IModulesModuleExports> {
  const { getModuleLoader } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/index');

  const moduleLoader = getModuleLoader();
  const modulesModule = moduleLoader.getModule(ModuleName.MODULES);

  if (!modulesModule.exports?.service || typeof modulesModule.exports.service !== 'function') {
    throw new Error('Modules module missing required service export');
  }

  if (!modulesModule.exports?.scanForModules || typeof modulesModule.exports.scanForModules !== 'function') {
    throw new Error('Modules module missing required scanForModules export');
  }

  if (!modulesModule.exports?.getEnabledModules || typeof modulesModule.exports.getEnabledModules !== 'function') {
    throw new Error('Modules module missing required getEnabledModules export');
  }

  return modulesModule as IModule<IModulesModuleExports>;
}

export default ModulesModule;
