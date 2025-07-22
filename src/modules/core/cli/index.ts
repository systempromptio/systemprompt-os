/**
 * @fileoverview CLI module - CLI utilities and help system
 * @module modules/core/cli
 */

import { ModuleInterface, ModuleContext } from '@/modules/types';
import { CLIService } from '@/modules/core/cli/services/cli.service';
import { CLICommand, CLIModuleExports } from '@/modules/core/cli/types';
import { CLIInitializationError } from '@/modules/core/cli/utils/errors';

/**
 * CLI module for managing command-line interface utilities and help system
 */
export class CLIModule implements ModuleInterface {
  name = 'cli';
  version = '1.0.0';
  type = 'service' as const;
  
  private cliService: CLIService;
  exports: CLIModuleExports;
  
  constructor() {
    this.cliService = CLIService.getInstance();
    
    // Set up exports
    this.exports = {
      getAllCommands: () => this.getAllCommands(),
      getCommandHelp: (commandName: string, commands: Map<string, CLICommand>) => 
        this.getCommandHelp(commandName, commands),
      formatCommands: (commands: Map<string, CLICommand>, format: string) => 
        this.formatCommands(commands, format),
      generateDocs: (commands: Map<string, CLICommand>, format: string) => 
        this.generateDocs(commands, format)
    };
  }
  
  /**
   * Initialize the CLI module
   * @param context - Module initialization context
   * @throws {CLIInitializationError} If initialization fails
   */
  async initialize(context: ModuleContext): Promise<void> {
    try {
      await this.cliService.initialize(context.logger!);
      context.logger?.info('CLI module initialized');
    } catch (error) {
      throw new CLIInitializationError(error as Error);
    }
  }
  
  /**
   * Start the CLI module
   */
  async start(): Promise<void> {
    // No specific start actions needed
  }
  
  /**
   * Stop the CLI module
   */
  async stop(): Promise<void> {
    // No specific stop actions needed
  }
  
  /**
   * Check the health of the CLI module
   * @returns Health check result
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { 
      healthy: this.cliService.isInitialized(),
      message: this.cliService.isInitialized() 
        ? 'CLI service is healthy' 
        : 'CLI service not initialized'
    };
  }
  
  /**
   * Get all available commands
   * @returns Map of command names to command definitions
   */
  async getAllCommands(): Promise<Map<string, CLICommand>> {
    return await this.cliService.getAllCommands();
  }
  
  /**
   * Get help text for a specific command
   * @param commandName - Name of the command
   * @param commands - Map of available commands
   * @returns Help text for the command
   */
  getCommandHelp(commandName: string, commands: Map<string, CLICommand>): string {
    const command = commands.get(commandName);
    
    if (!command) {
      return `Command not found: ${commandName}`;
    }
    
    let help = `\nCommand: ${commandName}\n`;
    help += `Description: ${command.description || 'No description available'}\n`;
    
    if (command.options && command.options.length > 0) {
      help += '\nOptions:\n';
      command.options.forEach(opt => {
        const aliasText = opt.alias ? `, -${opt.alias}` : '';
        const defaultText = opt.default !== undefined ? ` (default: ${opt.default})` : '';
        const requiredText = opt.required ? ' [required]' : '';
        help += `  --${opt.name}${aliasText}\n`;
        help += `    ${opt.description}${defaultText}${requiredText}\n`;
      });
    }
    
    return help;
  }
  
  /**
   * Format commands for display
   * @param commands - Map of available commands
   * @param format - Output format ('text', 'json', or 'table')
   * @returns Formatted command list
   */
  formatCommands(commands: Map<string, CLICommand>, format: string = 'text'): string {
    if (format === 'json') {
      const commandsObj: Record<string, CLICommand> = {};
      commands.forEach((value, key) => {
        commandsObj[key] = value;
      });
      return JSON.stringify(commandsObj, null, 2);
    }
    
    // Group commands by module
    const modules = new Map<string, Array<{ name: string; description: string }>>();
    
    commands.forEach((command, name) => {
      const parts = name.split(':');
      const moduleName = parts.length > 1 ? parts[0] : 'core';
      const commandName = parts.length > 1 ? parts.slice(1).join(':') : name;
      
      if (!modules.has(moduleName)) {
        modules.set(moduleName, []);
      }
      
      modules.get(moduleName)!.push({
        name: commandName,
        description: command.description || 'No description'
      });
    });
    
    let output = '';
    
    if (format === 'table') {
      output = 'Available Commands\n';
      output += '==================\n\n';
    }
    
    // Sort modules alphabetically
    const sortedModules = Array.from(modules.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    sortedModules.forEach(([moduleName, moduleCommands]) => {
      output += `\n${moduleName} commands:\n`;
      output += '-'.repeat(moduleName.length + 10) + '\n';
      
      // Sort commands within module
      moduleCommands.sort((a, b) => a.name.localeCompare(b.name));
      
      moduleCommands.forEach(cmd => {
        if (format === 'table') {
          output += `  ${moduleName}:${cmd.name.padEnd(20)} ${cmd.description}\n`;
        } else {
          output += `  ${cmd.name}\n    ${cmd.description}\n`;
        }
      });
    });
    
    return output;
  }
  
  /**
   * Generate documentation for all commands
   * @param commands - Map of available commands
   * @param format - Documentation format ('markdown', 'html', or 'json')
   * @returns Generated documentation
   */
  generateDocs(commands: Map<string, CLICommand>, format: string = 'markdown'): string {
    if (format === 'markdown') {
      let doc = '# SystemPrompt OS CLI Commands\n\n';
      doc += 'This document contains all available CLI commands for SystemPrompt OS.\n\n';
      doc += '## Usage\n\n';
      doc += '```bash\nsystemprompt <command> [options]\n```\n\n';
      doc += '## Commands\n\n';
      
      // Group by module
      const modules = new Map<string, any[]>();
      commands.forEach((command, name) => {
        const parts = name.split(':');
        const moduleName = parts.length > 1 ? parts[0] : 'core';
        
        if (!modules.has(moduleName)) {
          modules.set(moduleName, []);
        }
        
        modules.get(moduleName)!.push({ name, ...command });
      });
      
      // Sort and generate docs
      Array.from(modules.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([moduleName, moduleCommands]) => {
          doc += `### ${moduleName} module\n\n`;
          
          moduleCommands
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(cmd => {
              doc += `#### ${cmd.name}\n\n`;
              doc += `${cmd.description || 'No description available'}\n\n`;
              
              if (cmd.options && cmd.options.length > 0) {
                doc += '**Options:**\n\n';
                cmd.options.forEach(opt => {
                  const aliasText = opt.alias ? `, -${opt.alias}` : '';
                  const defaultText = opt.default !== undefined ? ` (default: ${opt.default})` : '';
                  const requiredText = opt.required ? ' **[required]**' : '';
                  doc += `- \`--${opt.name}${aliasText}\`: ${opt.description}${defaultText}${requiredText}\n`;
                });
                doc += '\n';
              }
            });
        });
      
      return doc;
    }
    
    // For other formats, return JSON for now
    const commandsObj: Record<string, CLICommand> = {};
    commands.forEach((value, key) => {
      commandsObj[key] = value;
    });
    return JSON.stringify(commandsObj, null, 2);
  }
}