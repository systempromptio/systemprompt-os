/**
 * Bootstrap module loader for SystemPrompt OS.
 * @file Bootstrap module loader for SystemPrompt OS.
 * @module bootstrap
 */

import type { Express } from 'express';
import { CORE_MODULES } from './const/bootstrap';
import { setupMcpServers } from './server/mcp/index';
import { ZERO } from './const/numbers';
import {
 consoleDebug, consoleError, createConsoleLogger
} from './utils/console-logger';
import {
  BootstrapPhaseEnum,
  type CoreModuleType,
  type GlobalConfiguration,
  type IBootstrapOptions,
  type ICoreModuleDefinition,
} from './types/bootstrap';
import { LogSource, type ILogger } from '@/modules/core/logger/types/index';
import type { IModulesModuleExports } from '@/modules/core/modules/index';
import type { ICLIModuleExports } from '@/modules/core/cli/index';
import type { IModule, ModuleInfo } from '@/modules/core/modules/types/index';
import { isDatabaseModule, type IDatabaseModuleExports } from '@/modules/core/database/index';
import { isLoggerModule, type ILoggerModuleExports } from '@/modules/core/logger/index';
import type { IModuleExports } from './types/bootstrap-module';

import { loadCoreModule, loadExtensionModule } from './bootstrap/module-loader';

/**
 * Type guard function to check if module is a modules module.
 * @param {CoreModuleType} moduleInstance - Module to check.
 * @returns {boolean} True if module is a modules module.
 */
const isModulesModule = (moduleInstance: CoreModuleType): moduleInstance is IModule<IModulesModuleExports> => {
  return moduleInstance.name === 'modules'
         && Boolean(moduleInstance.exports)
         && typeof moduleInstance.exports === 'object'
         && 'registerCoreModule' in moduleInstance.exports;
};

/**
 * Type guard function to check if module is a CLI module.
 * @param {CoreModuleType} moduleInstance - Module to check.
 * @returns {boolean} True if module is a CLI module.
 */
const isCLIModule = (moduleInstance: CoreModuleType): moduleInstance is IModule<ICLIModuleExports> => {
  return moduleInstance.name === 'cli'
         && Boolean(moduleInstance.exports)
         && typeof moduleInstance.exports === 'object'
         && 'scanAndRegisterModuleCommands' in moduleInstance.exports;
};
import { shutdownAllModules } from './bootstrap/shutdown-helper';
import {
  checkLoggerUpgrade,
  initializeSingleModule,
  startSingleModule,
} from './bootstrap/module-init-helper';
import {
  initializeModulesInOrder,
  loadCoreModulesInOrder,
  loadEnabledExtensionModules,
  startModulesInOrder,
} from './bootstrap/sequential-loader';
import { isModuleExports } from './bootstrap/type-guards';
import { loadExpressApp } from './bootstrap/express-loader';

/**
 * Bootstrap class manages the initialization lifecycle of SystemPrompt OS.
 * Core modules are loaded sequentially to respect dependency order.
 * MCP servers use dynamic imports for lazy loading when enabled.
 * Extension modules are discovered and loaded based on configuration.
 */
export class Bootstrap {
  private readonly config: GlobalConfiguration;
  private readonly modules: Map<string, CoreModuleType> = new Map();
  private readonly options: IBootstrapOptions;
  private readonly coreModules: ICoreModuleDefinition[] = CORE_MODULES;
  private logger: ILogger;
  private currentPhase: BootstrapPhaseEnum = BootstrapPhaseEnum.CORE_MODULES;
  private mcpApp?: Express;

  /**
   * Creates a new Bootstrap instance.
   * @param {IBootstrapOptions} bootstrapOptions - Bootstrap configuration options.
   */
  constructor(bootstrapOptions: IBootstrapOptions = {}) {
    this.options = bootstrapOptions;
    const { logger } = bootstrapOptions;
    if (logger === undefined) {
      this.logger = createConsoleLogger();
    } else {
      this.logger = logger;
    }

    const {
 configPath, statePath, environment
} = bootstrapOptions;
    this.config = {
      configPath: configPath ?? process.env.CONFIG_PATH ?? './config',
      statePath: statePath ?? process.env.STATE_PATH ?? './state',
      environment: environment ?? process.env.NODE_ENV ?? 'development',
      modules: {},
    };
  }

