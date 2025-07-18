/**
 * @fileoverview CLI module - CLI utilities and help system
 * @module modules/core/cli
 */

// Module interface defined locally
export interface ModuleInterface {
  name: string;
  version: string;
  type: 'core' | 'service' | 'extension';
  initialize(context: { config?: any; logger?: any }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

import { CommandDiscovery } from '../../../cli/src/discovery.js';

export class CLIModule implements ModuleInterface {
  name = 'cli';
  version = '1.0.0';
  type = 'service' as const;
  
  private logger: any;
  private commandDiscovery: CommandDiscovery | undefined;
  
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    // Store config if needed in the future
    // this.config = context.config || {};
    this.logger = context.logger;
    
    // Initialize command discovery
    this.commandDiscovery = new CommandDiscovery();
    
    this.logger?.info('CLI module initialized');
  }
  
  async start(): Promise<void> {
    this.logger?.info('CLI module started');
  }
  
  async stop(): Promise<void> {
    this.logger?.info('CLI module stopped');
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
  
  /**
   * Get all available commands
   */
  async getAllCommands(): Promise<Map<string, any>> {
    if (!this.commandDiscovery) {
      this.commandDiscovery = new CommandDiscovery();
    }
    return await this.commandDiscovery.discoverCommands();
  }
  
  /**
   * Get help for a specific command
   */
  getCommandHelp(commandName: string, commands: Map<string, any>): string {
    const command = commands.get(commandName);
    
    if (!command) {
      return `Command not found: ${commandName}`;
    }
    
    let help = `\nCommand: ${commandName}\n`;
    help += `Description: ${command.description || 'No description available'}\n`;
    
    if (command.options && command.options.length > 0) {
      help += '\nOptions:\n';
      command.options.forEach((opt: any) => {
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
   */
  formatCommands(commands: Map<string, any>, format: string = 'text'): string {
    if (format === 'json') {
      const commandsObj: any = {};
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
   */
  generateDocs(commands: Map<string, any>, format: string = 'markdown'): string {
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
                cmd.options.forEach((opt: any) => {
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
    const commandsObj: any = {};
    commands.forEach((value, key) => {
      commandsObj[key] = value;
    });
    return JSON.stringify(commandsObj, null, 2);
  }
}