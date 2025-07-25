/**
 * @file CLI Command Discovery.
 * @module src/cli/src/discovery
 */

import {
 existsSync, readFileSync, readdirSync
} from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { CLICommand } from '@/modules/core/cli/types/index';

/**
 * Interface for module configuration.
 */
interface ModuleConfig {
  name?: string;
  version?: string;
  cli?: {
    commands?: Array<{
      name: string;
      description: string;
      executor?: string;
      options?: Array<{
        name: string;
        type: 'string' | 'boolean' | 'number' | 'array';
        description: string;
        alias?: string;
        default?: unknown;
        required?: boolean;
        choices?: string[];
      }>;
    }>;
  };
}

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

    for (const directory of directories) {
      try {
        if (existsSync(directory)) {
          const discovered = await this.discoverInDirectory(directory);
          for (const [name, command] of discovered) {
            commands.set(name, command);
          }
        }
      } catch (error) {
        continue;
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

    try {
      const entries = readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const modulePath = join(directory, entry.name);
        const moduleYamlPath = join(modulePath, 'module.yaml');

        if (!existsSync(moduleYamlPath)) {
          continue;
        }

        try {
          const yamlContent = readFileSync(moduleYamlPath, 'utf-8');
          const moduleConfig = parse(yamlContent) as ModuleConfig;

          if (!moduleConfig.cli?.commands) {
            continue;
          }

          for (const commandConfig of moduleConfig.cli.commands) {
            const commandName = `${entry.name}:${commandConfig.name}`;

            const cliDir = join(modulePath, 'cli');
            if (existsSync(cliDir)) {
              const cliFiles = readdirSync(cliDir, { withFileTypes: true });

              for (const file of cliFiles) {
                if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
                  const baseName = file.name.replace(/\.(ts|js)$/, '');

                  if (baseName === commandConfig.name || commandConfig.name.includes(baseName)) {
                    try {
                      const commandPath = join(cliDir, file.name);
                      const commandModule = await import(commandPath);

                      const command: CLICommand = {
                        name: commandConfig.name,
                        description: commandConfig.description,
                        options: commandConfig.options || [],
                        executorPath: commandPath,
                        ...commandModule.default || {}
                      };

                      commands.set(commandName, command);
                    } catch (importError) {
                      continue;
                    }
                  }
                }
              }
            }
          }
        } catch (yamlError) {
          continue;
        }
      }
    } catch (readError) {
      throw readError;
    }

    return commands;
  }
}
