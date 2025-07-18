/**
 * @fileoverview List all available commands
 * @module modules/core/cli/cli/list
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
      let commands = await cliModule.getAllCommands();
      
      // Filter by module if specified
      if (args.module) {
        const filtered = new Map<string, any>();
        commands.forEach((command, name) => {
          if (name.startsWith(`${args.module}:`)) {
            filtered.set(name, command);
          }
        });
        commands = filtered;
        
        if (commands.size === 0) {
          console.log(`No commands found for module: ${args.module}`);
          return;
        }
      }
      
      const format = args.format || 'text';
      const output = cliModule.formatCommands(commands, format);
      
      if (format === 'text' || format === 'table') {
        console.log('\nSystemPrompt OS - Available Commands');
        console.log('====================================');
      }
      
      console.log(output);
      
      if (format === 'text') {
        console.log(`\nTotal commands: ${commands.size}`);
      }
    } catch (error) {
      console.error('Error listing commands:', error);
      process.exit(1);
    }
  }
};