/**
 * @file CLI module - CLI utilities and help system.
 * @module modules/core/cli
 * Provides command-line interface utilities, help system, and command management functionality.
 */

import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { CliService } from '@/modules/core/cli/services/cli.service';
import type { CLICommand } from '@/modules/core/cli/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

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
  ) => Promise<unknown>;
}

/**
 * Initialize function for CLI module (required by core module pattern).
 * @returns A promise that resolves when initialized.
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
  type = 'service' as const;
  status: ModuleStatus = 'stopped' as ModuleStatus;
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
    this.cliService = CliService.getInstance();
    this.cliService.initialize(this.logger, database);
    this.status = 'starting' as ModuleStatus;
    this.logger.info(LogSource.CLI, 'CLI module initialized');
  }

  /**
   * Start the CLI module.
   */
  start(): void {
    this.status = 'running' as ModuleStatus;
    this.logger.info(LogSource.CLI, 'CLI module started');
  }

  /**
   * Stop the CLI module.
   */
  stop(): void {
    this.status = 'stopped' as ModuleStatus;
    this.logger.info(LogSource.CLI, 'CLI module stopped');
  }

  /**
   * Check the health of the CLI module.
   * @returns Health check result.
   */
  healthCheck(): { healthy: boolean; message?: string } {
    const isHealthy =
      this.status === ('running' as ModuleStatus) && this.cliService?.isInitialized();
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
      throw new Error('CLI service not initialized');
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

export { CliService };
export { CliService as CLIService };

export const service = (): CliService | undefined => {
  return CliService.getInstance();
};

export const getAllCommands = async (): Promise<Map<string, CLICommand>> => {
  const cliModule = new CLIModule();
  return await cliModule.getAllCommands();
};

export const getCommandHelp = (commandName: string, commands: Map<string, CLICommand>): string => {
  const cliModule = new CLIModule();
  return cliModule.getCommandHelp(commandName, commands);
};

export const formatCommands = (commands: Map<string, CLICommand>, format: string): string => {
  const cliModule = new CLIModule();
  return cliModule.formatCommands(commands, format);
};

export const generateDocs = (commands: Map<string, CLICommand>, format: string): string => {
  const cliModule = new CLIModule();
  return cliModule.generateDocs(commands, format);
};
