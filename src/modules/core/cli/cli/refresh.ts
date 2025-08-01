/**
 * @file Refresh command.
 * @module modules/core/cli/cli/refresh
 * Refreshes CLI commands by rescanning enabled modules.
 */

import { getModuleRegistry } from '@/modules/core/modules/index';
import { ModuleName } from '@/modules/types/index';
import type {
  CLICommand,
  CLIContext,
  ICliModule,
  ICliService
} from '@/modules/core/cli/types/manual';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';
import { RefreshService } from '@/modules/core/cli/services/refresh.service';

/**
 * Gets the CLI service from the module loader.
 * @returns The CLI service.
 * @throws {Error} If the CLI module or service is not available.
 */
const getCliService = (): ICliService => {
  const registry = getModuleRegistry();
  const cliModule = registry.get(ModuleName.CLI) as unknown;

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
  description: 'Refresh CLI commands by rescanning enabled modules',
  options: [
    {
      name: 'verbose',
      alias: 'v',
      type: 'boolean',
      description: 'Show verbose output during refresh',
      default: false,
    },
  ],
  examples: [
    'systemprompt cli:refresh',
    'systemprompt cli:refresh --verbose',
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    const verbose = Boolean(args.verbose);

    try {
      const cliService = getCliService();
      const refreshService = RefreshService.getInstance();

      await refreshService.performRefresh(cliService, verbose);
    } catch (error) {
      throw new CommandExecutionError('cli:refresh', error as Error);
    }
  },
};
