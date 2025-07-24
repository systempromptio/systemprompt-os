/**
 * @fileoverview Dynamic module loader that automatically discovers and manages system modules
 * @module modules/loader
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ModuleRegistry } from './registry.js';
import { CONFIG } from '../server/config.js';
import type { Logger } from '@/modules/core/logger/index.js';
import {
  ModuleStatus,
  type ModuleInfo,
  type ModuleScannerService,
  type ModuleConfig as IModuleConfig,
} from './core/modules/types/index.js';

/**
 * Configuration for an individual module from config file
 */
export interface ModuleConfig extends IModuleConfig {
  enabled: boolean;
  autoStart?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Root configuration structure for all modules
 */
export interface ModulesConfig {
  modules: Record<string, ModuleConfig>;
}

/**
 * Module service interface that provides scanner access
 */
interface ModuleService {
  getScannerService(): ModuleScannerService;
}

/**
 * Module instance with service property
 */
interface ModuleWithService {
  name: string;
  service: ModuleService;
  [key: string]: any;
}

/**
 * Type guard to check if a module has a service property
 */
function hasModuleService(module: any): module is ModuleWithService {
  return (
    module &&
    typeof module.service === 'object' &&
    typeof module.service.getScannerService === 'function'
  );
}

/**
 * Dynamic module loader that discovers and manages system modules
 *
 * @class ModuleLoader
 * @description Provides automatic module discovery, loading, and lifecycle management.
 * Uses a database-backed module registry to track available modules and their states.
 *
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
  private scannerService: ModuleScannerService | null = null;

  /**
   * Creates a new ModuleLoader instance
   *
   * @param configPath - Optional path to modules configuration file
   * @private
   */
  private constructor(configPath?: string) {
    this.registry = new ModuleRegistry();
    this.configPath = configPath || join(CONFIG.CONFIGPATH, 'modules.json');
  }

  /**
   * Gets the singleton instance of the module loader
   *
   * @param configPath - Optional path to modules configuration file
   * @returns The singleton ModuleLoader instance
   * @static
   */
  static getInstance(configPath?: string): ModuleLoader {
    if (!ModuleLoader.instance) {
      ModuleLoader.instance = new ModuleLoader(configPath);
    }
    return ModuleLoader.instance;
  }

