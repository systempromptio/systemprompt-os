/**
 * @file CLI Command Discovery.
 * @description Utility for discovering and loading CLI commands from modules across the system.
 * @module src/cli/src/discovery
 */

import {
  type Dirent,
  existsSync,
  readFileSync,
  readdirSync
} from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { CLICommand } from '@/modules/core/cli/types/index';
import type { IModuleConfig } from '@/cli/src/types/discovery.types';

/**
 * Command discovery utility for CLI commands across modules.
 */
export class CommandDiscovery {
  private readonly modulesPath: string;

  /**
   * Create a new CommandDiscovery instance.
   * @param modulesPath - Path to the modules directory (defaults to src/modules).
   */
  constructor(modulesPath?: string) {
    this.modulesPath = modulesPath ?? join(process.cwd(), 'src', 'modules');
  }

  /**
   * Discover all available CLI commands.
   * @returns Map of command names to command definitions.
   */
  public async discoverCommands(): Promise<Map<string, CLICommand>> {
    const commands = new Map<string, CLICommand>();

    const directories = [
      join(this.modulesPath, 'core'),
      join(this.modulesPath, 'custom'),
      join(this.modulesPath, '..', '..', 'extensions', 'modules')
    ];

    const directoryResults = await Promise.all(
      directories.map(async (directory) => {
        if (!existsSync(directory)) {
          return new Map<string, CLICommand>();
        }
        try {
          return await this.discoverInDirectory(directory);
        } catch {
          return new Map<string, CLICommand>();
        }
      })
    );

    for (const discovered of directoryResults) {
      for (const [name, command] of discovered) {
        commands.set(name, command);
      }
    }

    return commands;
  }

  /**
   * Discover commands in a specific directory.
   * @param directory - Directory to scan for modules.
   * @returns Map of discovered commands.
   */
  private async discoverInDirectory(directory: string): Promise<Map<string, CLICommand>> {
    const commands = new Map<string, CLICommand>();
    const entries = readdirSync(directory, { withFileTypes: true });

    const moduleDirectories = entries.filter((entry) => { return entry.isDirectory() });

    const moduleResults = await Promise.all(
      moduleDirectories.map(async (entry) => {
        const modulePath = join(directory, entry.name);
        return await this.processModule(modulePath, entry.name);
      })
    );

    for (const moduleCommands of moduleResults) {
      for (const [name, command] of moduleCommands) {
        commands.set(name, command);
      }
    }

    return commands;
  }

  /**
   * Process a single module directory for CLI commands.
   * @param modulePath - Path to the module directory.
   * @param moduleName - Name of the module.
   * @returns Map of commands from this module.
   */
  private async processModule(modulePath: string, moduleName: string): Promise<Map<string, CLICommand>> {
    const commands = new Map<string, CLICommand>();
    const moduleYamlPath = join(modulePath, 'module.yaml');

    if (!existsSync(moduleYamlPath)) {
      return commands;
    }

    try {
      const moduleConfig = this.loadModuleConfig(moduleYamlPath);
      const cliCommands = moduleConfig.cli?.commands;

      if (cliCommands == null || cliCommands.length === 0) {
        return commands;
      }

      const commandResults = await Promise.all(
        cliCommands.map(async (commandConfig) => {
          const commandName = `${moduleName}:${commandConfig.name}`;
          const command = await this.loadCommand(modulePath, commandConfig);
          return command != null ? {
 name: commandName,
command
} : null;
        })
      );

      for (const result of commandResults) {
        if (result != null) {
          commands.set(result.name, result.command);
        }
      }
    } catch {
    }

    return commands;
  }

  /**
   * Load module configuration from YAML file.
   * @param yamlPath - Path to the module.yaml file.
   * @returns Parsed module configuration.
   */
  private loadModuleConfig(yamlPath: string): IModuleConfig {
    const yamlContent = readFileSync(yamlPath, 'utf-8');
    return parse(yamlContent) as IModuleConfig;
  }

  /**
   * Load a command implementation from a module.
   * @param modulePath - Path to the module.
   * @param commandConfig - Command configuration from module.yaml.
   * @returns Loaded command or null if not found.
   */
  private async loadCommand(
    modulePath: string,
    commandConfig: NonNullable<NonNullable<IModuleConfig['cli']>['commands']>[number]
  ): Promise<CLICommand | null> {
    const cliDir = join(modulePath, 'cli');

    if (!existsSync(cliDir)) {
      return null;
    }

    const cliFiles = readdirSync(cliDir, { withFileTypes: true });
    const commandFile = this.findCommandFile(cliFiles, commandConfig.name);

    if (commandFile == null) {
      return null;
    }

    try {
      const commandPath = join(cliDir, commandFile.name);

      const commandModule = await import(commandPath) as { default?: Partial<CLICommand> };

      return {
        name: commandConfig.name,
        description: commandConfig.description,
        options: commandConfig.options ?? [],
        executorPath: commandPath,
        ...commandModule.default ?? {}
      };
    } catch {
      return null;
    }
  }

  /**
   * Find the command file matching the command name.
   * @param files - Directory entries to search.
   * @param commandName - Name of the command to find.
   * @returns Matching file entry or null.
   */
  private findCommandFile(
    files: Dirent[],
    commandName: string
  ): Dirent | null {
    for (const file of files) {
      if (!file.isFile()) {
        continue;
      }

      const isScriptFile = (/\.(ts|js)$/u).test(file.name);
      if (!isScriptFile) {
        continue;
      }

      const baseName = file.name.replace(/\.(ts|js)$/u, '');
      if (baseName === commandName || commandName.includes(baseName)) {
        return file;
      }
    }

    return null;
  }
}
