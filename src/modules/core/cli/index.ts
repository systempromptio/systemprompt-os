/**
 * @file CLI module - CLI utilities and help system.
 * @module modules/core/cli
 */

import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { CLIService } from '@/modules/core/cli/services/cli.service.js';
import type { CLICommand, CLIModuleExports } from '@/modules/core/cli/types/index.js';
import { CLIInitializationError } from '@/modules/core/cli/utils/errors.js';

// Export types for external use
export type * from '@/modules/core/cli/types/index.js';

/**
 * CLI module for managing command-line interface utilities and help system - self-contained.
 */
export class CLIModule implements IModule {
  name = 'cli';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;
  dependencies = ['logger', 'database'];
  private cliService?: CLIService;
  private readonly logger = LoggerService.getInstance();
  get exports(): CLIModuleExports {
    return {
      service: () => { return this.cliService },
      getAllCommands: async () => { return await this.getAllCommands() },
      getCommandHelp: (commandName: string, commands: Map<string, CLICommand>) => { return this.getCommandHelp(commandName, commands) },
      formatCommands: (commands: Map<string, CLICommand>, format: string) => { return this.formatCommands(commands, format) },
      generateDocs: (commands: Map<string, CLICommand>, format: string) => { return this.generateDocs(commands, format) },
    };
  }

  /**
   * Initialize the CLI module.
   * @throws {CLIInitializationError} If initialization fails.
   */
  async initialize(): Promise<void> {
    try {
      this.cliService = CLIService.getInstance();
      const database = DatabaseService.getInstance();
      await this.cliService.initialize(this.logger, database);
      this.logger.info('CLI module initialized');
    } catch (error) {
      throw new CLIInitializationError(error as Error);
    }
  }

  /**
   * Start the CLI module.
   */
  async start(): Promise<void> {
    this.status = ModuleStatus.RUNNING;
    this.logger.info('CLI module started');
  }

  /**
   * Stop the CLI module.
   */
  async stop(): Promise<void> {
    this.status = ModuleStatus.STOPPED;
    this.logger.info('CLI module stopped');
  }

  /**
   * Check the health of the CLI module.
   * @returns Health check result.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = this.status === ModuleStatus.RUNNING && this.cliService?.isInitialized();
    return {
      healthy: Boolean(isHealthy),
      message: isHealthy
        ? 'CLI module is healthy'
        : 'CLI module is not running or not initialized',
    };
  }

  /**
   * Get all available commands.
   * @returns Map of command names to command metadata.
   */
  async getAllCommands(): Promise<Map<string, CLICommand>> {
    if (!this.cliService) {
      throw new Error('CLI service not initialized');
    }
    return await this.cliService.getAllCommands();
  }

  /**
   * Get help text for a specific command.
   * @param commandName - Name of the command to get help for.
   * @param commands - Map of all available commands.
   * @returns Formatted help text.
   */
  getCommandHelp(
    commandName: string,
    commands: Map<string, CLICommand>,
  ): string {
    if (!this.cliService) {
      throw new Error('CLI service not initialized');
    }
    return this.cliService.getCommandHelp(commandName, commands);
  }

  /**
   * Format commands list for display.
   * @param commands - Map of commands to format.
   * @param format - Output format (text, json, markdown, etc.).
   * @returns Formatted commands list.
   */
  formatCommands(
    commands: Map<string, CLICommand>,
    format: string,
  ): string {
    if (!this.cliService) {
      throw new Error('CLI service not initialized');
    }
    return this.cliService.formatCommands(commands, format);
  }

  /**
   * Generate documentation for all commands.
   * @param commands - Map of commands to document.
   * @param format - Documentation format (markdown, html, etc.).
   * @returns Generated documentation.
   */
  generateDocs(
    commands: Map<string, CLICommand>,
    format: string,
  ): string {
    if (!this.cliService) {
      throw new Error('CLI service not initialized');
    }
    return this.cliService.generateDocs(commands, format);
  }
}

/**
 * Factory function for creating the module.
 */
export function createModule(): CLIModule {
  return new CLIModule();
}

// Re-export CLIService for convenience
export { CLIService };
