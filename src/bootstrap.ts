/**
 * Bootstrap module loader for SystemPrompt OS.
 * @file Bootstrap module loader for SystemPrompt OS.
 * @module bootstrap
 */
import type { Express } from 'express';
import { CORE_MODULES } from './constants/bootstrap';
import {
  BootstrapPhaseEnum,
  type CoreModuleType,
  type GlobalConfiguration,
  type IBootstrapOptions,
  type ICoreModuleDefinition,
  type McpServersPhaseContext,
} from './types/bootstrap';
import type { IModule } from '@/modules/core/modules/types/index';
import { shutdownAllModules } from './bootstrap/shutdown-helper';
import { executeCoreModulesPhase } from './bootstrap/phases/core-modules-phase';
import { executeMcpServersPhase } from './bootstrap/phases/mcp-servers-phase';
import { executeModuleDiscoveryPhase } from './bootstrap/phases/module-discovery-phase';
import {
  registerCliCommands,
  registerCoreModulesInDatabase
} from './bootstrap/phases/module-registration-phase';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { createLoggerModuleForBootstrap } from '@/modules/core/logger';

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
  private currentPhase: BootstrapPhaseEnum = BootstrapPhaseEnum.INIT;
  private mcpApp?: Express;

  /**
   * Creates a new Bootstrap instance.
   * @param {IBootstrapOptions} bootstrapOptions - Bootstrap configuration options.
   */
  constructor(bootstrapOptions: IBootstrapOptions = {}) {
    this.options = bootstrapOptions;
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
      await this.loadLoggerModule();
      await this.executeAllPhases();
      return this.modules;
    } catch (error) {
      const logger = LoggerService.getInstance();
      logger.error(LogSource.BOOTSTRAP, 'Bootstrap failed', {
        error: error instanceof Error ? error.message : String(error),
        category: 'startup'
      });
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
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Shutting down system', { category: 'shutdown' });

    if (this.hasCompletedPhase(BootstrapPhaseEnum.MODULE_DISCOVERY)) {
      const moduleDiscoveryLogger = LoggerService.getInstance();
      moduleDiscoveryLogger.info(
        LogSource.BOOTSTRAP,
        'Shutting down autodiscovered modules',
        { category: 'shutdown' }
      );
    }

    await shutdownAllModules(this.modules, logger);

    this.modules.clear();
    this.setCurrentPhase(BootstrapPhaseEnum.INIT);
    logger.info(LogSource.BOOTSTRAP, 'All modules shut down', { category: 'shutdown' });
  }

  /**
   * Execute all bootstrap phases in sequence.
   */
  private async executeAllPhases(): Promise<void> {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Starting bootstrap process', { category: 'startup' });

    await this.executeCoreModulesPhase();

    if (this.options.skipMcp !== true) {
      await this.executeMcpServersPhase();
    }

    if (this.options.skipDiscovery !== true) {
      await this.executeModuleDiscoveryPhase();
    }

    await this.executeRegistrationPhase();

    this.setCurrentPhase(BootstrapPhaseEnum.READY);
    logger.info(
      LogSource.BOOTSTRAP,
      `Bootstrap completed - ${this.modules.size.toString()} modules`,
      { category: 'startup' }
    );

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
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Starting core modules phase', { category: 'phase' });
    this.setCurrentPhase(BootstrapPhaseEnum.CORE_MODULES);

    await executeCoreModulesPhase({
      modules: this.modules,
      coreModules: this.coreModules,
      isCliMode: this.options.cliMode ?? false
    });

    logger.info(LogSource.BOOTSTRAP, 'Core modules phase completed', { category: 'phase' });
  }

  /**
   * Phase 2: Setup MCP servers for communication.
   */
  private async executeMcpServersPhase(): Promise<void> {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Starting MCP servers phase', { category: 'phase' });
    this.setCurrentPhase(BootstrapPhaseEnum.MCP_SERVERS);

    const mcpServersContext: McpServersPhaseContext = {};
    if (this.mcpApp !== undefined) {
      const { mcpApp } = { mcpApp: this.mcpApp };
      mcpServersContext.mcpApp = mcpApp;
    }
    this.mcpApp = await executeMcpServersPhase(mcpServersContext);

    logger.info(LogSource.BOOTSTRAP, 'MCP servers phase completed', { category: 'phase' });
  }

  /**
   * Phase 3: Autodiscover and load extension modules.
   */
  private async executeModuleDiscoveryPhase(): Promise<void> {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Starting module discovery phase', { category: 'phase' });
    this.setCurrentPhase(BootstrapPhaseEnum.MODULE_DISCOVERY);

    await executeModuleDiscoveryPhase({
      modules: this.modules,
      config: this.config
    });

    logger.info(LogSource.BOOTSTRAP, 'Module discovery phase completed', { category: 'phase' });
  }

  /**
   * Phase 4: Register modules and CLI commands.
   */
  private async executeRegistrationPhase(): Promise<void> {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.BOOTSTRAP, 'Starting registration phase', { category: 'phase' });

    await registerCoreModulesInDatabase({
      modules: this.modules,
      coreModules: this.coreModules
    });

    await registerCliCommands({
      modules: this.modules,
      coreModules: this.coreModules
    });

    logger.info(LogSource.BOOTSTRAP, 'Registration phase completed', { category: 'phase' });
  }

  /**
   * Load and initialize the logger module first.
   * This must be done before any other module loading.
   * Uses direct instantiation during bootstrap to avoid circular dependencies.
   */
  private async loadLoggerModule(): Promise<void> {
    const loggerModule = await createLoggerModuleForBootstrap();
    this.modules.set('logger', loggerModule);
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
