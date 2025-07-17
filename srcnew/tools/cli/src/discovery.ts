/**
 * Module command discovery for CLI
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { CLICommand } from '../../../src/interfaces/cli.js';
import { ModuleRegistry } from '../../../modules/registry.js';

export interface DiscoveredCommand {
  moduleName: string;
  command: CLICommand;
}

export class CommandDiscovery {
  constructor(
    private modulesPath: string,
    private registry: ModuleRegistry
  ) {}
  
  /**
   * Discover all CLI commands from modules
   */
  async discoverCommands(): Promise<DiscoveredCommand[]> {
    const commands: DiscoveredCommand[] = [];
    
    // Check core modules
    const corePath = join(this.modulesPath, 'core');
    if (existsSync(corePath)) {
      const coreCommands = await this.discoverInDirectory(corePath);
      commands.push(...coreCommands);
    }
    
    // Check custom modules
    const customPath = join(this.modulesPath, 'custom');
    if (existsSync(customPath)) {
      const customCommands = await this.discoverInDirectory(customPath);
      commands.push(...customCommands);
    }
    
    return commands;
  }
  
  /**
   * Discover commands in a specific directory
   */
  private async discoverInDirectory(dirPath: string): Promise<DiscoveredCommand[]> {
    const commands: DiscoveredCommand[] = [];
    
    try {
      const modules = readdirSync(dirPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory());
      
      for (const moduleDir of modules) {
        const moduleName = moduleDir.name;
        const cliPath = join(dirPath, moduleName, 'cli');
        
        if (existsSync(cliPath)) {
          const moduleCommands = await this.loadModuleCommands(moduleName, cliPath);
          commands.push(...moduleCommands);
        }
      }
    } catch (error) {
      console.error(`Error discovering commands in ${dirPath}:`, error);
    }
    
    return commands;
  }
  
  /**
   * Load commands from a module's CLI directory
   */
  private async loadModuleCommands(moduleName: string, cliPath: string): Promise<DiscoveredCommand[]> {
    const commands: DiscoveredCommand[] = [];
    
    try {
      const files = readdirSync(cliPath)
        .filter(file => {
          // Only load .js files (not .d.ts or .ts in production)
          return file.endsWith('.js') && !file.endsWith('.d.ts');
        });
      
      for (const file of files) {
        const filePath = join(cliPath, file);
        try {
          // Dynamic import
          const module = await import(filePath);
          
          // Look for exported command
          if (module.default && this.isValidCommand(module.default)) {
            commands.push({
              moduleName,
              command: module.default
            });
          } else if (module.command && this.isValidCommand(module.command)) {
            commands.push({
              moduleName,
              command: module.command
            });
          }
        } catch (error) {
          console.error(`Error loading command from ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error loading commands from ${cliPath}:`, error);
    }
    
    return commands;
  }
  
  /**
   * Validate that an object is a valid CLI command
   */
  private isValidCommand(obj: any): obj is CLICommand {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.execute === 'function'
    );
  }
}