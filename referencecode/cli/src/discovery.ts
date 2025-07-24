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
    private readonly modulesPath: string = join(process.cwd(), 'src/modules'),
    private readonly buildPath: string = join(process.cwd(), 'build/modules'),
  ) {}

  /**
   * Discover all CLI commands from modules
   */
  async discoverCommands(): Promise<Map<string, any>> {
    const commands = new Map<string, any>();

    // Discover commands from source modules (for metadata)
    await this.discoverFromSource(commands);

    return commands;
  }

  /**
   * Discover commands from source modules
   */
  private async discoverFromSource(commands: Map<string, any>): Promise<void> {
    const moduleTypes = ['core', 'custom'];

    for (const type of moduleTypes) {
      const typePath = join(this.modulesPath, type);
      if (existsSync(typePath)) {
        await this.discoverInDirectory(typePath, commands);
      }
    }

    // Check extension modules
    const extensionsPath = join(process.cwd(), 'extensions/modules');
    if (existsSync(extensionsPath)) {
      await this.discoverInDirectory(extensionsPath, commands);
    }
  }

  /**
   * Discover commands in a specific directory
   */
  private async discoverInDirectory(dirPath: string, commands: Map<string, any>): Promise<void> {
    try {
      const modules = readdirSync(dirPath, { withFileTypes: true }).filter((dirent) =>
        dirent.isDirectory(),
      );

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
                module: moduleName,
                fullCommand: commandName,
                // Executor will be loaded on demand when command is actually run
                executorPath: this.getExecutorPath(moduleName, cmdDef.name),
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
   * Get the executor path for a command
   */
  private getExecutorPath(moduleName: string, commandName: string): string {
    // Commands are always executed from the build directory
    return join(this.buildPath, 'core', moduleName, 'cli', `${commandName}.js`);
  }

  /**
   * Load command executor on demand
   */
  async loadCommandExecutor(commandPath: string): Promise<((...args: any[]) => any) | undefined> {
    if (!existsSync(commandPath)) {
      console.error(`Command executor not found: ${commandPath}`);
      return undefined;
    }

    try {
      const module = await import(commandPath);

      if (module.command?.execute) {
        return module.command.execute;
      } else if (module.default?.execute) {
        return module.default.execute;
      } else if (typeof module.default === 'function') {
        return module.default;
      }
    } catch (error) {
      console.error(`Error loading command from ${commandPath}:`, error);
    }

    return undefined;
  }
}