  /**
   * Main bootstrap method that orchestrates the entire initialization process.
   * @returns {Promise<Map<string, IModule>>} Map of loaded modules.
   * @throws {Error} If any critical phase fails.
   */
  async bootstrap(): Promise<Map<string, IModule>> {
    try {
      this.logger.info(LogSource.BOOTSTRAP, 'Starting bootstrap process', { category: 'startup' });

      await this.executeCoreModulesPhase();

      if (this.options.skipMcp !== true) {
        await this.executeMcpServersPhase();
      }

      if (this.options.skipDiscovery !== true) {
        await this.executeModuleDiscoveryPhase();
      }

      await this.registerCliCommands();

      const { READY } = BootstrapPhaseEnum;
      this.currentPhase = READY;
      this.logger.info(LogSource.BOOTSTRAP, `Bootstrap completed - ${String(this.modules.size)} modules`, { category: 'startup' });

      return this.modules;
    } catch (error) {
      consoleError('❌ Bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Get a loaded module by name.
   * @param {string} name - Module name.
   * @returns {IModule | undefined} Module instance or undefined.
   */
  getModule(name: string): IModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all loaded modules.
   * @returns {Map<string, IModule>} Copy of the modules map.
   */
  getModules(): Map<string, IModule> {
    return new Map(this.modules);
  }

  /**
   * Get the current bootstrap phase.
   * @returns {BootstrapPhaseEnum} Current phase.
   */
  getCurrentPhase(): BootstrapPhaseEnum {
    return this.currentPhase;
  }

  /**
   * Get the MCP Express app (if initialized).
   * @returns {Express | undefined} Express app or undefined.
   */
  getMcpApp(): Express | undefined {
    return this.mcpApp;
  }

  /**
   * Check if a specific phase has completed.
   * @param {BootstrapPhaseEnum} phase - Phase to check.
   * @returns {boolean} True if phase has completed.
   */
  hasCompletedPhase(phase: BootstrapPhaseEnum): boolean {
    const phaseOrder: BootstrapPhaseEnum[] = [
      BootstrapPhaseEnum.CORE_MODULES,
      BootstrapPhaseEnum.MCP_SERVERS,
      BootstrapPhaseEnum.MODULE_DISCOVERY,
      BootstrapPhaseEnum.READY,
    ];

    const currentIndex = phaseOrder.indexOf(this.currentPhase);
    const targetIndex = phaseOrder.indexOf(phase);

    return currentIndex >= targetIndex;
  }

  /**
   * Shutdown all modules in reverse order.
   * @returns {Promise<void>} Promise that resolves when shutdown is complete.
   */
  async shutdown(): Promise<void> {
    this.logger.info(LogSource.BOOTSTRAP, 'Shutting down system', { category: 'shutdown' });

    if (this.hasCompletedPhase(BootstrapPhaseEnum.MODULE_DISCOVERY)) {
      this.logger.info(LogSource.BOOTSTRAP, 'Shutting down autodiscovered modules', { category: 'shutdown' });
    }

    await shutdownAllModules(this.modules, this.logger);

    this.modules.clear();
    const { CORE_MODULES: coreModulesPhase } = BootstrapPhaseEnum;
    this.currentPhase = coreModulesPhase;
    this.logger.info(LogSource.BOOTSTRAP, 'All modules shut down', { category: 'shutdown' });
  }

  /**
   * Phase 1: Load and initialize core modules.
   * Core modules must be loaded sequentially due to dependencies.
   * @returns {Promise<void>} Promise that resolves when phase is complete.
   */
  private async executeCoreModulesPhase(): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Loading core modules', {
 category: 'modules',
persistToDb: false
});
    const { CORE_MODULES: coreModulesPhase } = BootstrapPhaseEnum;
    this.currentPhase = coreModulesPhase;

    const definitions = [...this.coreModules];

    await loadCoreModulesInOrder(definitions, this.loadAndStoreCoreModule.bind(this));

    await this.initializeModules();
    await this.startCriticalModules();

    await this.registerCoreModulesInDatabase();

    this.logger.debug(LogSource.BOOTSTRAP, `Core modules loaded: ${Array.from(this.modules.keys()).join(', ')}`, {
 category: 'modules',
persistToDb: false
});
  }

  /**
   * Phase 2: Setup MCP servers for communication.
   * Uses dynamic import for lazy loading when MCP is enabled.
   * @returns {Promise<void>} Promise that resolves when phase is complete.
   */
  private async executeMcpServersPhase(): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Setting up MCP servers', {
 category: 'mcp',
persistToDb: false
});
    const { MCP_SERVERS } = BootstrapPhaseEnum;
    this.currentPhase = MCP_SERVERS;

    try {
      this.mcpApp ??= await loadExpressApp();

      await setupMcpServers(this.mcpApp);
      this.logger.debug(LogSource.BOOTSTRAP, 'MCP servers initialized', {
 category: 'mcp',
persistToDb: false
});
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, 'Failed to setup MCP servers', {
 category: 'mcp',
error: error as Error
});
      throw error;
    }
  }

  /**
   * Phase 3: Autodiscover and load extension modules.
   * @returns {Promise<void>} Promise that resolves when phase is complete.
   */
  private async executeModuleDiscoveryPhase(): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Autodiscovering modules', {
 category: 'discovery',
