/**
 * Dynamic module loader that automatically discovers and manages system modules.
 * Provides automatic module discovery, loading, and lifecycle management
 * for the SystemPrompt OS module system. Uses a database-backed module registry to
 * track available modules and their states.
 * @file
 * @module modules/loader
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ModuleRegistry } from '@/modules/registry';
import { CONFIG } from '@/server/config';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { ModulesStatus } from '@/modules/core/modules/types/manual';
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';
import type {
  IModuleConstructor,
  IModuleContext,
  IModuleExports,
  IModuleInstance,
  IModuleWithService,
  IModulesConfig,
  ModuleName,
} from '@/modules/types/index';
import { ModuleName as ModuleNameEnum } from '@/modules/types/module-names.types';
import type { IModuleScannerService } from '@/modules/core/modules/types/scanner.types';
import type { IModuleInterface } from '@/types/modules';

const logger = LoggerService.getInstance();

/**
 * Type guard to check if a module has a service property.
 * @param moduleInstance - The module instance to check.
 * @returns True if the module has a service property with getScannerService method.
 */
const hasModuleService = (moduleInstance: unknown): moduleInstance is IModuleWithService => {
  if (
    moduleInstance === null
    || moduleInstance === undefined
    || typeof moduleInstance !== 'object'
  ) {
    return false;
  }

  const candidate = moduleInstance as { [key: string]: unknown };

  return (
    'service' in candidate
    && candidate.service !== null
    && typeof candidate.service === 'object'
    && 'getScannerService' in candidate.service
    && typeof (candidate.service as { getScannerService?: unknown }).getScannerService === 'function'
  );
};

/**
 * Dynamic module loader that discovers and manages system modules.
 * @class ModuleLoader
 * @description Provides automatic module discovery, loading, and lifecycle management.
 * Uses a database-backed module registry to track available modules and their states.
 * @example
 * ```typescript
 * const loader = ModuleLoader.getInstance();
 * await loader.loadModules();
 * const module = loader.getModule('api');
 * ```
 */
export class ModuleLoader {
  private static instance: ModuleLoader;
  private readonly registry: ModuleRegistry;
  private readonly configPath: string;
  private scannerService: IModuleScannerService | null = null;

  /**
   * Creates a new ModuleLoader instance.
   * @param configPath - Optional path to modules configuration file.
   * @private
   */
  private constructor(configPath?: string) {
    this.registry = new ModuleRegistry();
    this.configPath = configPath ?? join(CONFIG.CONFIGPATH, 'modules.json');
  }

  /**
   * Gets the singleton instance of the module loader.
   * @param configPath - Optional path to modules configuration file.
   * @returns The singleton ModuleLoader instance.
   * @static
   */
  static getInstance(configPath?: string): ModuleLoader {
    ModuleLoader.instance ??= new ModuleLoader(configPath);
    return ModuleLoader.instance;
  }

  /**
   * Loads all configured modules.
   * @description First loads core modules required for system operation,
   * then uses the module scanner to discover and load additional modules.
   * @returns Promise that resolves when all modules are loaded.
   * @public
   */
  async loadModules(): Promise<void> {
    logger.debug(LogSource.MODULES, 'Starting dynamic module loading...');
    const config = this.loadConfig();

    await this.loadCoreModules(config);
    await this.scanAndLoadModules(config);
  }

