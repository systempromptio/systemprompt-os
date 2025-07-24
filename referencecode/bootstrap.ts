/**
 * Bootstrap module loader for SystemPrompt OS
 *
 * Provides a minimal, dependency-free bootstrap process that loads core modules
 * in the correct order without circular dependencies.
 */

import { Container } from 'typedi';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { TYPES } from '@/modules/core/types.js';
import type { IModule } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';

/**
 * Bootstrap configuration
 */
export interface BootstrapConfig {
  logger?: ILogger;
  configPath?: string;
  statePath?: string;
  environment?: string;
}

/**
 * Core module definition
 */
interface CoreModuleDefinition {
  name: string;
  path: string;
  dependencies: string[];
  critical: boolean;
}

/**
 * Bootstrap class for loading core modules without circular dependencies
 */
export class Bootstrap {
  private readonly logger: ILogger;
  private readonly modules: Map<string, IModule> = new Map();
  private readonly config: GlobalConfiguration;

  /**
   * Core modules that must be loaded in order
   */
  private readonly coreModules: CoreModuleDefinition[] = [
    {
      name: 'logger',
      path: './modules/core/logger/index.js',
      dependencies: [],
      critical: true,
    },
    {
      name: 'database',
      path: './modules/core/database/index.js',
      dependencies: ['logger'],
      critical: true,
    },
    {
      name: 'config',
      path: './modules/core/config/index.js',
      dependencies: ['logger', 'database'],
      critical: true,
    },
    {
      name: 'permissions',
      path: './modules/core/permissions/index.js',
      dependencies: ['logger', 'database'],
      critical: true,
    },
    {
      name: 'auth',
      path: './modules/core/auth/index.js',
      dependencies: ['logger', 'database', 'permissions'],
      critical: true,
    },
    {
      name: 'modules',
      path: './modules/core/modules/index.js',
      dependencies: ['logger', 'database'],
      critical: true,
    },
  ];

  constructor(config: BootstrapConfig = {}) {
    this.logger = config.logger || LoggerService.getInstance();

    // Build global configuration
    this.config = {
      configPath: config.configPath || process.env['CONFIG_PATH'] || './config',
      statePath: config.statePath || process.env['STATE_PATH'] || './state',
      environment: config.environment || process.env['NODE_ENV'] || 'development',
      modules: {},
    };

    // Setup initial container bindings
    Container.set(TYPES.Logger, this.logger);
    Container.set(TYPES.Config, this.config);
  }

  /**
   * Bootstrap the core modules
   */
  async bootstrap(): Promise<Map<string, IModule>> {
    this.logger.info('Starting bootstrap process...');

    try {
      // Load core modules in dependency order
      for (const moduleDefinition of this.coreModules) {
        await this.loadCoreModule(moduleDefinition);
      }

      // Initialize all loaded modules
      await this.initializeModules();

      // Start critical modules
      await this.startCriticalModules();

      this.logger.info('Bootstrap process completed successfully');
      return this.modules;
    } catch (error) {
      this.logger.error('Bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Load a single core module
   */
  private async loadCoreModule(definition: CoreModuleDefinition): Promise<void> {
    const { name, path, dependencies } = definition;

    this.logger.debug(`Loading core module: ${name}`);

    // Check dependencies are loaded
    for (const dep of dependencies) {
      if (!this.modules.has(dep)) {
        throw new Error(`Dependency '${dep}' not loaded for module '${name}'`);
      }
    }

    try {
      // Dynamic import
      const moduleExports = await import(path);

      // Get the module class from exports
      let ModuleClass: any = null;

      // Check common export patterns
      const moduleClassName = `${name.charAt(0).toUpperCase() + name.slice(1)  }Module`;

      if (moduleExports[moduleClassName]) {
        ModuleClass = moduleExports[moduleClassName];
      } else if (moduleExports.default) {
        ModuleClass = moduleExports.default;
      } else {
        // Look for a class that ends with 'Module'
        const moduleKey = Object.keys(moduleExports).find(
          (key) => key.endsWith('Module') && typeof moduleExports[key] === 'function',
        );
        if (moduleKey) {
          ModuleClass = moduleExports[moduleKey];
        }
      }

      if (!ModuleClass) {
        throw new Error(`No module class found in ${path}`);
      }

      // Get the module instance from the container (TypeDI will handle instantiation)
      const moduleInstance = Container.get<IModule>(ModuleClass);

      if (!this.isValidModule(moduleInstance)) {
        throw new Error(`Invalid module instance for ${name}`);
      }

      this.modules.set(name, moduleInstance);

      this.logger.debug(`Loaded core module: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to load core module ${name}:`, error);
      throw error;
    }
  }

  /**
   * Initialize all loaded modules
   */
  private async initializeModules(): Promise<void> {
    this.logger.info('Initializing core modules...');

    for (const [name, module] of this.modules) {
      try {
        this.logger.debug(`Initializing module: ${name}`);

        if (module.initialize) {
          await module.initialize();
        }

        this.logger.debug(`Initialized module: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to initialize module ${name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Start critical modules
   */
  private async startCriticalModules(): Promise<void> {
    this.logger.info('Starting critical modules...');

    const criticalModuleNames = this.coreModules.filter((m) => m.critical).map((m) => m.name);

    for (const name of criticalModuleNames) {
      const module = this.modules.get(name);
      if (!module) {continue;}

      try {
        this.logger.debug(`Starting module: ${name}`);

        if (module.start) {
          await module.start();
        }

        this.logger.debug(`Started module: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to start module ${name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Check if an export is a valid module
   */
  private isValidModule(obj: any): obj is IModule {
    return obj && typeof obj === 'object' && 'name' in obj && 'version' in obj && 'type' in obj;
  }

  /**
   * Get a loaded module by name
   */
  getModule(name: string): IModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all loaded modules
   */
  getModules(): Map<string, IModule> {
    return new Map(this.modules);
  }

  /**
   * Shutdown all modules in reverse order
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down modules...');

    // Get modules in reverse order
    const moduleNames = Array.from(this.modules.keys()).reverse();

    for (const name of moduleNames) {
      const module = this.modules.get(name);
      if (!module) {continue;}

      try {
        if (module.stop) {
          this.logger.debug(`Stopping module: ${name}`);
          await module.stop();
        }
      } catch (error) {
        this.logger.error(`Error stopping module ${name}:`, error);
      }
    }

    this.modules.clear();
    this.logger.info('All modules shut down');
  }
}

/**
 * Create and run bootstrap process
 */
export async function runBootstrap(config?: BootstrapConfig): Promise<Map<string, IModule>> {
  const bootstrap = new Bootstrap(config);
  return await bootstrap.bootstrap();
}
