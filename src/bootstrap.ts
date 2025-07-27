/**
 * Bootstrap module loader for SystemPrompt OS.
 * @file Bootstrap module loader for SystemPrompt OS.
 * @module bootstrap
 */
import type { Express } from 'express';
import { CORE_MODULES } from './constants/bootstrap';
import { createConsoleLogger } from './utils/console-logger';
import {
  BootstrapPhaseEnum,
  type CoreModuleType,
  type GlobalConfiguration,
  type IBootstrapOptions,
  type ICoreModuleDefinition,
} from './types/bootstrap';
import type { ILogger } from '@/modules/core/logger/types/index';
import type { IModule } from '@/modules/core/modules/types/index';
import { shutdownAllModules } from './bootstrap/shutdown-helper';
import { BootstrapLogger } from './bootstrap/bootstrap-logger';
import { executeCoreModulesPhase } from './bootstrap/phases/core-modules-phase';
import {
  type McpServersPhaseContext,
  executeMcpServersPhase
} from './bootstrap/phases/mcp-servers-phase';
import { executeModuleDiscoveryPhase } from './bootstrap/phases/module-discovery-phase';
import {
  registerCliCommands,
  registerCoreModulesInDatabase,
  registerModulesWithLoader
} from './bootstrap/phases/module-registration-phase';

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
  private readonly logger: ILogger;
  private readonly bootstrapLogger: BootstrapLogger;
  private currentPhase: BootstrapPhaseEnum = BootstrapPhaseEnum.INIT;
  private mcpApp?: Express;

  /**
   * Creates a new Bootstrap instance.
   * @param {IBootstrapOptions} bootstrapOptions - Bootstrap configuration options.
   */
  constructor(bootstrapOptions: IBootstrapOptions = {}) {
    this.options = bootstrapOptions;
    const { logger } = bootstrapOptions;

    this.logger = logger ?? createConsoleLogger();
    this.bootstrapLogger = new BootstrapLogger(this.logger);

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
      this.bootstrapLogger.info('Starting bootstrap process', 'startup');

      await this.executeCoreModulesPhase();

      if (this.options.skipMcp !== true) {
        await this.executeMcpServersPhase();
      }

      if (this.options.skipDiscovery !== true) {
        await this.executeModuleDiscoveryPhase();
      }

      await this.executeRegistrationPhase();

      this.setCurrentPhase(BootstrapPhaseEnum.READY);
      this.bootstrapLogger.info(
        `Bootstrap completed - ${String(this.modules.size)} modules`,
        'startup'
      );

      await this.registerModulesWithLoader();

      return this.modules;
    } catch (error) {
      this.bootstrapLogger.error('Bootstrap failed', 'error', error);
      throw error;
    }
  }

  /**
   * Get the current bootstrap phase.
   * @returns {BootstrapPhaseEnum} Current phase.
   */
  getCurrentPhase(): BootstrapPhaseEnum {
    return this.currentPhase;
  }

  /**
   * Get a specific module by name.
   * @param {string} name - Module name.
   * @returns {IModule | undefined} Module instance or undefined.
   */
  getModule(name: string): IModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all loaded modules.
   * @returns {Map<string, IModule>} Map of all modules.
   */
  getModules(): Map<string, IModule> {
    return new Map(this.modules);
  }

  /**
   * Check if a specific phase has been completed.
   * @param {BootstrapPhaseEnum} phase - Phase to check.
   * @returns {boolean} True if phase is completed.
   */
  hasCompletedPhase(phase: BootstrapPhaseEnum): boolean {
    const phaseOrder = [
      BootstrapPhaseEnum.INIT,
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
    this.bootstrapLogger.info('Shutting down system', 'shutdown');

    if (this.hasCompletedPhase(BootstrapPhaseEnum.MODULE_DISCOVERY)) {
      this.bootstrapLogger.info('Shutting down autodiscovered modules', 'shutdown');
    }

    await shutdownAllModules(this.modules, this.logger);

    this.modules.clear();
    this.setCurrentPhase(BootstrapPhaseEnum.INIT);
    this.bootstrapLogger.info('All modules shut down', 'shutdown');
  }

  /**
   * Set the current bootstrap phase.
   * @param {BootstrapPhaseEnum} phase - Phase to set.
   */
  private setCurrentPhase(phase: BootstrapPhaseEnum): void {
    this.currentPhase = phase;
  }

  /**
   * Phase 1: Load and initialize core modules.
   */
  private async executeCoreModulesPhase(): Promise<void> {
    this.bootstrapLogger.phaseTransition('core modules');
    this.setCurrentPhase(BootstrapPhaseEnum.CORE_MODULES);

    await executeCoreModulesPhase({
      modules: this.modules,
      coreModules: this.coreModules,
      logger: this.logger,
      isCliMode: this.options.cliMode ?? false
    });

    this.bootstrapLogger.phaseTransition('core modules', false);
  }

  /**
   * Phase 2: Setup MCP servers for communication.
   */
  private async executeMcpServersPhase(): Promise<void> {
    this.bootstrapLogger.phaseTransition('MCP servers');
    this.setCurrentPhase(BootstrapPhaseEnum.MCP_SERVERS);

    const mcpServersContext: McpServersPhaseContext = {
      logger: this.logger
    };
    if (this.mcpApp !== undefined) {
      ({ mcpApp: mcpServersContext.mcpApp } = this);
    }
    this.mcpApp = await executeMcpServersPhase(mcpServersContext);

    this.bootstrapLogger.phaseTransition('MCP servers', false);
  }

  /**
   * Phase 3: Autodiscover and load extension modules.
   */
  private async executeModuleDiscoveryPhase(): Promise<void> {
    this.bootstrapLogger.phaseTransition('module discovery');
    this.setCurrentPhase(BootstrapPhaseEnum.MODULE_DISCOVERY);

    await executeModuleDiscoveryPhase({
      modules: this.modules,
      config: this.config,
      logger: this.logger
    });

    this.bootstrapLogger.phaseTransition('module discovery', false);
  }

  /**
   * Phase 4: Register modules and CLI commands.
   */
  private async executeRegistrationPhase(): Promise<void> {
    this.bootstrapLogger.phaseTransition('registration');

    await registerCoreModulesInDatabase({
      modules: this.modules,
      coreModules: this.coreModules,
      logger: this.logger
    });

    await registerCliCommands({
      modules: this.modules,
      coreModules: this.coreModules,
      logger: this.logger
    });

    this.bootstrapLogger.phaseTransition('registration', false);
  }

  /**
   * Registers bootstrap modules with the global ModuleLoader.
   */
  private async registerModulesWithLoader(): Promise<void> {
    await registerModulesWithLoader({
      modules: this.modules,
      coreModules: this.coreModules,
      logger: this.logger
    });
  }
}

/**
 * Factory function to create and run bootstrap.
 * @param {IBootstrapOptions} options - Bootstrap options.
 * @returns {Promise<Bootstrap>} Bootstrap instance.
 */
export const runBootstrap = async (options: IBootstrapOptions = {}): Promise<Bootstrap> => {
  const bootstrap = new Bootstrap(options);
  await bootstrap.bootstrap();
  return bootstrap;
};
