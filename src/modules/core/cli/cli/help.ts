/**
 * @file Help command.
 * @module modules/core/cli/cli/help
 * Provides help information for CLI commands.
 */

import { getModuleLoader } from '@/modules/loader.js';
import type {
  CLICommand,
  CLIContext,
  ICliModule,
  ICliService
} from '@/modules/core/cli/types/index.js';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors.js';

/**
 * Gets the CLI service from the module loader.
 * @returns The CLI service.
 * @throws {Error} If the CLI module or service is not available.
 */
const getCliService = (): ICliService => {
  const moduleLoader = getModuleLoader();
  const cliModule = moduleLoader.getModule('cli') as unknown;

  if (cliModule === null || cliModule === undefined
      || typeof cliModule !== 'object'
      || !('exports' in cliModule) || (cliModule as ICliModule).exports === null
      || (cliModule as ICliModule).exports === undefined) {
    throw new Error('CLI module not loaded');
  }

  const typedModule = cliModule as ICliModule;
  const cliService = typedModule.exports.service?.();
  if (cliService === null || cliService === undefined) {
    throw new Error('CLI service not available');
  }

  return cliService;
};

/**
 * Shows help for a specific command.
 * @param commandName - The name of the command.
 * @param cliService - The CLI service.
 */
const showSpecificCommandHelp = async (
  commandName: string,
  cliService: ICliService
): Promise<void> => {
  const commands = await cliService.getAllCommands();
  const help = cliService.getCommandHelp(commandName, commands);
  console.log(help);
};

/**
 * Shows all commands with full details.
 * @param cliService - The CLI service.
 */
const showAllCommands = async (cliService: ICliService): Promise<void> => {
  console.log('\nSystemPrompt OS - All Available Commands');
  console.log('========================================\n');

  const commands = await cliService.getAllCommands();
  const commandsArray = Array.from(commands.entries());
  const sortedCommands = commandsArray.sort((first, second): number => { return first[0].localeCompare(second[0]) });

  sortedCommands.forEach(([name]): void => {
    console.log(cliService.getCommandHelp(name, commands));
    console.log('-'.repeat(40));
  });
};

/**
 * Shows general help.
 * @param cliModule - The CLI module.
 * @param cliService - The CLI service.
 */
const showGeneralHelp = async (
  cliModule: ICliModule,
  cliService: ICliService
): Promise<void> => {
  console.log('\nSystemPrompt OS CLI');
  console.log('==================\n');
  console.log('Usage: systemprompt <command> [options]\n');
  console.log('Commands:');

  const commands = await cliService.getAllCommands();
  console.log(cliModule.formatCommands(commands, 'text'));

  console.log('\nFor detailed help on a specific command:');
  console.log('  systemprompt cli:help --command <command-name>');
  console.log('\nFor all commands with details:');
  console.log('  systemprompt cli:help --all');
};

export const command: CLICommand = {
  description: 'Show help information for commands',
  options: [
    {
      name: 'command',
      type: 'string',
      description: 'Specific command to get help for',
    },
    {
      name: 'all',
      alias: 'a',
      type: 'boolean',
      description: 'Show all available commands with details',
      default: false,
    },
  ],
  examples: [
    'systemprompt cli:help',
    'systemprompt cli:help --command database:migrate',
    'systemprompt cli:help --all',
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;

    try {
      const cliService = getCliService();
      const moduleLoader = getModuleLoader();
      const cliModule = moduleLoader.getModule('cli') as unknown as ICliModule;

      if ((args as any)?.command !== undefined && (args as any)?.command !== null) {
        await showSpecificCommandHelp((args as any).command as string, cliService);
      } else if ((args as any)?.all === true) {
        await showAllCommands(cliService);
      } else {
        await showGeneralHelp(cliModule, cliService);
      }
    } catch (error) {
      throw new CommandExecutionError('cli:help', error as Error);
    }
  },
};
