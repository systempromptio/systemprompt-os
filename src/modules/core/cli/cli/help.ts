/**
 * @file Help command.
 * @module modules/core/cli/cli/help
 */

import { getModuleLoader } from '@/modules/loader.js';
import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index.js';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors.js';

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
      const moduleLoader = getModuleLoader();
      const cliModule = moduleLoader.getModule('cli');
      if (!cliModule || !cliModule.exports) {
        throw new Error('CLI module not loaded');
      }

      const cliService = cliModule.exports['service']?.();
      if (!cliService) {
        throw new Error('CLI service not available');
      }

      // Get all available commands
      const commands = await cliService.getAllCommands();

      if (args['command']) {
        // Show help for specific command
        const help = cliService.getCommandHelp(args['command'] as string, commands);
        console.log(help);
      } else if (args['all']) {
        // Show all commands with full details
        console.log('\nSystemPrompt OS - All Available Commands');
        console.log('========================================\n');

        // Sort commands alphabetically
        const commandsArray = Array.from(commands.entries()) as Array<[string, any]>;
        const sortedCommands = commandsArray.sort((a, b) => a[0].localeCompare(b[0]));

        sortedCommands.forEach(([name, _command]) => {
          console.log(cliService.getCommandHelp(name, commands));
          console.log('-'.repeat(40));
        });
      } else {
        // Show general help
        console.log('\nSystemPrompt OS CLI');
        console.log('==================\n');
        console.log('Usage: systemprompt <command> [options]\n');
        console.log('Commands:');
        console.log(cliModule.formatCommands(commands, 'text'));
        console.log('\nFor detailed help on a specific command:');
        console.log('  systemprompt cli:help --command <command-name>');
        console.log('\nFor all commands with details:');
        console.log('  systemprompt cli:help --all');
      }
    } catch (error) {
      throw new CommandExecutionError('cli:help', error as Error);
    }
  },
};
