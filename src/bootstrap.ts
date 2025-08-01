/**
 * Bootstrap module loader for SystemPrompt OS.
 */
import type { IModule } from './modules/core/modules/types/manual';
import type { IModulesModuleExports } from './modules/core/modules/types/manual';
import { shutdownAllModules } from './bootstrap/shutdown-helper';
import { LoggerService } from './modules/core/logger/services/logger.service';
import { LogSource } from './modules/core/logger/types/manual';
import { createLoggerModuleForBootstrap } from './modules/core/logger';
import { ModuleRegistryService } from './modules/core/modules/services/module-registry.service';
import { CoreModuleLoaderService } from './modules/core/modules/services/core-module-loader.service';
import type { IBootstrapOptions } from './types/bootstrap';

interface ModuleDefinition {
  name: string;
  deps: string[];
}

/**
 * Bootstrap class manages the initialization lifecycle of SystemPrompt OS.
 */
export class Bootstrap {
  private readonly options: IBootstrapOptions;
  private isReady = false;
  private moduleRegistry?: ModuleRegistryService;

  /**
   * Creates a new Bootstrap instance.
   * @param options - Bootstrap configuration options.
   */
  constructor(options: IBootstrapOptions = {}) {
    this.options = options;
  }

  /**
   * Main bootstrap method that initializes the system.
   * @returns Map of initialized modules.
   */
  async bootstrap(): Promise<Map<string, IModule>> {
    try {
      const loggerModule = await createLoggerModuleForBootstrap();
      const logger = LoggerService.getInstance();
      logger.info(LogSource.BOOTSTRAP, 'Starting bootstrap process');

      this.moduleRegistry = ModuleRegistryService.getInstance();
      this.moduleRegistry.register(loggerModule);

      const databaseModule = await this.loadCoreModuleManually('database', ['logger']);
      this.moduleRegistry.register(databaseModule);
      logger.info(LogSource.BOOTSTRAP, 'Database module loaded');

      const modulesModule = await this.initializeModulesModule();
      this.moduleRegistry.register(modulesModule);
      logger.info(LogSource.BOOTSTRAP, 'Modules module initialized');

      await this.loadRemainingCoreModules(modulesModule);

      this.isReady = true;
      const loadedModules = this.moduleRegistry.getAll();
      const moduleCount = String(loadedModules.size);
      logger.info(LogSource.BOOTSTRAP, `Bootstrap completed - ${moduleCount} modules loaded`);
      return loadedModules;
    } catch (error) {
      this.handleBootstrapError(error);
      throw error;
    }
  }

  /**
   * Gets a module by name.
   * @param name - Module name.
   * @returns Module instance or undefined.
   */
  getModule(name: string): IModule | undefined {
    return this.moduleRegistry?.get(name);
  }

  /**
   * Gets a copy of all modules.
   * @returns Map of all modules.
   */
  getModules(): Map<string, IModule> {
    return this.moduleRegistry?.getAll() ?? new Map<string, IModule>();
  }

  /**
   * Gets the current bootstrap phase.
   * @returns Current phase string.
   */
  getCurrentPhase(): string {
    return this.isReady ? 'ready' : 'init';
  }

  /**
   * Checks if a phase has been completed.
   * @param phase - Phase name (unused in simplified implementation).
   * @returns True if ready.
   */
  hasCompletedPhase(phase: string): boolean {
    void phase; // Acknowledge unused parameter
    return this.isReady;
  }

  /**
   * Gets bootstrap options.
   * @returns Bootstrap options.
   */
  getOptions(): IBootstrapOptions {
    return this.options;
  }

  /**
   * Shuts down all modules cleanly.
   */
  async shutdown(): Promise<void> {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Shutting down system');
    const modules = this.moduleRegistry?.getAll() ?? new Map<string, IModule>();
    await shutdownAllModules(modules, logger);
    this.isReady = false;
    logger.info(LogSource.BOOTSTRAP, 'Shutdown complete');
  }

  /**
   * Initialize the modules module manually.
   * @returns The initialized modules module.
   */
  private async initializeModulesModule(): Promise<IModule> {
    const modulePath = './modules/core/modules/index.ts';
    // Dynamic import needed for bootstrapping - modules not available at import time
    // eslint-disable-next-line no-restricted-syntax
    const moduleImport = await import(modulePath) as {
      createModule: () => IModule<IModulesModuleExports>;
    };
    const moduleInstance = moduleImport.createModule();
    await moduleInstance.initialize();
    if (moduleInstance.start !== undefined) {
      await moduleInstance.start();
    }
    return moduleInstance;
  }