persistToDb: false
});
    const { MODULE_DISCOVERY } = BootstrapPhaseEnum;
    this.currentPhase = MODULE_DISCOVERY;

    try {
      const modulesModule = this.modules.get('modules');
      if (modulesModule === undefined || modulesModule.exports === undefined) {
        this.logger.warn(LogSource.BOOTSTRAP, 'Modules module not found or has no exports', { category: 'discovery' });
        return;
      }

      const { exports: moduleExports } = modulesModule;
      if (!isModuleExports(moduleExports)) {
        throw new Error(
          'Invalid modules exports: missing required methods scanForModules or getEnabledModules',
        );
      }
      await this.discoverAndLoadModules(moduleExports);

      this.logger.debug(LogSource.BOOTSTRAP, 'Module autodiscovery completed', {
 category: 'discovery',
persistToDb: false
});
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, 'Module autodiscovery failed', {
 category: 'discovery',
error: error as Error
});
    }
  }

  /**
   * Discover and load extension modules.
   * @param {IModuleExports} moduleExports - Module exports.
   * @returns {Promise<void>} Promise that resolves when discovery is complete.
   */
  private async discoverAndLoadModules(moduleExports: IModuleExports): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Scanning for injectable modules', {
 category: 'discovery',
persistToDb: false
});
    const discoveredModules = await moduleExports.scanForModules();
    this.logger.debug(LogSource.BOOTSTRAP, `Discovered ${String(discoveredModules.length)} injectable modules`, {
 category: 'discovery',
persistToDb: false
});

    if (discoveredModules.length === ZERO) {
      this.logger.warn(LogSource.BOOTSTRAP, 'No modules discovered', { category: 'discovery' });
      return;
    }

    await this.loadDiscoveredModules(moduleExports, discoveredModules);
  }

  /**
   * Load discovered modules checking enabled status.
   * Sequential loading is required to handle module dependencies.
   * @param {IModuleExports} moduleExports - Module exports.
   * @param {ModuleInfo[]} discoveredModules - Discovered modules.
   * @returns {Promise<void>} Promise that resolves when loading is complete.
   */
  private async loadDiscoveredModules(
    moduleExports: IModuleExports,
    discoveredModules: ModuleInfo[],
  ): Promise<void> {
    const enabledModules = await moduleExports.getEnabledModules();
    const enabledNames = new Set(
      enabledModules.map((mod): string => {
        return mod.name;
      }),
    );

    const modules = [...discoveredModules];

    await loadEnabledExtensionModules(
      modules,
      enabledNames,
      this.loadExtensionModuleSafely.bind(this),
      this.logger,
    );
  }

  /**
   * Load an extension module safely with error handling.
   * @param {ModuleInfo} moduleInfo - Module information.
   * @returns {Promise<void>} Promise that resolves when module is loaded.
   */
  private async loadExtensionModuleSafely(moduleInfo: ModuleInfo): Promise<void> {
    try {
      const moduleInstance = await loadExtensionModule(moduleInfo, this.config);
      this.modules.set(moduleInfo.name, moduleInstance);
      this.logger.debug(LogSource.BOOTSTRAP, `Loaded extension module: ${moduleInfo.name}`, {
 category: 'modules',
persistToDb: false
});
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, `Failed to load extension module ${moduleInfo.name}`, {
 category: 'modules',
error: error as Error
});
    }
  }

  /**
   * Register core modules in the database.
   * @returns {Promise<void>} Promise that resolves when registration is complete.
   */
  private async registerCoreModulesInDatabase(): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Registering core modules in database', {
 category: 'database',
