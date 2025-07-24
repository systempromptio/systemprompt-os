/**
 * @file List all available CLI commands.
 * @module modules/core/cli/cli/list
 * Lists all available CLI commands with filtering and formatting options.
 */

import { getModuleLoader } from '@/modules/loader.js';
import type {
  CLICommand,
  CLIContext,
  ICliModule
} from '@/modules/core/cli/types/index.js';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors.js';

export const command: CLICommand = {
  description: 'List all available commands',
  options: [
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Filter commands by module',
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (text, json, table)',
      default: 'text',
      choices: ['text', 'json', 'table'],
    },
  ],
  examples: [
    'systemprompt cli:list',
    'systemprompt cli:list --format json',
    'systemprompt cli:list --module auth',
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    const format = (args.format ?? 'text') as string;
    const filterModule = args.module as string | undefined;

    try {
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

      const commands = await cliService.getAllCommands();

      let filteredCommands = commands;
      if (filterModule !== undefined && filterModule !== null && filterModule !== '') {
        const commandsArray = Array.from(commands.entries());
        filteredCommands = new Map(
          commandsArray.filter(([name]): boolean => { return name.startsWith(`${filterModule}:`) }),
        );
      }

      if (format === 'json') {
        const commandsArray = Array.from(filteredCommands.entries());
        console.log(JSON.stringify(commandsArray, null, 2));
      } else {
        console.log('\nSystemPrompt OS - Available Commands');
        console.log('====================================');
        console.log(typedModule.formatCommands(filteredCommands, format));
        console.log('\nUse "systemprompt cli:help --command <name>" for detailed help');
      }
    } catch (error) {
      throw new CommandExecutionError('cli:list', error as Error);
    }
  },
};
