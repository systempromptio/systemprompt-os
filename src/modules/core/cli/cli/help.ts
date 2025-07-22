/**
 * @fileoverview Help command
 * @module modules/core/cli/cli/help
 */

import { CLIModule } from '@/modules/core/cli';
import { CLIContext, CLICommand } from '@/modules/core/cli/types';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';

export const command: CLICommand = {
  description: 'Show help information for commands',
  options: [
    {
      name: 'command',
      type: 'string',
      description: 'Specific command to get help for'
    },
    {
      name: 'all',
      alias: 'a',
      type: 'boolean',
      description: 'Show all available commands with details',
      default: false
    }
  ],
  examples: [
    'systemprompt cli:help',
    'systemprompt cli:help --command database:migrate',
    'systemprompt cli:help --all'
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      const cliModule = new CLIModule();
      await cliModule.initialize({ logger: context.logger });
      
      // Get all available commands
      const commands = await cliModule.getAllCommands();
      
      if (args.command) {
        // Show help for specific command
        const help = cliModule.getCommandHelp(args.command, commands);
        console.log(help);
      } else if (args.all) {
        // Show all commands with full details
        console.log('\nSystemPrompt OS - All Available Commands');
        console.log('========================================\n');
        
        // Sort commands alphabetically
        const sortedCommands = Array.from(commands.entries()).sort((a, b) => 
          a[0].localeCompare(b[0])
        );
        
        sortedCommands.forEach(([name, _command]) => {
          console.log(cliModule.getCommandHelp(name, commands));
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
  }
};