/**
 * Bootstrap module loader for SystemPrompt OS.
 * @file Bootstrap module loader for SystemPrompt OS.
 * @module bootstrap
 */
import type { IModule } from './modules/core/modules/types/manual';
import { CoreModuleScanner } from './bootstrap/helpers/module-scanner';
import { DependencyResolver } from './bootstrap/helpers/dependency-resolver';
import { shutdownAllModules } from './bootstrap/shutdown-helper';
// Simplified bootstrap - no phase executor needed
import { LoggerService } from './modules/core/logger/services/logger.service';
import { LogSource } from './modules/core/logger/types/manual';
import { createLoggerModuleForBootstrap } from './modules/core/logger';
import type {
  CoreModuleType,
  IBootstrapOptions,
  ICoreModuleDefinition,
} from './types/bootstrap';

/**
 * Bootstrap class manages the initialization lifecycle of SystemPrompt OS.
 */
export class Bootstrap {
  private readonly modules: Map<string, CoreModuleType> = new Map();
  private readonly options: IBootstrapOptions;
  private coreModules: ICoreModuleDefinition[] = [];
  private isReady = false;
  private readonly moduleScanner = new CoreModuleScanner();
  private readonly dependencyResolver = new DependencyResolver();

  constructor(options: IBootstrapOptions = {}) {
    this.options = options;
  }

  /**
   * Main bootstrap method - simplified approach.
   */
  async bootstrap(): Promise<Map<string, IModule>> {
    try {
      await this.loadLoggerModule();

      const logger = LoggerService.getInstance();
      logger.info(LogSource.BOOTSTRAP, 'Starting bootstrap process', { category: 'startup' });
      logger.info(LogSource.BOOTSTRAP, 'Discovering core modules', { category: 'discovery' });
      const discoveredModules = await this.moduleScanner.scan();
      this.coreModules = this.dependencyResolver.resolve(discoveredModules);
      logger.info(LogSource.BOOTSTRAP, `Discovered ${this.coreModules.length} core modules`, {
        modules: this.coreModules.map(m => { return m.name })
      });

      for (const module of this.coreModules) {
        await this.loadCoreModule(module);
      }

      this.isReady = true;
      logger.info(LogSource.BOOTSTRAP, `Bootstrap completed - ${this.modules.size} modules`, {
        category: 'startup'
      });
      return this.modules;
    } catch (error) {
      // Only try to log if logger is initialized
      try {
        const logger = LoggerService.getInstance();
        if (this.modules.has('logger')) {
          logger.error(LogSource.BOOTSTRAP, 'Bootstrap failed', {
            error: error instanceof Error ? error.message : String(error),
            category: 'startup'
          });
        }
      } catch {
        // If logger fails, just console.error
        console.error('Bootstrap failed:', error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  }

  getCurrentPhase(): string {
    return this.isReady ? 'ready' : 'init';
  }

  hasCompletedPhase(phase: string): boolean {
    return this.isReady;
  }

  getModule(name: string): IModule | undefined {
    return this.modules.get(name);
  }

  getModules(): Map<string, IModule> {
    return new Map(this.modules);
  }

  /**
   * Shutdown all modules.
   */
  async shutdown(): Promise<void> {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Shutting down system', { category: 'shutdown' });
    await shutdownAllModules(this.modules, logger);
    this.modules.clear();
    this.isReady = false;
    logger.info(LogSource.BOOTSTRAP, 'All modules shut down', { category: 'shutdown' });
  }

  private async loadLoggerModule(): Promise<void> {
    const loggerModule = await createLoggerModuleForBootstrap();
    this.modules.set('logger', loggerModule);
  }

  /**
   * Load a single core module by its definition.
   * @param definition
   */
  private async loadCoreModule(definition: ICoreModuleDefinition): Promise<void> {
    if (this.modules.has(definition.name)) {
      return;
    }

    const logger = LoggerService.getInstance();
    try {
      logger.info(LogSource.BOOTSTRAP, `Loading module: ${definition.name}`, { category: 'module' });

      const moduleImport = await import(definition.path);
      const moduleInstance = moduleImport.createModule ? moduleImport.createModule() : moduleImport.default;

      if (moduleInstance?.initialize) { await moduleInstance.initialize(); }
      if (moduleInstance?.start) { await moduleInstance.start(); }

      this.modules.set(definition.name, moduleInstance);
      logger.info(LogSource.BOOTSTRAP, `Module loaded: ${definition.name}`, { category: 'module' });
    } catch (error) {
      logger.error(LogSource.BOOTSTRAP, `Failed to load module: ${definition.name}`, {
        error: error instanceof Error ? error.message : String(error),
        category: 'module'
      });
      if (definition.critical) {
        throw error;
      }
    }
  }
}

/**
 * Factory function to create and run bootstrap.
 * @param options
 */
export const runBootstrap = async (options: IBootstrapOptions = {}): Promise<Bootstrap> => {
  const bootstrap = new Bootstrap(options);
  await bootstrap.bootstrap();
  return bootstrap;
};