  /**
   * Shuts down all loaded modules in reverse order.
   * @returns Promise that resolves when all modules are shut down.
   * @public
   */
  async shutdown(): Promise<void> {
    logger.debug(LogSource.MODULES, 'Shutting down modules...');

    const modules = this.registry.getAll();

    for (const moduleInstance of modules.reverse()) {
      try {
        if (typeof moduleInstance.stop === 'function') {
          await moduleInstance.stop();
        }

        if (this.scannerService !== null) {
          await this.scannerService.updateModuleStatus(moduleInstance.name, ModulesStatus.STOPPED);
        }
      } catch (error) {
        logger.error(LogSource.MODULES, `Error stopping module ${moduleInstance.name}:`, {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    logger.debug(LogSource.MODULES, 'All modules shut down');
  }

  /**
   * Gets the module registry.
   * @returns The module registry instance.
   * @public
   */
  getRegistry(): ModuleRegistry {
    return this.registry;
  }

  /**
   * Gets a specific module by name.
   * @param name - Module name to retrieve.
   * @returns The module instance.
   * @throws {Error} If module is not found or not properly initialized.
   * @public
   */
  getModule(name: ModuleName | string): IModuleInstance {
    const moduleInstance = this.registry.get(name);
    if (moduleInstance === undefined) {
      throw new Error(`Module '${name}' not found in registry`);
    }

    if ('exports' in moduleInstance && moduleInstance.exports) {
      return moduleInstance as unknown as IModuleInstance;
    }

    return moduleInstance as unknown as IModuleInstance;
  }

  /**
   * Gets all loaded modules.
   * @returns Array of all loaded module instances.
   * @public
   */
  getAllModules(): IModuleInterface[] {
    return this.registry.getAll();
  }

  /**
   * Loads module configuration from disk.
   * @returns The parsed modules configuration or default empty configuration.
   * @private
   */
  private loadConfig(): IModulesConfig {
    if (!existsSync(this.configPath)) {
      logger.debug(
        LogSource.MODULES,
        `Optional module config not found at ${this.configPath}, using defaults (this is normal)`,
      );
      return { modules: {} };
    }

    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      const parsed: unknown = JSON.parse(configData);
      return parsed as IModulesConfig;
    } catch (error) {
      logger.error(LogSource.MODULES, `Failed to load module config from ${this.configPath}:`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { modules: {} };
    }
  }

  /**
   * Loads core modules required for system operation.
   * @param config - Modules configuration.
   * @returns Promise that resolves when core modules are loaded.
   * @private
   */
  private async loadCoreModules(config: IModulesConfig): Promise<void> {
    logger.debug(LogSource.MODULES, 'Core modules already loaded by bootstrap');

    const modulesModule = this.registry.get(ModuleNameEnum.MODULES);
    if (modulesModule === undefined) {
      await this.loadModule(ModuleNameEnum.MODULES, './core/modules/index.js', config);
    }
  }

  /**
   * Scans for and loads all available modules using the module scanner service.
   * @param config - Modules configuration.
   * @returns Promise that resolves when all modules are scanned and loaded.
   * @private
   */
  private async scanAndLoadModules(config: IModulesConfig): Promise<void> {
    try {
      const modulesModule = this.registry.get(ModuleNameEnum.MODULES);
      if (modulesModule === undefined) {
        logger.error(LogSource.MODULES, 'Modules module not properly initialized');
        return;
      }

      const moduleWithService = modulesModule as unknown as IModuleWithService;
      if (!hasModuleService(moduleWithService)) {
        logger.error(LogSource.MODULES, 'Modules module missing service');
        return;
      }

      this.scannerService = moduleWithService.service.getScannerService() ?? null;
      if (this.scannerService === null) {
        logger.error(LogSource.MODULES, 'Scanner service not available');
        return;
      }

      logger.debug(LogSource.MODULES, 'Scanning for available modules...');
      const scannedModules = await this.scannerService.scan({});

      logger.debug(LogSource.MODULES, `Found ${scannedModules.length} modules`);

      const enabledModules = await this.scannerService.getEnabledModules();

      for (const moduleInfo of enabledModules) {
        if (['logger', 'database', 'cli', 'modules'].includes(moduleInfo.name)) {
          logger.debug(
            LogSource.MODULES,
            `Skipping core module ${moduleInfo.name} - already loaded by bootstrap`,
          );
          continue;
        }

        const { [moduleInfo.name]: moduleConfig } = config.modules;
        if (moduleConfig?.enabled === false) {
          logger.debug(LogSource.MODULES, `Module ${moduleInfo.name} disabled in config`);
          continue;
        }

        await this.loadModuleFromInfo(moduleInfo, config);
      }
    } catch (error) {
      logger.error(LogSource.MODULES, 'Failed to scan and load modules:', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Loads a module from scanned module information.
   * @param moduleInfo - Information about the module from database.
   * @param config - Modules configuration.
   * @returns Promise that resolves when module is loaded.
   * @private
   */
  private async loadModuleFromInfo(moduleInfo: IModulesRow, config: IModulesConfig): Promise<void> {
    try {
      if (this.scannerService !== null) {
        await this.scannerService.updateModuleStatus(moduleInfo.name, ModulesStatus.LOADING);
      }

      const relativePath = moduleInfo.path.replace(process.cwd(), '.');
      const importPath = join(relativePath, 'index.js');

      await this.loadModule(moduleInfo.name, importPath, config);

      if (this.scannerService !== null) {
        await this.scannerService.updateModuleStatus(moduleInfo.name, ModulesStatus.RUNNING);
      }
    } catch (error) {
      logger.error(LogSource.MODULES, `Failed to load module ${moduleInfo.name}:`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (this.scannerService !== null) {
        await this.scannerService.updateModuleStatus(
          moduleInfo.name,
          ModulesStatus.ERROR,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Loads a single module by name and import path.
   * @param name - Module name.
   * @param importPath - Path to import the module from.
   * @param config - Modules configuration.
   * @returns Promise that resolves when module is loaded and initialized.
   * @throws {Error} If module cannot be loaded or initialized.
   * @private
   */
  private async loadModule(
    name: string,
    importPath: string,
    config: IModulesConfig,
  ): Promise<void> {
    try {
      logger.debug(LogSource.MODULES, `Loading module: ${name} from ${importPath}`);

      const moduleExports: unknown = await import(importPath);
      const moduleClass = this.findModuleClass(moduleExports as IModuleExports, name, importPath);
      const ModuleConstructor = moduleClass;
      const moduleInstance = new ModuleConstructor();

      await this.initializeModule(moduleInstance, name, config);
      logger.debug(LogSource.MODULES, `Module ${name} loaded successfully`);
    } catch (error) {
      this.logModuleError(name, error);
      throw error;
    }
  }

  /**
   * Find module class in exports.
   * @param moduleExports - Module exports object.
   * @param name - Module name.
   * @param importPath - Import path for error messages.
   * @returns Module constructor.
   * @throws {Error} If no module class is found in exports.
   * @private
   */
  private findModuleClass(
    moduleExports: IModuleExports,
    name: string,
    importPath: string,
  ): IModuleConstructor {
    const moduleClassName = Object.keys(moduleExports).find((key): boolean => {
      return key.toLowerCase().includes(name.toLowerCase()) && key.includes('Module');
    });

    if (moduleClassName === undefined) {
      throw new Error(`No module class found in ${importPath}`);
    }

    return moduleExports[moduleClassName] as IModuleConstructor;
  }

  /**
   * Initialize module with context and register it.
   * @param moduleInstance - Module instance to initialize.
   * @param name - Module name.
   * @param config - Modules configuration.
   * @private
   */
  private async initializeModule(
    moduleInstance: IModuleInstance,
    name: string,
    config: IModulesConfig,
  ): Promise<void> {
    const context: IModuleContext = {
      config: config.modules[name]?.config ?? {},
      logger,
    };

    await moduleInstance.initialize(context);

    const registryModule: IModuleInterface = {
      name: moduleInstance.name,
      version: moduleInstance.version ?? '1.0.0',
      type: moduleInstance.type ?? ('service' as const),
      initialize: async (_ctx: import('../types/modules').IModuleContext) => {},
      start: moduleInstance.start?.bind(moduleInstance) ?? this.createNoOpAsyncFunction(),
      stop: moduleInstance.stop?.bind(moduleInstance) ?? this.createNoOpAsyncFunction(),
      healthCheck:
        moduleInstance.healthCheck?.bind(moduleInstance) ?? this.createHealthCheckFunction(),
    };

    this.registry.register(registryModule);

    if (config.modules[name]?.autoStart === true && typeof moduleInstance.start === 'function') {
      await moduleInstance.start();
    }
  }

  /**
   * Creates a no-op async function.
   * @returns An async function that does nothing.
   * @private
   */
  private createNoOpAsyncFunction(): () => Promise<void> {
    return async (): Promise<void> => {};
  }

  /**
   * Creates a default health check function.
   * @returns An async function that returns healthy status.
   * @private
   */
  private createHealthCheckFunction(): () => Promise<{ healthy: boolean; message?: string }> {
    return async (): Promise<{ healthy: boolean; message?: string }> => {
      return { healthy: true };
    };
  }

  /**
   * Log module loading error.
   * @param name - Module name.
   * @param error - Error that occurred.
   * @private
   */
  private logModuleError(name: string, error: unknown): void {
    logger.error(LogSource.MODULES, `Failed to load module ${name}:`, {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Gets the singleton module loader instance.
 * @param configPath - Optional path to modules configuration file.
 * @returns The singleton ModuleLoader instance.
 * @public
 */
export const getModuleLoader = (configPath?: string): ModuleLoader => {
  return ModuleLoader.getInstance(configPath);
};

/**
 * Gets the module registry from the singleton module loader instance.
 * @returns The module registry instance.
 * @public
 */
export const getModuleRegistry = () => {
  return getModuleLoader().getRegistry();
};

/**
 * Resets the singleton module loader instance.
 * This is primarily used for testing purposes to ensure clean state.
 * @public
 */
export const resetModuleLoader = (): void => {
  (ModuleLoader as any).instance = undefined;
};
