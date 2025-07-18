/**
 * Module command discovery for CLI
 */

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { CLICommand } from './types.js';

export interface DiscoveredCommand {
  moduleName: string;
  command: CLICommand;
}

export class CommandDiscovery {
  constructor(
    private modulesPath: string = join(process.cwd(), 'src/modules')
  ) {}
  
  /**
   * Discover all CLI commands from modules
   */
  async discoverCommands(): Promise<Map<string, any>> {
    const commands = new Map<string, any>();
    
    // Check core modules
    const corePath = join(this.modulesPath, 'core');
    if (existsSync(corePath)) {
      await this.discoverInDirectory(corePath, commands);
    }
    
    // Check custom modules
    const customPath = join(this.modulesPath, 'custom');
    if (existsSync(customPath)) {
      await this.discoverInDirectory(customPath, commands);
    }
    
    // Check extension modules
    const extensionsPath = join(process.cwd(), 'extensions/modules');
    if (existsSync(extensionsPath)) {
      await this.discoverInDirectory(extensionsPath, commands);
    }
    
    return commands;
  }
  
  /**
   * Discover commands in a specific directory
   */
  private async discoverInDirectory(dirPath: string, commands: Map<string, any>): Promise<void> {
    try {
      const modules = readdirSync(dirPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory());
      
      for (const moduleDir of modules) {
        const moduleName = moduleDir.name;
        const moduleYamlPath = join(dirPath, moduleName, 'module.yaml');
        
        if (existsSync(moduleYamlPath)) {
          // Load module.yaml to get command definitions
          const yaml = await import('yaml');
          const moduleConfig = yaml.parse(readFileSync(moduleYamlPath, 'utf-8'));
          
          if (moduleConfig.cli?.commands) {
            for (const cmdDef of moduleConfig.cli.commands) {
              const commandName = `${moduleName}:${cmdDef.name}`;
              commands.set(commandName, {
                ...cmdDef,
                moduleName,
                execute: await this.loadCommandExecutor(dirPath, moduleName, cmdDef.name)
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error discovering commands in ${dirPath}:`, error);
    }
  }
  
  /**
   * Load command executor from module CLI directory
   */
  private async loadCommandExecutor(basePath: string, moduleName: string, commandName: string): Promise<Function | undefined> {
    const cliPath = join(basePath, moduleName, 'cli', `${commandName}.ts`);
    const cliJsPath = join(basePath, moduleName, 'cli', `${commandName}.js`);
    
    // Try loading the command file
    const filePath = existsSync(cliJsPath) ? cliJsPath : cliPath;
    
    if (existsSync(filePath)) {
      try {
        // For TypeScript files in development, we need to handle them differently
        // In production, these would be compiled to .js
        const module = await import(filePath);
        
        if (module.command?.execute) {
          return module.command.execute;
        } else if (module.default?.execute) {
          return module.default.execute;
        }
      } catch (error) {
        console.error(`Error loading command from ${filePath}:`, error);
      }
    }
    
    return undefined;
  }
  
}