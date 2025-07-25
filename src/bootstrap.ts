/**
 * Bootstrap module loader for SystemPrompt OS.
 * @file Bootstrap module loader for SystemPrompt OS.
 * @module bootstrap
 */

import type { Express } from 'express';
import { CORE_MODULES } from './const/bootstrap.js';
import { setupMcpServers } from './server/mcp/index.js';
import { ZERO } from './const/numbers.js';
import {
 consoleDebug, consoleError, createConsoleLogger
} from './utils/console-logger.js';
import {
  BootstrapPhaseEnum,
  type GlobalConfiguration,
  type IBootstrapOptions,
  type ICoreModuleDefinition,
} from './types/bootstrap.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { IModule, ModuleInfo } from '@/modules/core/modules/types/index.js';
import type { IModuleExports } from './types/bootstrap-module.js';
import { loadCoreModule, loadExtensionModule } from './bootstrap/module-loader.js';
import { shutdownAllModules } from './bootstrap/shutdown-helper.js';
import {
  checkLoggerUpgrade,
  initializeSingleModule,
  startSingleModule,
} from './bootstrap/module-init-helper.js';
import {
  initializeModulesInOrder,
  loadCoreModulesInOrder,
  loadEnabledExtensionModules,
  startModulesInOrder,
} from './bootstrap/sequential-loader.js';
import { isModuleExports } from './bootstrap/type-guards.js';
import { loadExpressApp } from './bootstrap/express-loader.js';

/**
 * Bootstrap class manages the initialization lifecycle of SystemPrompt OS.
 * Core modules are loaded sequentially to respect dependency order.
 * MCP servers use dynamic imports for lazy loading when enabled.
 * Extension modules are discovered and loaded based on configuration.
 */
export class Bootstrap {
  private readonly config: GlobalConfiguration;
  private readonly modules: Map<string, IModule> = new Map();
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
      configPath: configPath ?? process.env['CONFIG_PATH'] ?? './config',
      statePath: statePath ?? process.env['STATE_PATH'] ?? './state',
      environment: environment ?? process.env['NODE_ENV'] ?? 'development',
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
      this.logger.info('🚀 Starting world-class bootstrap process...');

      await this.executeCoreModulesPhase();

      if (this.options.skipMcp !== true) {
        await this.executeMcpServersPhase();
      }

      if (this.options.skipDiscovery !== true) {
        await this.executeModuleDiscoveryPhase();
      }

      // Register CLI commands from all loaded modules
      await this.registerCliCommands();

      const { READY } = BootstrapPhaseEnum;
      this.currentPhase = READY;
      this.logger.info('✅ Bootstrap process completed successfully');
      this.logger.info(`📊 Loaded ${String(this.modules.size)} core modules`);

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
    this.logger.info('🛑 Shutting down system...');

    if (this.hasCompletedPhase(BootstrapPhaseEnum.MODULE_DISCOVERY)) {
      this.logger.info('Shutting down autodiscovered modules...');
    }

    await shutdownAllModules(this.modules, this.logger);

