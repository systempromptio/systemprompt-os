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
import { HelpService } from '@/modules/core/cli/services/help.service.js';

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
      const helpService = HelpService.getInstance();

      if ((args as any)?.command !== undefined && (args as any)?.command !== null) {
        await helpService.showSpecificCommandHelp((args as any).command as string, cliService);
      } else if ((args as any)?.all === true) {
        await helpService.showAllCommands(cliService);
      } else {
        await helpService.showGeneralHelp(cliService);
      }
    } catch (error) {
      throw new CommandExecutionError('cli:help', error as Error);
    }
  },
};
