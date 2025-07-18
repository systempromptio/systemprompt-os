/**
 * @fileoverview Help command
 * @module modules/core/cli/cli/help
 */

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}
import { CLIModule } from '../index.js';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      const cliModule = new CLIModule();
      await cliModule.initialize({ config: {} });
      
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
        
        commands.forEach((_command, name) => {
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
      console.error('Error displaying help:', error);
      process.exit(1);
    }
  }
};