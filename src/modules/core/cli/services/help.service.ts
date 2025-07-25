/**
 * @file Help service for CLI commands.
 * @module modules/core/cli/services/help
 * Provides help information and formatting for CLI commands.
 */

import type { ICliService } from '@/modules/core/cli/types/index.js';

/**
 * Service for providing help information for CLI commands.
 */
export class HelpService {
  private static instance: HelpService;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {}

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
    console.log(help);
  }

  /**
   * Shows all commands with full details.
   * @param cliService - The CLI service.
   */
  public async showAllCommands(cliService: ICliService): Promise<void> {
    console.log('\nSystemPrompt OS - All Available Commands');
    console.log('========================================\n');

    const commands = await cliService.getAllCommands();
    const commandsArray = Array.from(commands.entries());
    const sortedCommands = commandsArray.sort((first, second): number => { 
      return first[0].localeCompare(second[0]);
    });

    sortedCommands.forEach(([name]): void => {
      console.log(cliService.getCommandHelp(name, commands));
      console.log('-'.repeat(40));
    });
  }

  /**
   * Shows general help.
   * @param cliService - The CLI service.
   */
  public async showGeneralHelp(cliService: ICliService): Promise<void> {
    console.log('\nSystemPrompt OS CLI');
    console.log('==================\n');
    console.log('Usage: systemprompt <command> [options]\n');
    console.log('Commands:');

    const commands = await cliService.getAllCommands();
    console.log(cliService.formatCommands(commands, 'text'));

    console.log('\nFor detailed help on a specific command:');
    console.log('  systemprompt cli:help --command <command-name>');
    console.log('\nFor all commands with details:');
    console.log('  systemprompt cli:help --all');
  }
}