persistToDb: false
});

    const modulesModule = this.modules.get('modules');
    if (!modulesModule) {
      this.logger.warn(LogSource.BOOTSTRAP, 'Modules module not loaded, skipping core module registration', { category: 'database' });
      return;
    }

    if (!modulesModule.exports) {
      this.logger.warn(LogSource.BOOTSTRAP, 'Modules module not properly initialized (no exports), skipping core module registration', { category: 'database' });
      return;
    }

    if (!isModulesModule(modulesModule)) {
      this.logger.warn(LogSource.BOOTSTRAP, 'Modules module does not have expected exports interface', { category: 'database' });
      return;
    }

    const {registerCoreModule} = modulesModule.exports;
    if (!registerCoreModule || typeof registerCoreModule !== 'function') {
      this.logger.warn(LogSource.BOOTSTRAP, 'registerCoreModule not available, skipping core module registration', { category: 'database' });
      return;
    }

    try {
      for (const definition of this.coreModules) {
        await registerCoreModule(definition.name, definition.path, definition.dependencies);
      }
      this.logger.debug(LogSource.BOOTSTRAP, 'Core modules registered in database', {
 category: 'database',
persistToDb: false
});
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, 'Failed to register core modules', {
 category: 'database',
error: error as Error
});
    }
  }

  /**
   * Register CLI commands from all loaded modules.
   * @returns {Promise<void>} Promise that resolves when registration is complete.
   */
  private async registerCliCommands(): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Registering CLI commands', {
 category: 'cli',
persistToDb: false
});

    const cliModule = this.modules.get('cli');
    if (!cliModule) {
      this.logger.warn(LogSource.BOOTSTRAP, 'CLI module not loaded, skipping command registration', { category: 'cli' });
      return;
    }

    if (!cliModule.exports) {
      this.logger.warn(LogSource.BOOTSTRAP, 'CLI module not properly initialized (no exports), skipping command registration', { category: 'cli' });
      return;
    }

    if (!isCLIModule(cliModule)) {
      this.logger.warn(LogSource.BOOTSTRAP, 'CLI module does not have expected exports interface', { category: 'cli' });
      return;
    }

    const scanAndRegister = cliModule.exports.scanAndRegisterModuleCommands;
    if (typeof scanAndRegister !== 'function') {
      this.logger.warn(LogSource.BOOTSTRAP, 'CLI module does not export scanAndRegisterModuleCommands', { category: 'cli' });
      return;
    }

    try {
      const moduleMap = new Map<string, { path: string }>();

      const baseModulePath = `${process.cwd()}/src/modules/core/`;

      for (const coreModule of this.coreModules) {
        const moduleName = coreModule.name;
        const modulePath = `${baseModulePath}${moduleName}`;
        moduleMap.set(moduleName, { path: modulePath });
        this.logger.debug(LogSource.BOOTSTRAP, `Added module to scan: ${moduleName} -> ${modulePath}`, {
 category: 'cli',
persistToDb: false
});
      }

      await scanAndRegister(moduleMap);
      this.logger.debug(LogSource.BOOTSTRAP, 'CLI commands registered successfully', {
 category: 'cli',
persistToDb: false
});
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, 'Failed to register CLI commands', {
 category: 'cli',
error: error as Error
});
    }
  }

  /**
   * Load and store a core module.
   * @param {ICoreModuleDefinition} definition - Module definition.
   * @returns {Promise<void>} Promise that resolves when module is loaded.
   */
  private async loadAndStoreCoreModule(definition: ICoreModuleDefinition): Promise<void> {
    const { name, type } = definition;

    this.logModuleOperation(name, 'Loading', type);

    try {
      const moduleInstance = await loadCoreModule(definition, this.modules);
      this.modules.set(name, moduleInstance);
      this.logModuleOperation(name, 'Loaded', type);
    } catch (error) {
      this.logModuleError(name, 'load', error);
      throw error;
    }
  }

  /**
   * Initialize all loaded modules.
   * Sequential initialization is required for dependency order.
   * @returns {Promise<void>} Promise that resolves when modules are initialized.
   */
  private async initializeModules(): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Initializing core modules', {
 category: 'modules',
persistToDb: false
});

    const moduleEntries = Array.from(this.modules.entries());

    await initializeModulesInOrder(moduleEntries, this.initializeSingleModule.bind(this));
  }

  /**
   * Initialize a single module.
   * @param {string} name - Module name.
   * @param {IModule} moduleInstance - Module instance.
   * @returns {Promise<void>} Promise that resolves when module is initialized.
   */
  private async initializeSingleModule(name: string, moduleInstance: IModule): Promise<void> {
    try {
      this.logModuleOperation(name, 'Initializing');
      await initializeSingleModule(name, moduleInstance, this.logger);
      this.logModuleOperation(name, 'Initialized');

      const newLogger = checkLoggerUpgrade(name, moduleInstance);
      if (newLogger !== undefined) {
        this.logger = newLogger;

        if (this.options.cliMode && name === 'logger') {
          this.configureLoggerForCliMode();
        }

        this.logger.info(LogSource.BOOTSTRAP, 'Logger upgraded', { category: 'modules' });
      }

      if (name === 'database' && this.modules.has('logger')) {
        this.injectDatabaseServiceIntoLogger(moduleInstance);
      }
    } catch (error) {
      this.logModuleError(name, 'initialize', error);
      throw error;
    }
  }

  /**
   * Start critical modules.
   * Sequential start is required for dependency order.
   * @returns {Promise<void>} Promise that resolves when critical modules are started.
   */
  private async startCriticalModules(): Promise<void> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Starting critical modules', {
 category: 'modules',
