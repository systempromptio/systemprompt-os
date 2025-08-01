/**
 * @file Help service for CLI commands.
 * @module modules/core/cli/services/help
 * Provides help information and formatting for CLI commands.
 */

import type { ICliService } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

/**
 * Service for providing help information for CLI commands.
 */
export class HelpService {
  private static instance: HelpService;
  private readonly cliOutput: CliOutputService;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    this.cliOutput = CliOutputService.getInstance();
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
    this.cliOutput.output(help);
  }

  /**
   * Shows all commands with full details.
   * @param cliService - The CLI service.
   */
  public async showAllCommands(cliService: ICliService): Promise<void> {
    this.cliOutput.section('SystemPrompt OS - All Available Commands');

    const commands = await cliService.getAllCommands();
    const commandsArray = Array.from(commands.entries());
    const sortedCommands = commandsArray.sort((first, second): number => { 
      return first[0].localeCompare(second[0]);
    });

    sortedCommands.forEach(([name]): void => {
      this.cliOutput.output(cliService.getCommandHelp(name, commands));
      this.cliOutput.output('-'.repeat(40));
    });
  }

  /**
   * Shows general help.
   * @param cliService - The CLI service.
   */
  public async showGeneralHelp(cliService: ICliService): Promise<void> {
    this.cliOutput.section('SystemPrompt OS CLI');
    this.cliOutput.output('Usage: systemprompt <command> [options]\n');
    this.cliOutput.output('Commands:');

    const commands = await cliService.getAllCommands();
    this.cliOutput.output(cliService.formatCommands(commands, 'text'));

    this.cliOutput.output('\nFor detailed help on a specific command:');
    this.cliOutput.output('  systemprompt cli:help --command <command-name>');
    this.cliOutput.output('\nFor all commands with details:');
    this.cliOutput.output('  systemprompt cli:help --all');
  }
}