  /**
   * Manually load a core module without using modules service.
   * @param name - Module name.
   * @param dependencies - Module dependencies.
   * @returns The loaded module.
   */
  private async loadCoreModuleManually(name: string, dependencies: string[]): Promise<IModule> {
    const logger = LoggerService.getInstance();

    for (const dep of dependencies) {
      const registry = this.moduleRegistry;
      if (registry === undefined || registry.get(dep) === undefined) {
        throw new Error(`Missing dependency '${dep}' for module '${name}'`);
      }
    }

    const modulePath = `./modules/core/${name}/index.ts`;
    // Dynamic import needed for bootstrapping - modules not available at import time
    // eslint-disable-next-line no-restricted-syntax
    const moduleImport = await import(modulePath) as {
      createModule?: () => IModule;
      initialize?: () => Promise<IModule>;
    };

    let moduleInstance: IModule;
    if (typeof moduleImport.createModule === 'function') {
      moduleInstance = moduleImport.createModule();
    } else if (typeof moduleImport.initialize === 'function') {
      moduleInstance = await moduleImport.initialize();
    } else {
      throw new Error(`Module '${name}' does not export createModule or initialize`);
    }

    await moduleInstance.initialize();

    if (moduleInstance.start !== undefined) {
      await moduleInstance.start();
    }

    logger.info(LogSource.BOOTSTRAP, `Manually loaded module: ${name}`);
    return moduleInstance;
  }

  /**
   * Load remaining core modules using modules service.
   * @param modulesModule - The modules module instance.
   */
  private async loadRemainingCoreModules(modulesModule: IModule): Promise<void> {
    await this.registerPreloadedModules(modulesModule);
    await this.loadCoreModulesInOrder(modulesModule);
  }

  /**
   * Register pre-loaded modules with the modules service.
   * @param modulesModule - The modules module instance.
   */
  private async registerPreloadedModules(modulesModule: IModule): Promise<void> {
    const moduleExports = modulesModule.exports as IModulesModuleExports;
    const registry = this.moduleRegistry;
    
    if (registry === undefined) {
      throw new Error('Module registry not initialized');
    }

    const loggerModule = registry.get('logger');
    const databaseModule = registry.get('database');

    if (loggerModule !== undefined) {
      moduleExports.registerPreLoadedModule('logger', loggerModule);
    }
    if (databaseModule !== undefined) {
      moduleExports.registerPreLoadedModule('database', databaseModule);
    }
    moduleExports.registerPreLoadedModule('modules', modulesModule);

    const coreLoader = CoreModuleLoaderService.getInstance();
    if (loggerModule !== undefined) {
      coreLoader.registerLoadedModule('logger', loggerModule);
    }
    if (databaseModule !== undefined) {
      coreLoader.registerLoadedModule('database', databaseModule);
    }
    coreLoader.registerLoadedModule('modules', modulesModule);
  }

  /**
   * Load core modules in dependency order.
   * @param modulesModule - The modules module instance.
   */
  private async loadCoreModulesInOrder(modulesModule: IModule): Promise<void> {
    const logger = LoggerService.getInstance();
    const moduleExports = modulesModule.exports as IModulesModuleExports;

    const coreModules: ModuleDefinition[] = [
      { name: 'events', deps: ['logger'] },
      { name: 'auth', deps: ['logger', 'database', 'events'] },
      { name: 'cli', deps: ['logger', 'database'] },
      { name: 'config', deps: ['logger', 'database'] },
      { name: 'users', deps: ['logger', 'database', 'events'] },
      { name: 'permissions', deps: ['logger', 'database'] },
      { name: 'system', deps: ['logger', 'database'] },
      { name: 'agents', deps: ['logger', 'database', 'events'] },
      { name: 'tasks', deps: ['logger', 'database', 'events'] },
      { name: 'monitor', deps: ['logger', 'database'] },
      { name: 'webhooks', deps: ['logger', 'database', 'events'] },
      { name: 'mcp', deps: ['logger', 'database'] },
      { name: 'dev', deps: ['logger', 'database'] }
    ];

    const criticalModules = ['logger', 'database', 'events', 'auth', 'cli', 'modules'];

    // Sequential loading is required to ensure dependency order
    // eslint-disable-next-line no-await-in-loop
    for (const { name, deps } of coreModules) {
      try {
        const definition = {
          name,
          path: `./modules/core/${name}/index.ts`,
          dependencies: deps,
          critical: criticalModules.includes(name),
          description: `${name} module`,
          type: 'self-contained' as const
        };

        // Sequential loading is required to ensure dependency order
        // eslint-disable-next-line no-await-in-loop
        await moduleExports.loadCoreModule(definition);
        logger.info(LogSource.BOOTSTRAP, `Module loaded: ${name}`);
      } catch (error) {
        logger.error(LogSource.BOOTSTRAP, `Failed to load module: ${name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        if (criticalModules.includes(name)) {
          throw error;
        }
      }
    }
  }

  /**
   * Handles bootstrap errors with appropriate logging.
   * @param error - The error that occurred.
   */
  private handleBootstrapError(error: unknown): void {
    const logger = LoggerService.getInstance();
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    try {
      logger.error(LogSource.BOOTSTRAP, 'Bootstrap failed', { error: errorMessage });
    } catch {
      // Fallback if logger is not available
      // eslint-disable-next-line no-console
      console.error('Bootstrap failed:', errorMessage);
    }
  }
}

/**
 * Factory function to create and run bootstrap.
 * @param options - Bootstrap options.
 * @returns Bootstrap instance.
 */
export const runBootstrap = async (options: IBootstrapOptions = {}): Promise<Bootstrap> => {
  const bootstrap = new Bootstrap(options);
  await bootstrap.bootstrap();
  return bootstrap;
};