import { ModuleTypeEnum } from "@/modules/core/modules/types/index";
/**
 * Modules module - Module lifecycle and registry management.
 * This is a self-contained core module that manages the discovery,
 * registration, and lifecycle of all extension modules.
 * @file Modules module entry point.
 * @module modules/core/modules
 */

import {
  type IModule,
  type IModuleInfo,
  type IModuleScanOptions,
  type IModuleScannerService,
  type IModulesModuleExports,
  type IScannedModule,
  ModuleStatusEnum
} from '@/modules/core/modules/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import {
  CoreModuleLoaderService
} from '@/modules/core/modules/services/core-module-loader.service';
import type { ICoreModuleDefinition } from '@/types/bootstrap';

/**
 * Self-contained modules module for managing SystemPrompt OS modules.
 */
export class ModulesModule implements IModule<IModulesModuleExports> {
  public readonly name = 'modules';
  public readonly version = '1.0.0';
  public readonly type = ModuleTypeEnum.CORE;
  public readonly description = 'Module lifecycle and registry management';
  public readonly dependencies = ['logger', 'database'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private logger!: ILogger;
  private service!: ModuleManagerService;
  private coreLoader!: CoreModuleLoaderService;
  private initialized = false;
  private started = false;
  public get exports(): IModulesModuleExports {
    return {
      service: this.createScannerService.bind(this),
      scanForModules: this.scanForModules.bind(this),
      getEnabledModules: this.getEnabledModules.bind(this),
      getModule: this.getModule.bind(this),
      enableModule: this.enableModule.bind(this),
      disableModule: this.disableModule.bind(this),
      registerCoreModule: this.registerCoreModule.bind(this),
      loadCoreModule: this.loadCoreModule.bind(this),
      initializeCoreModule: this.initializeCoreModule.bind(this),
      startCoreModule: this.startCoreModule.bind(this),
      getCoreModule: this.getCoreModule.bind(this),
      getAllCoreModules: this.getAllCoreModules.bind(this),
      registerPreLoadedModule: this.registerPreLoadedModule.bind(this),
    };
  }

  /**
   * Create scanner service instance.
   * @returns Scanner service or undefined.
   */
  private createScannerService(): IModuleScannerService | undefined {
    try {
      const svc = this.getService();
      return {
        scan: this.createScanFunction(svc),
        getEnabledModules: async (): Promise<IModuleInfo[]> => {
          return await svc.getEnabledModules();
        },
        updateModuleStatus: this.createUpdateStatusFunc(),
        setModuleEnabled: async (
          name: string,
          enabled: boolean
        ): Promise<void> => {
          if (enabled) {
            await svc.enableModule(name);
          } else {
            await svc.disableModule(name);
          }
        },
        updateModuleHealth: this.createUpdateHealthFunc(),
        getModule: async (
          name: string
        ): Promise<IModuleInfo | undefined> => {
          return await svc.getModule(name);
        },
        getRegisteredModules: async (): Promise<IModuleInfo[]> => {
          return await svc.getEnabledModules();
        }
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Create scan function for scanner service.
   * @param svc - Module manager service.
   * @returns Scan function.
   */
  private createScanFunction(
    svc: ModuleManagerService
  ): (options: IModuleScanOptions) => Promise<IScannedModule[]> {
    return async (
      _options: IModuleScanOptions
    ): Promise<IScannedModule[]> => {
      return await svc.scanForModules();
    };
  }

  /**
   * Create updateModuleStatus function.
   * @returns UpdateModuleStatus function.
   */
  private createUpdateStatusFunc(): (
    name: string,
    status: ModuleStatusEnum,
    error?: string
  ) => Promise<void> {
    return async (
      _name: string,
      _status: ModuleStatusEnum,
      _error?: string
    ): Promise<void> => {
      await Promise.reject(new Error('updateModuleStatus not implemented'));
    };
  }

  /**
   * Create updateModuleHealth function.
   * @returns UpdateModuleHealth function.
   */
  private createUpdateHealthFunc(): (
    name: string,
    healthy: boolean,
    message?: string
  ) => Promise<void> {
    return async (
      _name: string,
      _healthy: boolean,
      _message?: string
    ): Promise<void> => {
      await Promise.reject(new Error('updateModuleHealth not implemented'));
    };
  }

  /**
   * Scan for modules.
   * @returns Array of scanned modules.
   */
  private async scanForModules(): Promise<IScannedModule[]> {
    const svc = this.getService();
    return await svc.scanForModules();
  }

  /**
   * Get enabled modules.
   * @returns Array of enabled modules.
   */
  private async getEnabledModules(): Promise<IModuleInfo[]> {
    const svc = this.getService();
    return await svc.getEnabledModules();
  }

  /**
   * Get module by name.
   * @param name - Module name.
   * @returns Module info or undefined.
   */
  private async getModule(name: string): Promise<IModuleInfo | undefined> {
    const svc = this.getService();
    return await svc.getModule(name);
  }

  /**
   * Enable module.
   * @param name - Module name.
   */
  private async enableModule(name: string): Promise<void> {
    const svc = this.getService();
    await svc.enableModule(name);
  }

  /**
   * Disable module.
   * @param name - Module name.
   */
  private async disableModule(name: string): Promise<void> {
    const svc = this.getService();
    await svc.disableModule(name);
  }

  /**
   * Register core module.
   * @param name - Module name.
   * @param path - Module path.
   * @param dependencies - Module dependencies.
   */
  private async registerCoreModule(
    name: string,
    path: string,
    dependencies: string[] = []
  ): Promise<void> {
    const svc = this.getService();
    await svc.registerCoreModule(name, path, dependencies);
  }

  /**
   * Load core module.
   * @param definition - Core module definition.
   * @returns Loaded module.
   */
  private async loadCoreModule(
    definition: ICoreModuleDefinition
  ): Promise<IModule> {
    return await this.coreLoader.loadModule(definition);
  }

  /**
   * Initialize core module.
   * @param name - Module name.
   */
  private async initializeCoreModule(name: string): Promise<void> {
    await this.coreLoader.initializeModule(name);
  }

  /**
   * Start core module.
   * @param name - Module name.
   */
  private async startCoreModule(name: string): Promise<void> {
    await this.coreLoader.startModule(name);
  }

  /**
   * Get core module.
   * @param name - Module name.
   * @returns Module or undefined.
   */
  private getCoreModule(name: string): IModule | undefined {
    return this.coreLoader.getModule(name);
  }

  /**
   * Get all core modules.
   * @returns Map of all core modules.
   */
  private getAllCoreModules(): Map<string, IModule> {
    return this.coreLoader.getAllModules();
  }

  /**
   * Register a pre-loaded module.
   * @param name - Module name.
   * @param module - Module instance.
   */
  private registerPreLoadedModule(name: string, module: IModule): void {
    this.coreLoader.registerLoadedModule(name, module);
  }

  /**
   * Get the module manager service instance.
   * @returns The module manager service instance.
   * @throws {Error} If service not available.
   */
  private getService(): ModuleManagerService {
    if (!this.service) {
      const config = {
        modulesPath: './src/modules',
        injectablePath: './src/modules/extension',
        extensionsPath: './extensions',
      };

      try {
        this.logger = LoggerService.getInstance();
        const database = DatabaseService.getInstance();
        this.service = ModuleManagerService.getInstance(
          config,
          this.logger,
          database
        );
        this.service.initialize();
        this.coreLoader = CoreModuleLoaderService.getInstance();
      } catch {
        throw new Error(
          'Modules service not available - required services not initialized'
        );
      }
    }
    return this.service;
  }

  /**
   * Initialize the modules module.
   */
  public async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Modules module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();
      const database = DatabaseService.getInstance();

      const config = {
        modulesPath: './src/modules',
        injectablePath: './src/modules/extension',
        extensionsPath: './extensions',
      };

      this.service = ModuleManagerService.getInstance(
        config,
        this.logger,
        database
      );
      this.service.initialize();

      this.coreLoader = CoreModuleLoaderService.getInstance();

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
  public async start(): Promise<void> {
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
  public async stop(): Promise<void> {
    this.status = ModuleStatusEnum.STOPPED;
    this.started = false;
    this.logger.info(LogSource.MODULES, 'Modules module stopped');
  }

  /**
   * Health check.
   * @returns Health status and optional message.
   */
  public async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
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
 * Uses dynamic imports to resolve circular dependencies.
 * @returns The Modules module with guaranteed typed exports.
 * @throws {Error} If Modules module is not available or missing required exports.
 */
export const getModulesModule = async (): Promise<
  IModule<IModulesModuleExports>
> => {
  const { getModuleLoader } = await import('@/modules/loader');
  const { ModuleName } = await import('@/modules/types/index');

  const moduleLoader = getModuleLoader();
  const foundModule = moduleLoader.getModule(ModuleName.MODULES);

  if (!foundModule) {
    throw new Error('Modules module not found in module loader');
  }

  const modulesModule = foundModule as unknown as IModule<IModulesModuleExports>;

  if (!modulesModule.exports) {
    throw new Error('Modules module missing exports');
  }

  if (typeof modulesModule.exports.service !== 'function') {
    throw new Error('Modules module missing required service export');
  }

  if (typeof modulesModule.exports.scanForModules !== 'function') {
    throw new Error('Modules module missing required scanForModules export');
  }

  if (typeof modulesModule.exports.getEnabledModules !== 'function') {
    throw new Error('Modules module missing required getEnabledModules export');
  }

  return modulesModule;
};

export default ModulesModule;
