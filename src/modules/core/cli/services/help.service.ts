/**
 * @file Help service for CLI commands.
 * @module modules/core/cli/services/help
 * Provides help information and formatting for CLI commands.
 */

import type { ICliService } from '@/modules/core/cli/types/index';

/**
 * Service for providing help information for CLI commands.
 */
export class HelpService {
  private static instance: HelpService;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    /**
     * Intentionally empty for singleton pattern.
     */
  }

  /**
   * Get the singleton instance of HelpService.
   * @returns The HelpService instance.
   */
  public static getInstance(): HelpService {
    HelpService.instance ||= new HelpService();
    return HelpService.instance;
  }

  /**
   * Shows help for a specific command.
   * @param commandName - The name of the command.
   * @param cliService - The CLI service.
   */
  public async showSpecificCommandHelp(
    commandName: string,
    cliService: ICliService
  ): Promise<void> {
    const commands = await cliService.getAllCommands();
    const help = cliService.getCommandHelp(commandName, commands);
    this.writeToConsole(help);
  }

  /**
   * Shows all commands with full details.
   * @param cliService - The CLI service.
   */
  public async showAllCommands(cliService: ICliService): Promise<void> {
    this.writeToConsole('\nSystemPrompt OS - All Available Commands');
    this.writeToConsole('========================================\n');

    const commands = await cliService.getAllCommands();
    const commandsArray = Array.from(commands.entries());
    const sortedCommands = commandsArray.sort((first, second): number => { 
      return first[0].localeCompare(second[0]);
    });

    sortedCommands.forEach(([name]): void => {
      this.writeToConsole(cliService.getCommandHelp(name, commands));
      this.writeToConsole('-'.repeat(40));
    });
  }

  /**
   * Shows general help.
   * @param cliService - The CLI service.
   */
  public async showGeneralHelp(cliService: ICliService): Promise<void> {
    this.writeToConsole('\nSystemPrompt OS CLI');
    this.writeToConsole('==================\n');
    this.writeToConsole('Usage: systemprompt <command> [options]\n');
    this.writeToConsole('Commands:');

    const commands = await cliService.getAllCommands();
    this.writeToConsole(cliService.formatCommands(commands, 'text'));

    this.writeToConsole('\nFor detailed help on a specific command:');
    this.writeToConsole('  systemprompt cli:help --command <command-name>');
    this.writeToConsole('\nFor all commands with details:');
    this.writeToConsole('  systemprompt cli:help --all');
  }

  /**
   * Write text to console output.
   * Centralized method to handle console output for help text.
   * @param text - Text to output to console.
   */
  private writeToConsole(text: string): void {
    process.stdout.write(`${text}\n`);
  }
}
