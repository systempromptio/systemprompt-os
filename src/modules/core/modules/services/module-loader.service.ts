/**
 * Module Loader Service.
 * Handles dynamic loading of modules during bootstrap and runtime.
 * Uses modern ES modules and TypeScript patterns.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IModule } from '@/modules/core/modules/types/index';
import { ModulesStatus } from '@/modules/core/modules/types/database.generated';
import type {
  IModuleConfiguration,
  ModuleExports,
} from '@/modules/core/modules/types/loader.types';
import { ModuleRegistryService } from '@/modules/core/modules/services/module-registry.service';

export class ModuleLoaderService {
  private static instance: ModuleLoaderService | null = null;
  private readonly logger = LoggerService.getInstance();
  private readonly registry: ModuleRegistryService;
  private readonly configPath: string;

  private constructor(configPath?: string) {
    this.configPath = configPath ?? join(process.cwd(), 'config', 'modules.json');
    this.registry = ModuleRegistryService.getInstance();
  }

  static getInstance(configPath?: string): ModuleLoaderService {
    ModuleLoaderService.instance ||= new ModuleLoaderService(configPath);
    return ModuleLoaderService.instance;
  }

  /**
   * Load all modules from configuration.
   */
  async loadModules(): Promise<void> {
    this.logger.info(LogSource.MODULES, 'Starting module loading process');

    try {
      const config = this.loadModuleConfig();
      await this.loadCoreModules(config);
      this.logger.info(LogSource.MODULES, 'Module loading completed successfully');
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Module loading failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load a single module by name and configuration.
   * @param moduleName
   * @param moduleConfig
   */
  async loadModule(moduleName: string, moduleConfig: IModuleConfiguration | any): Promise<void> {
    this.logger.debug(LogSource.MODULES, `Loading module: ${moduleName}`);

    try {
      const modulePath = this.resolveModulePath(moduleName);
      const module = await this.importModule(modulePath, moduleName);

      if (module.status === ModulesStatus.PENDING && module.initialize) {
        await module.initialize();
      }

      this.registry.register(module);

      if (moduleConfig.autoStart && module.start) {
        await module.start();
      }

      this.logger.info(LogSource.MODULES, `Successfully loaded module: ${moduleName}`);
    } catch (error) {
      throw new Error(
        `Failed to load module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Import a module using dynamic import.
   * @param modulePath
   * @param moduleName
   */
  private async importModule(modulePath: string, moduleName: string): Promise<IModule> {
    try {
      const moduleUrl = pathToFileURL(modulePath).href;
      const exports: ModuleExports = await import(moduleUrl);

      if (exports.createModule && typeof exports.createModule === 'function') {
        return exports.createModule();
      }

      if (exports.default) {
        if (typeof exports.default === 'function') {
          return exports.default();
        }
        return exports.default;
      }

      const moduleClassName = `${moduleName.charAt(0).toUpperCase()}${moduleName.slice(1)}Module`;
      const ModuleClass = exports[moduleClassName];

      if (ModuleClass && typeof ModuleClass === 'function') {
        return new ModuleClass();
      }

      throw new Error(
        `No valid module export found. Expected createModule function, default export, or ${moduleClassName} class`,
      );
    } catch (error) {
      throw new Error(
        `Failed to import module from ${modulePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Resolve the file path for a module.
   * @param moduleName
   */
  private resolveModulePath(moduleName: string): string {
    const paths = [
      join(process.cwd(), 'src', 'modules', 'core', moduleName, 'index.ts'),
      join(process.cwd(), 'src', 'modules', 'core', moduleName, 'index.js'),
      join(process.cwd(), 'dist', 'modules', 'core', moduleName, 'index.js'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return path;
      }
    }

    throw new Error(`Module file not found for '${moduleName}'. Tried: ${paths.join(', ')}`);
  }

  /**
   * Load core modules from configuration.
   * @param config
   * @param config.modules
   */
  private async loadCoreModules(config: {
    modules: Record<string, IModuleConfiguration>;
  }): Promise<void> {
    const moduleEntries = Object.entries(config.modules || {})
      .filter(([, moduleConfig]) => {
        return moduleConfig.enabled;
      })
      .sort(([, a], [, b]) => {
        const aDeps = a.dependencies?.length || 0;
        const bDeps = b.dependencies?.length || 0;
        return aDeps - bDeps;
      });

    for (const [moduleName, moduleConfig] of moduleEntries) {
      try {
        await this.loadModule(moduleName, moduleConfig);
      } catch (error) {
        this.logger.error(LogSource.MODULES, `Failed to load core module '${moduleName}':`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  /**
   * Load module configuration from file.
   */
  private loadModuleConfig(): { modules: Record<string, IModuleConfiguration> } {
    if (!existsSync(this.configPath)) {
      this.logger.warn(
        LogSource.MODULES,
        `Module config not found at ${this.configPath}, using defaults`,
      );
      return { modules: {} };
    }

    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(configData) as { modules: Record<string, IModuleConfiguration> };
    } catch (error) {
      this.logger.error(
        LogSource.MODULES,
        `Failed to load module config from ${this.configPath}:`,
        {
          error: error instanceof Error ? error : new Error(String(error)),
        },
      );
      return { modules: {} };
    }
  }

  /**
   * Register a module definition for later loading.
   * @param definition
   */
  async registerModuleDefinition(definition: any): Promise<void> {
    this.logger.debug(
      LogSource.MODULES,
      `Registered module definition: ${definition.name} at ${definition.path}`,
    );
  }

  /**
   * Get the module registry.
   */
  getRegistry(): ModuleRegistryService {
    return this.registry;
  }

  /**
   * Start all registered modules.
   */
  async startModules(): Promise<void> {
    await this.registry.startAllModules();
  }

  /**
   * Stop all registered modules.
   */
  async stopModules(): Promise<void> {
    await this.registry.stopAllModules();
  }
}