persistToDb: false
});

    const criticalModuleNames = this.coreModules
      .filter((mod): boolean => {
        return mod.critical;
      })
      .map((mod): string => {
        return mod.name;
      });

    await startModulesInOrder(criticalModuleNames, this.startModule.bind(this));
  }

  /**
   * Start a module by name.
   * @param {string} name - Module name.
   * @returns {Promise<void>} Promise that resolves when module is started.
   */
  private async startModule(name: string): Promise<void> {
    const moduleInstance = this.modules.get(name);
    if (moduleInstance === undefined) {
      return;
    }

    try {
      await startSingleModule(name, moduleInstance, this.logger);
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, `Failed to start module ${name}`, {
 category: 'modules',
error: error as Error
});
      throw error;
    }
  }

  /**
   * Configure logger for CLI mode with reduced console output.
   * @returns {void} Nothing.
   */
  private configureLoggerForCliMode(): void {
    this.logger.debug(LogSource.BOOTSTRAP, 'Logger configured for CLI mode', {
 category: 'logger',
persistToDb: false
});
  }

  /**
   * Inject database service into logger for database logging capability.
   * @param {IModule} databaseModule - Database module instance.
   * @returns {void} Nothing.
   */
  private injectDatabaseServiceIntoLogger(databaseModule: IModule): void {
    try {
      const loggerModule = this.modules.get('logger');
      if (!loggerModule) {
        this.logger.warn(LogSource.BOOTSTRAP, 'Logger module not available for database service injection', { category: 'database' });
        return;
      }

      if (!isLoggerModule(loggerModule)) {
        this.logger.warn(LogSource.BOOTSTRAP, 'Logger module does not have expected exports interface', { category: 'database' });
        return;
      }

      if (!isDatabaseModule(databaseModule)) {
        this.logger.warn(LogSource.BOOTSTRAP, 'Database module does not have expected exports interface', { category: 'database' });
        return;
      }

      const loggerService = loggerModule.exports!.service();
      const databaseService = databaseModule.exports!.service();

      if (!loggerService || typeof loggerService.setDatabaseService !== 'function') {
        this.logger.warn(LogSource.BOOTSTRAP, 'Logger service does not support database injection', { category: 'database' });
        return;
      }

      loggerService.setDatabaseService(databaseService);
      this.logger.debug(LogSource.BOOTSTRAP, 'Database service injected into logger', {
 category: 'database',
persistToDb: false
});
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, 'Failed to inject database service into logger', {
 category: 'database',
error: error as Error
});
    }
  }

  /**
   * Log module operation.
   * @param {string} name - Module name.
   * @param {string} operation - Operation name.
   * @param {string} type - Optional module type.
   * @returns {void} Nothing.
   */
  private logModuleOperation(name: string, operation: string, type?: string): void {
    const typeStr = type ?? '';
    const message
      = typeStr.length > ZERO
        ? `[BOOT DEBUG] ${operation} ${typeStr} module: ${name}`
        : `[BOOT DEBUG] ${operation} module: ${name}`;

    if (name === 'logger') {
      consoleDebug(message);
    } else {
      this.logger.debug(LogSource.BOOTSTRAP, message, {
 category: 'debug',
persistToDb: false
});
    }
  }

  /**
   * Log module error.
   * @param {string} name - Module name.
   * @param {string} operation - Operation name.
   * @param {unknown} error - Error object.
   * @returns {void} Nothing.
   */
  private logModuleError(name: string, operation: string, error: unknown): void {
    const message = `Failed to ${operation} module ${name}:`;
    if (name === 'logger') {
      consoleError(message, error);
    } else {
      this.logger.error(LogSource.BOOTSTRAP, message, {
 category: 'error',
error: error as Error
});
    }
  }
}

/**
 * Create and run bootstrap process.
 * @param {IBootstrapOptions} config - Bootstrap configuration.
 * @returns {Promise<Bootstrap>} Bootstrap instance.
 */
export const runBootstrap = async (config?: IBootstrapOptions): Promise<Bootstrap> => {
  const bootstrap = new Bootstrap(config);
  await bootstrap.bootstrap();
  return bootstrap;
};