    this.modules.clear();
    const { CORE_MODULES: coreModulesPhase } = BootstrapPhaseEnum;
    this.currentPhase = coreModulesPhase;
    this.logger.info('✓ All modules shut down');
  }

  /**
   * Phase 1: Load and initialize core modules.
   * Core modules must be loaded sequentially due to dependencies.
   * @returns {Promise<void>} Promise that resolves when phase is complete.
   */
  private async executeCoreModulesPhase(): Promise<void> {
    this.logger.info('📦 Phase 1: Loading core modules...');
    const { CORE_MODULES: coreModulesPhase } = BootstrapPhaseEnum;
    this.currentPhase = coreModulesPhase;

    const definitions = [...this.coreModules];

    await loadCoreModulesInOrder(definitions, this.loadAndStoreCoreModule.bind(this));

    await this.initializeModules();
    await this.startCriticalModules();

    // Register core modules in database after they're loaded
    await this.registerCoreModulesInDatabase();

    const moduleNames = Array.from(this.modules.keys()).join(', ');
    this.logger.info(`✓ Core modules loaded: ${moduleNames}`);
  }

  /**
   * Phase 2: Setup MCP servers for communication.
   * Uses dynamic import for lazy loading when MCP is enabled.
   * @returns {Promise<void>} Promise that resolves when phase is complete.
   */
  private async executeMcpServersPhase(): Promise<void> {
    this.logger.info('🔌 Phase 2: Setting up MCP servers...');
    const { MCP_SERVERS } = BootstrapPhaseEnum;
    this.currentPhase = MCP_SERVERS;

    try {
      this.mcpApp ??= await loadExpressApp();

      await setupMcpServers(this.mcpApp);
      this.logger.info('✓ MCP servers initialized');
    } catch (error) {
      this.logger.error('Failed to setup MCP servers:', error);
      throw error;
    }
  }

  /**
   * Phase 3: Autodiscover and load extension modules.
   * @returns {Promise<void>} Promise that resolves when phase is complete.
   */
  private async executeModuleDiscoveryPhase(): Promise<void> {
    this.logger.info('🔍 Phase 3: Autodiscovering modules...');
    const { MODULE_DISCOVERY } = BootstrapPhaseEnum;
    this.currentPhase = MODULE_DISCOVERY;

    try {
      const modulesModule = this.modules.get('modules');
      if (modulesModule === undefined || modulesModule.exports === undefined) {
        this.logger.warn('Modules module not found or has no exports');
        return;
      }

      const { exports: moduleExports } = modulesModule;
      if (!isModuleExports(moduleExports)) {
        throw new Error(
          'Invalid modules exports: missing required methods scanForModules or getEnabledModules',
        );
      }
      await this.discoverAndLoadModules(moduleExports);

      this.logger.info('✓ Module autodiscovery completed');
    } catch (error) {
      this.logger.error('Module autodiscovery failed:', error);
    }
  }

  /**
   * Discover and load extension modules.
   * @param {IModuleExports} moduleExports - Module exports.
   * @returns {Promise<void>} Promise that resolves when discovery is complete.
   */
  private async discoverAndLoadModules(moduleExports: IModuleExports): Promise<void> {
    this.logger.info('Scanning for injectable modules...');
    const discoveredModules = await moduleExports.scanForModules();
    this.logger.info(`Discovered ${String(discoveredModules.length)} injectable modules`);

    if (discoveredModules.length === ZERO) {
      this.logger.warn('No modules discovered');
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
      this.logger.info(`✓ Loaded extension module: ${moduleInfo.name}`);
    } catch (error) {
      this.logger.error(`Failed to load extension module ${moduleInfo.name}:`, error);
    }
  }

  /**
   * Register core modules in the database.
   * @returns {Promise<void>} Promise that resolves when registration is complete.
   */
  private async registerCoreModulesInDatabase(): Promise<void> {
    this.logger.info('Registering core modules in database...');

    const modulesModule = this.modules.get('modules');
    if (!modulesModule) {
      this.logger.warn('Modules module not loaded, skipping core module registration');
      return;
    }

    const registerCoreModule = modulesModule.exports?.['registerCoreModule'];
    if (!registerCoreModule || typeof registerCoreModule !== 'function') {
      this.logger.warn('registerCoreModule not available, skipping core module registration');
      return;
    }

    try {
      // Register each core module in the database
      for (const definition of this.coreModules) {
        await registerCoreModule(definition.name, definition.path, definition.dependencies);
      }
      this.logger.info('✓ Core modules registered in database');
    } catch (error) {
      this.logger.error('Failed to register core modules:', error);
    }
  }

  /**
   * Register CLI commands from all loaded modules.
   * @returns {Promise<void>} Promise that resolves when registration is complete.
   */
  private async registerCliCommands(): Promise<void> {
    this.logger.info('Registering CLI commands...');

    const cliModule = this.modules.get('cli');
    if (!cliModule) {
      this.logger.warn('CLI module not loaded, skipping command registration');
      return;
    }

    // Get the CLI service from the module
    const cliService = (cliModule.exports as any)?.service?.();
    if (!cliService || !cliService.scanAndRegisterAllCommands) {
      this.logger.warn('CLI service not available, skipping command registration');
      return;
    }

    try {
      await cliService.scanAndRegisterAllCommands();
      this.logger.info('✓ CLI commands registered successfully');
    } catch (error) {
      this.logger.error('Failed to register CLI commands:', error);
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
    this.logger.info('Initializing core modules...');

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
        this.logger.info('🔄 Bootstrap logger upgraded to full logger');
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
    this.logger.info('Starting critical modules...');

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
      this.logger.error(`Failed to start module ${name}:`, error);
      throw error;
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
      this.logger.debug(message);
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
      this.logger.error(message, error);
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
