/**
 * Core module loader service.
 * Handles loading and initialization of core system modules.
 * @module modules/core/modules/services/core-module-loader
 */

import { pathToFileURL } from 'url';
import type { IModule } from '@/modules/core/modules/types/manual';
import type { ICoreModuleDefinition } from '@/types/bootstrap';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Service for loading core system modules.
 * Core modules are essential system components loaded during bootstrap.
 */
export class CoreModuleLoaderService {
  private static instance: CoreModuleLoaderService;
  private readonly loadedModules = new Map<string, IModule>();
  private readonly logger = LoggerService.getInstance();

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns CoreModuleLoaderService instance.
   */
  static getInstance(): CoreModuleLoaderService {
    CoreModuleLoaderService.instance ||= new CoreModuleLoaderService();
    return CoreModuleLoaderService.instance;
  }

  /**
   * Register an already loaded module.
   * @param name - Module name.
   * @param module - Module instance.
   */
  registerLoadedModule(name: string, module: IModule): void {
    this.loadedModules.set(name, module);
    this.logger.debug(LogSource.MODULES, `Registered pre-loaded module: ${name}`, {
      category: 'core-loader',
      persistToDb: false
    });
  }

  /**
   * Load a core module.
   * @param definition - Module definition.
   * @returns Loaded module instance.
   */
  async loadModule(definition: ICoreModuleDefinition): Promise<IModule> {
    const {
 name, path, dependencies
} = definition;

    for (const dep of dependencies) {
      if (!this.loadedModules.has(dep)) {
        throw new Error(`Dependency '${dep}' not loaded for module '${name}'`);
      }
    }

    try {
      const { href: resolvedPath } = new URL(path, pathToFileURL(`${process.cwd()}/`));
      const moduleExports = await import(resolvedPath);

      let moduleInstance: IModule;

      if (typeof moduleExports.createModule === 'function') {
        moduleInstance = moduleExports.createModule();
      } else if (typeof moduleExports.default === 'function') {
        const ModuleConstructor = moduleExports.default;
        moduleInstance = new ModuleConstructor();
      } else {
        throw new Error(`Module ${name} must export createModule function or default constructor`);
      }

      if (!this.isValidModule(moduleInstance)) {
        throw new Error(`Invalid module instance for ${name}`);
      }

      this.loadedModules.set(name, moduleInstance);
      this.logger.debug(LogSource.MODULES, `Loaded core module: ${name}`);

      return moduleInstance;
    } catch (error) {
      this.logger.error(LogSource.MODULES, `Failed to load module ${name}`, {
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * Initialize a loaded module.
   * @param name - Module name.
   */
  async initializeModule(name: string): Promise<void> {
    const module = this.loadedModules.get(name);
    if (!module) {
      throw new Error(`Module ${name} not loaded`);
    }

    if (typeof module.initialize === 'function') {
      await module.initialize();
      this.logger.debug(LogSource.MODULES, `Initialized module: ${name}`);
    }
  }

  /**
   * Start a loaded module.
   * @param name - Module name.
   */
  async startModule(name: string): Promise<void> {
    const module = this.loadedModules.get(name);
    if (!module) {
      throw new Error(`Module ${name} not loaded`);
    }

    if (typeof (module as any).start === 'function') {
      await (module as any).start();
      this.logger.debug(LogSource.MODULES, `Started module: ${name}`);
    }
  }

  /**
   * Get a loaded module.
   * @param name - Module name.
   * @returns Module instance or undefined.
   */
  getModule(name: string): IModule | undefined {
    return this.loadedModules.get(name);
  }

  /**
   * Get all loaded modules.
   * @returns Map of loaded modules.
   */
  getAllModules(): Map<string, IModule> {
    return new Map(this.loadedModules);
  }

  /**
   * Check if a module is valid.
   * @param instance - Module instance to validate.
   * @returns True if valid module.
   */
  private isValidModule(instance: unknown): instance is IModule {
    if (
      typeof instance !== 'object'
      || instance === null
      || !('name' in instance)
      || !('version' in instance)
      || !('type' in instance)
    ) {
      return false;
    }

    const module = instance as any;
    return typeof module.name === 'string' && module.name.length >= 2;
  }

  /**
   * Clear all loaded modules.
   * Used for testing or reset scenarios.
   */
  clear(): void {
    this.loadedModules.clear();
  }
}
