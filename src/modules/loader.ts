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
import {
  type IModuleInfo,
  ModuleStatusEnum,
} from '@/modules/core/modules/types/index';
import type {
  IModuleConstructor,
  IModuleContext,
  IModuleExports,
  IModuleInstance,
  IModuleScannerService,
  IModuleWithService,
  IModulesConfig,
} from '@/modules/types/index';
import type { ModuleName } from '@/modules/types/index';

const logger = LoggerService.getInstance();

/**
 * Type guard to check if a module has a service property.
 * @param moduleInstance - The module instance to check.
 * @returns True if the module has a service property with getScannerService method.
 */
const hasModuleService = (
  moduleInstance: unknown,
): moduleInstance is IModuleWithService => {
  if (
    moduleInstance === null
    || moduleInstance === undefined
    || typeof moduleInstance !== 'object'
  ) {
    return false;
  }

  const candidate = moduleInstance as Record<string, unknown>;

  return (
    'service' in candidate
    && candidate.service !== null
    && typeof candidate.service === 'object'
    && 'getScannerService' in (candidate.service as Record<string, unknown>)
    && typeof (candidate.service as Record<string, unknown>).getScannerService === 'function'
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
    if (ModuleLoader.instance === undefined) {
      ModuleLoader.instance = new ModuleLoader(configPath);
    }
    return ModuleLoader.instance;
  }

  /**
   * Loads module configuration from disk.
   * @returns The parsed modules configuration or default empty configuration.
   * @private
   */
  private loadConfig(): IModulesConfig {
    if (!existsSync(this.configPath)) {
      logger.warn(
        LogSource.MODULES,
        `Module config not found at ${this.configPath}, using defaults`,
      );
      return { modules: {} };
    }

    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(configData) as IModulesConfig;
    } catch (error) {
      logger.error(
        LogSource.MODULES,
        `Failed to load module config from ${this.configPath}:`,
        { error: error instanceof Error ? error : new Error(String(error)) },
      );
      return { modules: {} };
    }
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
        if (moduleInstance.stop !== undefined) {
          await moduleInstance.stop();
        }

        if (this.scannerService !== null) {
          await this.scannerService.updateModuleStatus(
            moduleInstance.name,
            ModuleStatusEnum.STOPPED,
          );
        }
      } catch (error) {
        logger.error(
          LogSource.MODULES,
          `Error stopping module ${moduleInstance.name}:`,
          { error: error instanceof Error ? error : new Error(String(error)) },
        );
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
  getModule(name: ModuleName): IModuleInstance {
    const module = this.registry.get(name);
    if (module === undefined) {
      throw new Error(`Module '${name}' not found in registry`);
    }

    if ('exports' in module && module.exports) {
      return module as unknown as IModuleInstance;
    }

    return module as unknown as IModuleInstance;
  }

  /**
   * Loads core modules required for system operation.
   * @param config - Modules configuration.
   * @returns Promise that resolves when core modules are loaded.
   * @private
   */
  private async loadCoreModules(config: IModulesConfig): Promise<void> {
    logger.debug(LogSource.MODULES, 'Core modules already loaded by bootstrap');

    if (!this.registry.get('modules')) {
      await this.loadModule('modules', './core/modules/index.js', config);
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
      const modulesModule = this.registry.get('modules');
      if (!modulesModule || !hasModuleService(modulesModule)) {
        logger.error(
          LogSource.MODULES,
          'Modules module not properly initialized or missing service',
        );
        return;
      }

      this.scannerService = modulesModule.service.getScannerService();
      if (this.scannerService === null) {
        logger.error(LogSource.MODULES, 'Scanner service not available');
        return;
      }

      logger.debug(LogSource.MODULES, 'Scanning for available modules...');
      const scannedModules = await this.scannerService.scan({
        deep: true,
        includeDisabled: false,
      });

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

        const moduleConfig = config.modules[moduleInfo.name];
        if (moduleConfig?.enabled === false) {
          logger.debug(LogSource.MODULES, `Module ${moduleInfo.name} disabled in config`);
          continue;
        }

        await this.loadModuleFromInfo(moduleInfo, config);
      }
    } catch (error) {
      logger.error(
        LogSource.MODULES,
        'Failed to scan and load modules:',
        { error: error instanceof Error ? error : new Error(String(error)) },
      );
    }
  }

  /**
   * Loads a module from scanned module information.
   * @param moduleInfo - Information about the module from database.
   * @param config - Modules configuration.
   * @returns Promise that resolves when module is loaded.
   * @private
   */
  private async loadModuleFromInfo(moduleInfo: IModuleInfo, config: IModulesConfig): Promise<void> {
    try {
      if (this.scannerService !== null) {
        await this.scannerService.updateModuleStatus(moduleInfo.name, ModuleStatusEnum.LOADING);
      }

      const relativePath = moduleInfo.path.replace(process.cwd(), '.');
      const importPath = join(relativePath, 'index.js');

      await this.loadModule(moduleInfo.name, importPath, config);

      if (this.scannerService !== null) {
        await this.scannerService.updateModuleStatus(moduleInfo.name, ModuleStatusEnum.RUNNING);
      }
    } catch (error) {
      logger.error(
        LogSource.MODULES,
        `Failed to load module ${moduleInfo.name}:`,
        { error: error instanceof Error ? error : new Error(String(error)) },
      );
      if (this.scannerService !== null) {
        await this.scannerService.updateModuleStatus(
          moduleInfo.name,
          ModuleStatusEnum.ERROR,
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
   * @private
   */
  private async loadModule(
    name: string,
    importPath: string,
    config: IModulesConfig,
  ): Promise<void> {
    try {
      logger.debug(LogSource.MODULES, `Loading module: ${name} from ${importPath}`);

      const moduleExports = await import(importPath) as IModuleExports;
      const moduleClass = this.findModuleClass(moduleExports, name, importPath);
      const moduleInstance = new moduleClass();

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

    const registryModule = {
      ...moduleInstance,
      version: moduleInstance.version ?? '1.0.0',
      type: moduleInstance.type ?? 'service' as const,
      start: moduleInstance.start?.bind(moduleInstance) ?? (async (): Promise<void> => {}),
      stop: moduleInstance.stop?.bind(moduleInstance) ?? (async (): Promise<void> => {}),
      healthCheck: moduleInstance.healthCheck?.bind(moduleInstance) ?? (async (): Promise<{ healthy: boolean; message?: string }> => { return { healthy: true } }),
    };

    this.registry.register(registryModule);

    if (config.modules[name]?.autoStart === true) {
      await moduleInstance.start?.();
    }
  }

  /**
   * Log module loading error.
   * @param name - Module name.
   * @param error - Error that occurred.
   * @private
   */
  private logModuleError(name: string, error: unknown): void {
    logger.error(
      LogSource.MODULES,
      `Failed to load module ${name}:`,
      { error: error instanceof Error ? error : new Error(String(error)) },
    );
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
