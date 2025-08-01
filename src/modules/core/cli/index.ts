/**
 * @file CLI module - CLI utilities and help system.
 * @module modules/core/cli
 * Provides command-line interface utilities, help system, and command management functionality.
 */

import { type IModule, ModulesStatus, ModulesType } from '@/modules/core/modules/types/manual';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { CliService } from '@/modules/core/cli/services/cli.service';
import type { CLICommand } from '@/modules/core/cli/types/manual';
import { type ILogger, LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { getModuleRegistry } from '@/modules/core/modules/index';
import { ModuleName } from '@/modules/types/module-names.types';

/**
 * Strongly typed exports interface for CLI module.
 */
export interface ICLIModuleExports {
  readonly service: () => CliService;
  readonly getAllCommands: () => Promise<Map<string, CLICommand>>;
  readonly getCommandHelp: (commandName: string, commands: Map<string, CLICommand>) => string;
  readonly formatCommands: (commands: Map<string, CLICommand>, format: string) => string;
  readonly generateDocs: (commands: Map<string, CLICommand>, format: string) => string;
  readonly scanAndRegisterModuleCommands: (
    modules: Map<string, { path: string }>,
  ) => Promise<void>;
}

/**
 * Initialize function for CLI module (required by core module pattern).
 */
export async function initialize(): Promise<void> {
  const cliModule = new CLIModule();
  await cliModule.initialize();
}

/**
 * CLI module for managing command-line interface utilities and help system - self-contained.
 */
export class CLIModule implements IModule<ICLIModuleExports> {
  name = 'cli';
  version = '1.0.0';
  type = ModulesType.CORE;
  status: ModulesStatus = ModulesStatus.PENDING;
  dependencies = ['logger', 'database'];
  private cliService?: CliService;
  private logger!: ILogger;
  get exports(): ICLIModuleExports {
    return {
      service: (): CliService => this.getService(),
      getAllCommands: async (): Promise<Map<string, CLICommand>> => await this.getAllCommands(),
      getCommandHelp: (commandName: string, commands: Map<string, CLICommand>): string =>
        this.getCommandHelp(commandName, commands),
      formatCommands: (commands: Map<string, CLICommand>, format: string): string =>
        this.formatCommands(commands, format),
      generateDocs: (commands: Map<string, CLICommand>, format: string): string =>
        this.generateDocs(commands, format),
      scanAndRegisterModuleCommands: async (modules: Map<string, { path: string }>): Promise<void> => {
        const service = this.getService();
        await service.scanAndRegisterModuleCommands(modules);
      },
    };
  }

  /**
   * Initialize the CLI module.
   */
  async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();
    const database = DatabaseService.getInstance();
    this.cliService ||= CliService.getInstance();
    this.cliService.initialize(this.logger, database);
    this.status = ModulesStatus.INITIALIZING;
    this.logger.info(LogSource.CLI, 'CLI module initialized');
  }

  /**
   * Start the CLI module.
   */
  async start(): Promise<void> {
    this.status = ModulesStatus.RUNNING;
    this.logger.info(LogSource.CLI, 'CLI module started');
  }

  /**
   * Stop the CLI module.
   */
  async stop(): Promise<void> {
    this.status = ModulesStatus.STOPPED;
    this.logger.info(LogSource.CLI, 'CLI module stopped');
  }

  /**
   * Check the health of the CLI module.
   * @returns Health check result.
   */
  healthCheck(): { healthy: boolean; message?: string } {
    const isHealthy =
      this.status === ModulesStatus.RUNNING && this.cliService?.isInitialized();
    return {
      healthy: Boolean(isHealthy),
      message: isHealthy ? 'CLI module is healthy' : 'CLI module is not running or not initialized',
    };
  }

  /**
   * Get all available commands.
   * @returns Map of command names to command metadata.
   * @throws {Error} If CLI service is not initialized.
   */
  async getAllCommands(): Promise<Map<string, CLICommand>> {
    if (this.cliService === undefined || this.cliService === null) {
      throw new Error('CLI service not initialized');
    }
    return await this.cliService.getAllCommands();
  }

  /**
   * Get the CLI service instance.
   * @returns The CLI service.
   * @throws {Error} If CLI service is not initialized.
   */
  getService(): CliService {
    if (this.cliService === undefined || this.cliService === null) {
      /**
       * Lazy initialization for CLI bootstrap scenario.
       */
      try {
        this.logger = LoggerService.getInstance();
        const database = DatabaseService.getInstance();
        this.cliService = CliService.getInstance();
        this.cliService.initialize(this.logger, database);
      } catch {
        throw new Error('CLI service not initialized - required services not available');
      }
    }
    return this.cliService;
  }

  /**
   * Get help text for a specific command.
   * @param commandName - Name of the command to get help for.
   * @param commands - Map of all available commands.
   * @returns Formatted help text.
   * @throws {Error} If CLI service is not initialized.
   */
  getCommandHelp(commandName: string, commands: Map<string, CLICommand>): string {
    if (this.cliService === undefined || this.cliService === null) {
      throw new Error('CLI service not initialized');
    }
    return this.cliService.getCommandHelp(commandName, commands);
  }

  /**
   * Format commands list for display.
   * @param commands - Map of commands to format.
   * @param format - Output format (text, json, markdown, etc.).
   * @returns Formatted commands list.
   * @throws {Error} If CLI service is not initialized.
   */
  formatCommands(commands: Map<string, CLICommand>, format: string): string {
    if (this.cliService === undefined || this.cliService === null) {
      throw new Error('CLI service not initialized');
    }
    return this.cliService.formatCommands(commands, format);
  }

  /**
   * Generate documentation for all commands.
   * @param commands - Map of commands to document.
   * @param format - Documentation format (markdown, html, etc.).
   * @returns Generated documentation.
   * @throws {Error} If CLI service is not initialized.
   */
  generateDocs(commands: Map<string, CLICommand>, format: string): string {
    if (this.cliService === undefined || this.cliService === null) {
      throw new Error('CLI service not initialized');
    }
    return this.cliService.generateDocs(commands, format);
  }
}

/**
 * Factory function for creating the module.
 * @returns A new instance of CLIModule.
 */
export function createModule(): CLIModule {
  return new CLIModule();
}

/**
 * Gets the CLI module with type safety and validation.
 * @returns The CLI module with guaranteed typed exports.
 * @throws {Error} If CLI module is not available.
 */
export function getCLIModule(): IModule<ICLIModuleExports> {
  /**
   * Dynamic imports required for circular dependency resolution.
   */
  const registry = getModuleRegistry();
  const cliModule = registry.get(ModuleName.CLI);
  
  /**
   * Get the actual CLI module instance.
   */
  const cliModuleInstance = cliModule as unknown as CLIModule;
  
  /**
   * Return the CLI module instance directly with proper typing.
   */
  const wrappedModule: IModule<ICLIModuleExports> = {
    name: 'cli',
    version: '1.0.0',
    type: ModulesType.CORE,
    status: cliModuleInstance.status,
    exports: cliModuleInstance.exports,
    initialize: async (): Promise<void> => {
      await cliModuleInstance.initialize();
    }
  };
  
  return wrappedModule;
}
