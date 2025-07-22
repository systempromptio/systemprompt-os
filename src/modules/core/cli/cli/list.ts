/**
 * @fileoverview List all available CLI commands
 * @module modules/core/cli/cli/list
 */

import { CLIModule } from '@/modules/core/cli';
import { CLIContext, CLICommand } from '@/modules/core/cli/types';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';

export const command: CLICommand = {
  description: 'List all available commands',
  options: [
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Filter commands by module'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (text, json, table)',
      default: 'text',
      choices: ['text', 'json', 'table']
    }
  ],
  examples: [
    'systemprompt cli:list',
    'systemprompt cli:list --format json',
    'systemprompt cli:list --module auth'
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    const format = args.format || 'text';
    const filterModule = args.module;
    
    try {
      const cliModule = new CLIModule();
      await cliModule.initialize({ logger: context.logger });
      
      // Get all available commands
      const commands = await cliModule.getAllCommands();
      
      // Filter by module if specified
      let filteredCommands = commands;
      if (filterModule) {
        filteredCommands = new Map(
          Array.from(commands.entries()).filter(([name]) => 
            name.startsWith(`${filterModule}:`)
          )
        );
      }
      
      if (format === 'json') {
        // Output commands in JSON format for the API
        const commandsArray = Array.from(filteredCommands.entries()).map(([name, cmd]) => {
          const parts = name.split(':');
          const module = parts.length > 1 ? parts[0] : 'core';
          const commandName = parts.length > 1 ? parts.slice(1).join(':') : name;
          
          return {
            command: commandName,
            module: module,
            description: cmd.description || 'No description available',
            usage: `systemprompt ${name}`,
            options: cmd.options || [],
            positionals: cmd.positionals || []
          };
        });
        
        console.log(JSON.stringify(commandsArray, null, 2));
      } else {
        // Display commands in text format
        console.log('\nSystemPrompt OS - Available Commands');
        console.log('====================================');
        console.log(cliModule.formatCommands(filteredCommands, format));
        console.log('\nUse "systemprompt cli:help --command <name>" for detailed help');
      }
    } catch (error) {
      throw new CommandExecutionError('cli:list', error as Error);
    }
  }
};