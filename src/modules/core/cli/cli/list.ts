/**
 * @file List command.
 * @module modules/core/cli/cli/list
 * Provides functionality to list all available CLI commands.
 */

import { CLIModule } from '@/modules/core/cli/index';
import type { CLICommand, CLIContext } from '@/modules/core/cli/types/manual';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

/**
 * Parses a command name to extract module and command parts.
 * @param commandName - The full command name (e.g., 'auth:login' or 'help').
 * @returns Object containing module and command parts.
 */
const parseCommandName = (commandName: string): { module: string; command: string } => {
  const parts = commandName.split(':');
  if (parts.length === 1) {
    return { module: 'core',
command: parts[0] ?? '' };
  }
  return { module: parts[0] ?? '',
command: parts[1] ?? '' };
};

/**
 * Filters commands by module name.
 * @param commands - Map of all commands.
 * @param moduleName - Name of the module to filter by.
 * @returns Filtered map of commands.
 */
const filterCommandsByModule = (commands: Map<string, CLICommand>, moduleName: string): Map<string, CLICommand> => {
  const filtered = new Map<string, CLICommand>();
  
  for (const [name, cmd] of Array.from(commands.entries())) {
    const { module } = parseCommandName(name);
    if (module === moduleName) {
      filtered.set(name, cmd);
    }
  }
  
  return filtered;
};

export const command: CLICommand = {
  description: 'List all available commands',
  options: [
    {
      name: 'module',
      type: 'string',
      description: 'Filter commands by module name',
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format (text, json, table)',
      default: 'text',
      choices: ['text', 'json', 'table'],
    },
  ],
  examples: [
    'systemprompt cli:list',
    'systemprompt cli:list --module auth',
    'systemprompt cli:list --format json',
    'systemprompt cli:list --module auth --format table',
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    const cliOutput = CliOutputService.getInstance();

    try {
      const cliModule = new CLIModule();
      await cliModule.initialize();

      let commands = await cliModule.getAllCommands();

      // Filter by module if specified
      if (args.module && typeof args.module === 'string') {
        commands = filterCommandsByModule(commands, args.module);
      }

      const format = (args.format as string) || 'text';

      if (format === 'json') {
        const commandList = Array.from(commands.entries()).map(([name, cmd]) => {
          const { module, command } = parseCommandName(name);
          return {
            command,
            module,
            description: cmd.description,
            usage: `systemprompt ${name}`,
            options: cmd.options || [],
            positionals: cmd.positionals || []
          };
        });
        cliOutput.json(commandList);
      } else {
        // Show header for text and table formats
        if (format === 'text') {
          cliOutput.section('SystemPrompt OS - Available Commands');
        }
        
        const formattedOutput = cliModule.formatCommands(commands, format);
        cliOutput.output(formattedOutput, { format: 'text' });
      }
    } catch (error) {
      cliOutput.error('Failed to list commands');
      throw new CommandExecutionError('cli:list', error as Error);
    }
  },
};
