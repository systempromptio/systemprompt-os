/**
 * @file Status command.
 * @module modules/core/cli/cli/status
 * Shows status and summary of enabled CLI commands.
 */

import { getModuleLoader } from '@/modules/loader';
import { ModuleName } from '@/modules/types/index';
import type {
  CLICommand,
  CLIContext,
  ICliModule,
  ICliService
} from '@/modules/core/cli/types/index';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';
import { StatusService } from '@/modules/core/cli/services/status.service';

/**
 * Gets the CLI service from the module loader.
 * @returns The CLI service.
 * @throws {Error} If the CLI module or service is not available.
 */
const getCliService = (): ICliService => {
  const moduleLoader = getModuleLoader();
  const cliModule = moduleLoader.getModule(ModuleName.CLI) as unknown;

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
  description: 'Show status and summary of enabled CLI commands',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (text, json)',
      default: 'text',
      choices: ['text', 'json'],
    },
    {
      name: 'list',
      alias: 'l',
      type: 'boolean',
      description: 'Show detailed list of all commands',
      default: false,
    },
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Filter commands by module (when using --list)',
    },
  ],
  examples: [
    'systemprompt cli:status',
    'systemprompt cli:status --format json',
    'systemprompt cli:status --list',
    'systemprompt cli:status --list --module auth',
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    const format = (args.format ?? 'text') as 'text' | 'json';
    const showList = args.list === true;
    const filterModule = args.module as string | undefined;

    try {
      const cliService = getCliService();
      const statusService = StatusService.getInstance();

      if (showList) {
        await statusService.listCommands(
          cliService,
          format === 'json' ? 'json' : 'table',
          filterModule
        );
      } else {
        await statusService.showStatus(cliService, format);
      }
    } catch (error) {
      throw new CommandExecutionError('cli:status', error as Error);
    }
  },
};
