/**
 * @file List command.
 * @module modules/core/cli/cli/list
 * Provides functionality to list all available CLI commands.
 */

import { CLIModule } from '@/modules/core/cli/index';
import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';

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
 * Formats commands as JSON output.
 * @param commands - Map of commands to format.
 * @returns JSON string representation of commands.
 */
const formatCommandsAsJson = (commands: Map<string, CLICommand>): string => {
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
  
  return JSON.stringify(commandList, null, 2);
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

    try {
      const cliModule = new CLIModule();
      console.log('cliModule instance:', cliModule);
      console.log('cliModule.initialize:', typeof cliModule.initialize);
      await cliModule.initialize();

      let commands = await cliModule.getAllCommands();

      // Filter by module if specified
      if (args.module && typeof args.module === 'string') {
        commands = filterCommandsByModule(commands, args.module);
      }

      const format = (args.format as string) || 'text';

      if (format === 'json') {
        const jsonOutput = formatCommandsAsJson(commands);
        console.log(jsonOutput);
      } else {
        // Show header for text and table formats
        if (format === 'text') {
          console.log('SystemPrompt OS - Available Commands');
          console.log('====================================');
        }
        
        const formattedOutput = cliModule.formatCommands(commands, format);
        console.log(formattedOutput);
      }
    } catch (error) {
      throw new CommandExecutionError('cli:list', error as Error);
    }
  },
};