  /**
   * Loads module configuration from disk
   *
   * @returns The parsed modules configuration or default empty configuration
   * @private
   */
  private loadConfig(): ModulesConfig {
    if (!existsSync(this.configPath)) {
      logger.warn(`Module config not found at ${this.configPath}, using defaults`);
      return { modules: {} };
    }

    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      logger.error(`Failed to load module config from ${this.configPath}:`, error);
      return { modules: {} };
    }
  }

  /**
   * Loads all configured modules
   *
   * @description First loads core modules required for system operation,
   * then uses the module scanner to discover and load additional modules
   * @returns Promise that resolves when all modules are loaded
   * @public
   */
  async loadModules(): Promise<void> {
    logger.info('Starting dynamic module loading...');
    const config = this.loadConfig();

    await this.loadCoreModules(config);
    await this.scanAndLoadModules(config);
  }

  /**
   * Loads core modules required for system operation
   *
   * @param config - Modules configuration
   * @returns Promise that resolves when core modules are loaded
   * @private
   */
  private async loadCoreModules(config: ModulesConfig): Promise<void> {
    await this.loadModule('logger', './core/logger/index.js', config);
    await this.loadModule('database', './core/database/index.js', config);
    await this.loadModule('modules', './core/modules/index.js', config);
  }

  /**
   * Scans for and loads all available modules using the module scanner service
   *
   * @param config - Modules configuration
   * @returns Promise that resolves when all modules are scanned and loaded
   * @private
   */
  private async scanAndLoadModules(config: ModulesConfig): Promise<void> {
    try {
      const modulesModule = this.registry.get('modules');
      if (!hasModuleService(modulesModule)) {
        logger.error('Modules module not properly initialized or missing service');
        return;
      }

      this.scannerService = modulesModule.service.getScannerService();
      if (!this.scannerService) {
        logger.error('Scanner service not available');
        return;
      }

      logger.info('Scanning for available modules...');
      const scannedModules = await this.scannerService.scan({
        deep: true,
        includeDisabled: false,
      });

      logger.info(`Found ${scannedModules.length} modules`);

      const enabledModules = await this.scannerService.getEnabledModules();

      for (const moduleInfo of enabledModules) {
        if (['logger', 'database', 'modules'].includes(moduleInfo.name)) {
          continue;
        }

        const moduleConfig = config.modules[moduleInfo.name];
        if (moduleConfig?.enabled === false) {
          logger.debug(`Module ${moduleInfo.name} disabled in config`);
          continue;
        }

        await this.loadModuleFromInfo(moduleInfo, config);
      }
    } catch (error) {
      logger.error('Failed to scan and load modules:', error);
    }
  }

  /**
   * Loads a module from scanned module information
   *
   * @param moduleInfo - Information about the module from database
   * @param config - Modules configuration
   * @returns Promise that resolves when module is loaded
   * @private
   */
  private async loadModuleFromInfo(moduleInfo: ModuleInfo, config: ModulesConfig): Promise<void> {
    try {
      if (this.scannerService) {
        await this.scannerService.updateModuleStatus(moduleInfo.name, ModuleStatus.LOADING);
      }

      const relativePath = moduleInfo.path.replace(process.cwd(), '.');
      const importPath = join(relativePath, 'index.js');

      await this.loadModule(moduleInfo.name, importPath, config);

      if (this.scannerService) {
        await this.scannerService.updateModuleStatus(moduleInfo.name, ModuleStatus.RUNNING);
      }
    } catch (error) {
      logger.error(`Failed to load module ${moduleInfo.name}:`, error);
      if (this.scannerService) {
        await this.scannerService.updateModuleStatus(
          moduleInfo.name,
          ModuleStatus.ERROR,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Loads a single module by name and import path
   *
   * @param name - Module name
   * @param importPath - Path to import the module from
   * @param config - Modules configuration
   * @returns Promise that resolves when module is loaded and initialized
   * @private
   */
  private async loadModule(name: string, importPath: string, config: ModulesConfig): Promise<void> {
    try {
      logger.debug(`Loading module: ${name} from ${importPath}`);

      const moduleExports = await import(importPath);

      const moduleClassName = Object.keys(moduleExports).find(
        (key) => key.toLowerCase().includes(name.toLowerCase()) && key.includes('Module'),
      );

      if (!moduleClassName) {
        throw new Error(`No module class found in ${importPath}`);
      }

      const ModuleClass = moduleExports[moduleClassName];
      const moduleInstance = new ModuleClass();

      const context = {
        config: config.modules[name]?.config || {},
        logger: logger,
      };

      await moduleInstance.initialize(context);

      this.registry.register(moduleInstance);

      if (config.modules[name]?.autoStart) {
        await moduleInstance.start();
      }

      logger.info(`Module ${name} loaded successfully`);
    } catch (error) {
      logger.error(`Failed to load module ${name}:`, error);
      throw error;
    }
  }

  /**
   * Shuts down all loaded modules in reverse order
   *
   * @returns Promise that resolves when all modules are shut down
   * @public
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down modules...');

    const modules = this.registry.getAll();

    for (const module of modules.reverse()) {
      try {
        if (module.stop) {
          await module.stop();
        }

        if (this.scannerService) {
          await this.scannerService.updateModuleStatus(module.name, ModuleStatus.STOPPED);
        }
      } catch (error) {
        logger.error(`Error stopping module ${module.name}:`, error);
      }
    }

    logger.info('All modules shut down');
  }

  /**
   * Gets the module registry
   *
   * @returns The module registry instance
   * @public
   */
  getRegistry(): ModuleRegistry {
    return this.registry;
  }

  /**
   * Gets a specific module by name
   *
   * @param name - Module name to retrieve
   * @returns The module instance or undefined if not found
   * @public
   */
  getModule(name: string): any {
    return this.registry.get(name);
  }
}

/**
 * Gets the singleton module loader instance
 *
 * @param configPath - Optional path to modules configuration file
 * @returns The singleton ModuleLoader instance
 * @public
 */
export function getModuleLoader(configPath?: string): ModuleLoader {
  return ModuleLoader.getInstance(configPath);
}
