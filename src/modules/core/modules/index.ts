/**
 * Modules module - Module lifecycle and registry management.
 * This is a self-contained core module that manages the discovery,
 * registration, and lifecycle of all extension modules.
 * @file Modules module entry point.
 * @module modules/core/modules
 */

import {
 type IModule, type ModuleInfo, ModuleStatus
} from '@/modules/core/modules/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';

/**
 * Strongly typed exports interface for Modules module.
 */
export interface IModulesModuleExports {
  readonly service: () => ModuleManagerService | undefined;
  readonly scanForModules: () => Promise<any>;
  readonly getEnabledModules: () => Promise<ModuleInfo[]>;
  readonly getModule: (name: string) => Promise<ModuleInfo | undefined>;
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
  name = 'modules';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;
  dependencies = ['logger', 'database'];
  private service?: ModuleManagerService;
  private logger!: ILogger;
  private database!: DatabaseService;
  get exports(): IModulesModuleExports {
    return {
      service: () => {
        return this.getService();
      },
      scanForModules: async () => {
        const svc = this.getService();
        if (!svc) {
          throw new Error('Module service not initialized');
        }
        return await svc.scanForModules();
      },
      getEnabledModules: async () => {
        const svc = this.getService();
        if (!svc) {
          throw new Error('Module service not initialized');
        }
        return await svc.getEnabledModules();
      },
      getModule: async (name: string) => {
        const svc = this.getService();
        if (!svc) {
          throw new Error('Module service not initialized');
        }
        return await svc.getModule(name);
      },
      enableModule: async (name: string) => {
        const svc = this.getService();
        if (!svc) {
          throw new Error('Module service not initialized');
        }
        await svc.enableModule(name);
      },
      disableModule: async (name: string) => {
        const svc = this.getService();
        if (!svc) {
          throw new Error('Module service not initialized');
        }
        await svc.disableModule(name);
      },
      registerCoreModule: async (name: string, path: string, dependencies: string[] = []) => {
        const svc = this.getService();
        if (!svc) {
          throw new Error('Module service not initialized');
        }
        await svc.registerCoreModule(name, path, dependencies);
      },
    };
  }

  /**
   * Initialize the modules module.
   */
  async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();
    this.database = DatabaseService.getInstance();

    const config = {
      modulesPath: './src/modules',
      injectablePath: './src/modules/extension',
      extensionsPath: './extensions',
    };

    this.service = ModuleManagerService.getInstance(config, this.logger, this.database);
    await this.service.initialize();

    this.logger.info(LogSource.MODULES, 'Modules module initialized');
  }

  /**
   * Start the modules module.
   */
  async start(): Promise<void> {
    this.status = ModuleStatus.RUNNING;
    this.logger?.info(LogSource.MODULES, 'Modules module started');
  }

  /**
   * Stop the modules module.
   */
  async stop(): Promise<void> {
    this.status = ModuleStatus.STOPPED;
    this.logger?.info(LogSource.MODULES, 'Modules module stopped');
  }

  /**
   * Health check.
   * @returns Health status and optional message.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    const healthy = this.status === ModuleStatus.RUNNING && this.service !== undefined;
    return {
      healthy,
      message: healthy ? 'Modules module is healthy' : 'Modules module is not running',
    };
  }

  /**
   * Get the module manager service instance.
   * @returns The module manager service instance or undefined.
   */
  getService(): ModuleManagerService | undefined {
    return this.service;
  }
}

let moduleInstance: ModulesModule | undefined;

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
export const initialize = async (): Promise<IModule> => {
  const moduleInst = createModule();
  await moduleInst.initialize();
  moduleInstance = moduleInst;
  return moduleInst;
};

/**
 * Get the module manager service.
 * @returns The module manager service instance.
 * @throws {Error} Error if service is not initialized.
 */
export const service = (): ModuleManagerService => {
  if (moduleInstance === undefined || moduleInstance.getService() === undefined) {
    throw new Error('Modules service not initialized');
  }
  const moduleService = moduleInstance.getService();
  if (!moduleService) {
    throw new Error('Module service is not initialized');
  }
  return moduleService;
};

/**
 * Scan for modules in the configured paths.
 * @returns Promise that resolves when scan is complete.
 */
export const scanForModules = async (): Promise<void> => {
  const moduleService = service();
  await moduleService.scanForModules();
};

/**
 * Get all enabled modules.
 * @returns Promise that resolves to array of enabled modules.
 */
export const getEnabledModules = async (): Promise<ModuleInfo[]> => {
  const moduleService = service();
  return await moduleService.getEnabledModules();
};

/**
 * Get a specific module by name.
 * @param name - Name of the module to retrieve.
 * @returns Promise that resolves to the module or undefined.
 */
export const getModule = async (name: string): Promise<ModuleInfo | undefined> => {
  const moduleService = service();
  return await moduleService.getModule(name);
};

/**
 * Enable a module by name.
 * @param name - Name of the module to enable.
 * @returns Promise that resolves when module is enabled.
 */
export const enableModule = async (name: string): Promise<void> => {
  const moduleService = service();
  await moduleService.enableModule(name);
};

/**
 * Disable a module by name.
 * @param name - Name of the module to disable.
 * @returns Promise that resolves when module is disabled.
 */
export const disableModule = async (name: string): Promise<void> => {
  const moduleService = service();
  await moduleService.disableModule(name);
};

/**
 * Register a core module.
 * @param name - Name of the module.
 * @param path - Path to the module.
 * @param dependencies - Array of module dependencies.
 * @returns Promise that resolves when module is registered.
 */
export const registerCoreModule = async (
  name: string,
  path: string,
  dependencies: string[] = [],
): Promise<void> => {
  const moduleService = service();
  await moduleService.registerCoreModule(name, path, dependencies);
};
