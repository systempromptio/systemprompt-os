/**
 * @file CLI service for command management and execution.
 * @module modules/core/cli/services/cli.service
 * Service for managing CLI commands, executing commands, and generating help documentation.
 */

import type {
  CLICommand,
  CLILogger,
  CLIOption,
  CommandMetadata,
} from '@/modules/core/cli/types/index.js';
import {
  CliInitializationError,
  CommandNotFoundError,
  DocumentationGenerationError,
  OutputFormattingError,
} from '@/modules/core/cli/utils/errors.js';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { LogSource } from '@/modules/core/logger/types/index.js';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';

interface IDatabaseCommand {
  id: number;
  command_path: string;
  command_name: string;
  description: string;
  module_name: string;
  executor_path: string;
  options: string;
  aliases: string;
  active: number;
  created_at: string;
  updated_at: string;
}

interface IParsedDatabaseCommand {
  id: number;
  command_path: string;
  command_name: string;
  description: string;
  module_name: string;
  executor_path: string;
  options: CLIOption[];
  aliases: string[];
  active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Service for managing CLI commands and operations.
 */
export class CliService {
  private static instance: CliService;
  private logger: CLILogger | null = null;
  private database: DatabaseService | null = null;
  private initialized = false;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    /**
     * Intentionally empty.
     */
  }

  /**
   * Get the singleton instance of CliService.
   * @returns The CliService instance.
   */
  public static getInstance(): CliService {
    CliService.instance ||= new CliService();
    return CliService.instance;
  }

  /**
   * Check if service is initialized.
   * @returns Whether the service is initialized.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the CLI service.
   * @param logger - Logger instance.
   * @param database - Database service instance.
   * @throws {CliInitializationError} If initialization fails.
   */
  public async initialize(logger: CLILogger, database: DatabaseService): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger = logger;
      this.database = database;

      // Database schema is handled by the global database service via schema discovery

      this.initialized = true;
      this.logger?.debug(LogSource.CLI, 'CLI service initialized', {
        category: 'init',
        persistToDb: false,
      });
    } catch (error) {
      throw new CliInitializationError(error as Error);
    }
  }

  /**
   * Get all available commands.
   * @returns Map of command names to command definitions.
   * @throws {CommandDiscoveryError} If command discovery fails.
   */
  public async getAllCommands(): Promise<Map<string, CLICommand>> {
    this.ensureInitialized();

    const commands = await this.getCommandsFromDatabase();
    const commandMap = new Map<string, CLICommand>();

    for (const cmd of commands) {
      commandMap.set(cmd.command_path, {
        name: cmd.command_name,
        description: cmd.description,
        options: cmd.options,
        executorPath: cmd.executor_path,
      });
    }

    return commandMap;
  }

  /**
   * Get metadata for all commands.
   * @returns Array of command metadata.
   */
  public async getCommandMetadata(): Promise<CommandMetadata[]> {
    const commands = await this.getAllCommands();
    const metadata: CommandMetadata[] = [];

    commands.forEach((command, name): void => {
      const parts = name.split(':');
      const moduleName = parts.length > 1 ? parts[0] : 'core';
      const commandName = parts.length > 1 ? parts.slice(1).join(':') : name;

      const meta: CommandMetadata = {
        name,
        module: moduleName ?? 'core',
        commandName,
        description: command.description ?? 'No description available',
        usage: `systemprompt ${name}`,
        options: command.options ?? [],
      };

      if (command.positionals !== undefined) {
        meta.positionals = command.positionals;
      }

      metadata.push(meta);
    });

    return metadata;
  }

  /**
   * Get help text for a specific command.
   * @param commandName - Name of the command.
   * @param commands - Map of all available commands.
   * @returns Help text for the command.
   * @throws {CommandNotFoundError} If command is not found.
   */
  public getCommandHelp(commandName: string, commands: Map<string, CLICommand>): string {
    const command = commands.get(commandName);

    if (command === undefined) {
      throw new CommandNotFoundError(commandName);
    }

    let help = `\nCommand: ${commandName}\n`;
    help += `Description: ${command.description ?? 'No description available'}\n`;

    if (command.positionals !== undefined && command.positionals.length > 0) {
      help += '\nPositional Arguments:\n';
      command.positionals.forEach((pos): void => {
        const requiredText = pos.required === true ? ' [required]' : ' [optional]';
        help += `  ${pos.name}${requiredText}\n`;
        help += `    ${pos.description}\n`;
        if (pos.default !== undefined) {
          help += `    Default: ${String(pos.default)}\n`;
        }
      });
    }

    if (command.options !== undefined && command.options.length > 0) {
      help += '\nOptions:\n';
      command.options.forEach((opt: CLIOption): void => {
        const aliasText = opt.alias !== undefined ? `, -${opt.alias}` : '';
        const defaultText = opt.default !== undefined ? ` (default: ${String(opt.default)})` : '';
        const requiredText = opt.required === true ? ' [required]' : '';
        help += `  --${opt.name}${aliasText}\n`;
        help += `    ${opt.description}${defaultText}${requiredText}\n`;
        if (opt.choices !== undefined) {
          help += `    Choices: ${opt.choices.join(', ')}\n`;
        }
      });
    }

    if (command.examples !== undefined && command.examples.length > 0) {
      help += '\nExamples:\n';
      command.examples.forEach((example): void => {
        help += `  ${example}\n`;
      });
    }

    return help;
  }

  /**
   * Format commands for display.
   * @param commands - Map of commands to format.
   * @param format - Output format ('text', 'json', or 'table').
   * @returns Formatted command list.
   * @throws {OutputFormattingError} If formatting fails.
   */
  public formatCommands(commands: Map<string, CLICommand>, format = 'text'): string {
    try {
      if (format === 'json') {
        const metadata: CommandMetadata[] = [];
        commands.forEach((command, name): void => {
          const parts = name.split(':');
          const module = parts.length > 1 ? (parts[0] ?? 'core') : 'core';
          const commandName = parts.length > 1 ? parts.slice(1).join(':') : name;

          metadata.push({
            name,
            module,
            commandName,
            description: command.description ?? 'No description available',
            usage: `systemprompt ${name}`,
            options: command.options ?? [],
          });
        });
        return JSON.stringify(metadata, null, 2);
      }

      const modules = new Map<string, Array<{ name: string; description: string }>>();

      commands.forEach((command, name): void => {
        const parts = name.split(':');
        const moduleName = parts.length > 1 ? parts[0] : 'core';
        const commandName = parts.length > 1 ? parts.slice(1).join(':') : name;

        if (!modules.has(moduleName ?? '')) {
          modules.set(moduleName ?? '', []);
        }

        const moduleCommands = modules.get(moduleName ?? '');
        if (moduleCommands !== undefined) {
          moduleCommands.push({
            name: commandName,
            description: command.description ?? 'No description',
          });
        }
      });

      let output = '';

      if (format === 'table') {
        const sortedModules = Array.from(modules.entries()).sort((a, b): number => {
          return a[0].localeCompare(b[0]);
        });

        sortedModules.forEach(([moduleName, moduleCommands]): void => {
          output += `\n${moduleName}:\n`;
          output += `${'-'.repeat(moduleName.length + 1)}\n`;

          const sortedCommands = moduleCommands.sort((a, b): number => {
            return a.name.localeCompare(b.name);
          });

          sortedCommands.forEach((cmd): void => {
            output += `  ${cmd.name.padEnd(25)} ${cmd.description}\n`;
          });
        });
      } else {
        const sortedModules = Array.from(modules.entries()).sort((a, b): number => {
          return a[0].localeCompare(b[0]);
        });

        sortedModules.forEach(([moduleName, moduleCommands]): void => {
          output += `\n${moduleName}:\n`;
          const sortedCommands = moduleCommands.sort((a, b): number => {
            return a.name.localeCompare(b.name);
          });

          sortedCommands.forEach((cmd): void => {
            output += `  ${moduleName}:${cmd.name} - ${cmd.description}\n`;
          });
        });
      }

      return output;
    } catch (error) {
      throw new OutputFormattingError(format, error as Error);
    }
  }

  /**
   * Generate documentation for all commands.
   * @param commands - Map of commands to document.
   * @param format - Documentation format (markdown, html, etc.).
   * @returns Generated documentation.
   * @throws {DocumentationGenerationError} If documentation generation fails.
   */
  public generateDocs(commands: Map<string, CLICommand>, format: string): string {
    try {
      if (format === 'markdown') {
        let doc = '# SystemPrompt OS CLI Commands\n\n';
        doc += `Generated on ${new Date().toISOString()}\n\n`;
        doc += '## Table of Contents\n\n';

        const modules = new Map<string, Array<{ name: string; command: CLICommand }>>();

        commands.forEach((command, name): void => {
          const parts = name.split(':');
          const moduleName = parts.length > 1 ? parts[0] : 'core';

          if (!modules.has(moduleName ?? '')) {
            modules.set(moduleName ?? '', []);
          }

          const moduleCommands = modules.get(moduleName ?? '');
          if (moduleCommands !== undefined) {
            moduleCommands.push({
              name,
              command,
            });
          }
        });

        const sortedModules = Array.from(modules.entries()).sort((a, b): number => {
          return a[0].localeCompare(b[0]);
        });

        sortedModules.forEach(([moduleName]): void => {
          doc += `- [${moduleName}](#${moduleName})\n`;
        });

        doc += '\n## Commands by Module\n\n';

        sortedModules.forEach(([moduleName, moduleCommands]): void => {
          doc += `### ${moduleName}\n\n`;

          const sortedCommands = moduleCommands.sort((a, b): number => {
            return a.name.localeCompare(b.name);
          });

          sortedCommands.forEach(({ name, command }): void => {
            doc += `#### ${name}\n\n`;
            doc += `${command.description ?? 'No description available'}\n\n`;
            doc += `**Usage:** \`systemprompt ${name}\`\n\n`;

            if (command.options !== undefined && command.options.length > 0) {
              doc += '**Options:**\n\n';
              command.options.forEach((opt): void => {
                const aliasText = opt.alias !== undefined ? `, -${opt.alias}` : '';
                const defaultText =
                  opt.default !== undefined ? ` (default: ${String(opt.default)})` : '';
                const requiredText = opt.required === true ? ' **[required]**' : '';
                doc += `- \`--${opt.name}${aliasText}\`: ${opt.description}${defaultText}${requiredText}\n`;
              });
              doc += '\n';
            }

            if (command.examples !== undefined && command.examples.length > 0) {
              doc += '**Examples:**\n\n';
              command.examples.forEach((example): void => {
                doc += `\`\`\`bash\n${example}\n\`\`\`\n\n`;
              });
            }
          });
        });

        return doc;
      }

      throw new Error(`Unsupported documentation format: ${format}`);
    } catch (error) {
      throw new DocumentationGenerationError(format, error as Error);
    }
  }

  /**
   * Register a new command in the database.
   * @param command - Command to register.
   * @param moduleName - Name of the module registering the command.
   * @param executorPath - Path to the command executor.
   * @throws {Error} If database is not initialized.
   */
  public async registerCommand(
    command: CLICommand,
    moduleName: string,
    executorPath: string,
  ): Promise<void> {
    if (this.database === null || this.database === undefined) {
      throw new Error('Database not initialized');
    }

    const commandPath = `${moduleName}:${command.name ?? 'unknown'}`;

    await this.database.execute(
      `INSERT OR REPLACE INTO cli_commands 
       (command_path, command_name, description, module_name, executor_path, options, aliases, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        commandPath,
        command.name ?? 'unknown',
        command.description,
        moduleName,
        executorPath,
        JSON.stringify(command.options ?? []),
        JSON.stringify(command.aliases ?? []),
        1,
      ],
    );
  }

  /**
   * Get commands from database.
   * @returns Array of registered commands.
   */
  public async getCommandsFromDatabase(): Promise<IParsedDatabaseCommand[]> {
    if (this.database === null || this.database === undefined) {
      throw new Error('Database not initialized');
    }

    const result = await this.database.query<IDatabaseCommand>(
      `SELECT * FROM cli_commands WHERE active = 1 ORDER BY command_path`,
    );

    return result.map((row): IParsedDatabaseCommand => {
      return {
        ...row,
        options: JSON.parse(row.options ?? '[]') as CLIOption[],
        aliases: JSON.parse(row.aliases ?? '[]') as string[],
      };
    });
  }

  /**
   * Parse module.yaml file to extract CLI commands.
   * @param yamlPath - Path to the module.yaml file.
   * @returns Array of command metadata.
   */
  public parseModuleYaml(yamlPath: string): Array<{
    name: string;
    description: string;
    executor: string;
  }> {
    if (!existsSync(yamlPath)) {
      return [];
    }

    const yamlContent = readFileSync(yamlPath, 'utf-8');
    const moduleConfig = parse(yamlContent) as {
      cli?: {
        commands?: Array<{
          name: string;
          description: string;
          executor: string;
        }>;
      };
    };

    return moduleConfig.cli?.commands ?? [];
  }

  /**
   * Clear all existing commands from the database.
   * @returns Promise that resolves when commands are cleared.
   */
  public async clearAllCommands(): Promise<void> {
    if (this.database === null || this.database === undefined) {
      throw new Error('Database not initialized');
    }

    await this.database.execute('DELETE FROM cli_commands');
  }

  /**
   * Scan modules and register their CLI commands from module.yaml files.
   * @param modules - Map of loaded modules with their paths.
   * @returns Promise that resolves when all commands are registered.
   */
  public async scanAndRegisterModuleCommands(
    modules: Map<string, { path: string }>,
  ): Promise<void> {
    // Clear existing commands first to ensure clean state
    await this.clearAllCommands();

    this.logger?.debug(LogSource.CLI, `Scanning ${modules.size} modules for CLI commands`, {
      category: 'commands',
      persistToDb: false,
    });

    for (const [moduleName, moduleInfo] of modules) {
      try {
        const yamlPath = join(moduleInfo.path, 'module.yaml');
        this.logger?.debug(LogSource.CLI, `Checking for module.yaml at: ${yamlPath}`, {
          category: 'commands',
          persistToDb: false,
        });

        if (!existsSync(yamlPath)) {
          this.logger?.debug(
            LogSource.CLI,
            `Module YAML not found for ${moduleName}: ${yamlPath}`,
            { category: 'commands',
persistToDb: false },
          );
          continue;
        }

        const yamlContent = readFileSync(yamlPath, 'utf-8');
        const moduleConfig = parse(yamlContent) as {
          cli?: {
            commands?: Array<{
              name: string;
              description: string;
              executor?: string;
              options?: CLIOption[];
            }>;
          };
        };

        const commands = moduleConfig.cli?.commands ?? [];
        this.logger?.debug(
          LogSource.CLI,
          `Found ${commands.length} CLI commands in ${moduleName} module`,
          { category: 'commands',
persistToDb: false },
        );

        for (const command of commands) {
          const commandPath = `${moduleName}:${command.name}`;
          // If no executor specified, assume it's in cli/{command.name}.js
          const executor = command.executor ?? `cli/${command.name.replace(':', '/')}.js`;

          // Convert source path to build path for executor
          const buildPath = moduleInfo.path.replace('/src/modules/core/', '/build/modules/core/');
          const executorPath = join(buildPath, executor);

          this.logger?.debug(
            LogSource.CLI,
            `Registering command: ${commandPath} -> ${executorPath}`,
            { category: 'commands',
persistToDb: false },
          );

          const cliCommand: CLICommand = {
            name: command.name,
            description: command.description ?? '',
            options: command.options ?? [],
          };

          await this.registerCommand(cliCommand, moduleName, executorPath);

          this.logger?.debug(LogSource.CLI, `Successfully registered command: ${commandPath}`, {
            category: 'commands',
            persistToDb: false,
          });
        }

        if (commands.length > 0) {
          this.logger?.debug(
            LogSource.CLI,
            `Registered ${commands.length} commands from module: ${moduleName}`,
            { category: 'commands',
persistToDb: false },
          );
        }
      } catch (error) {
        this.logger?.warn(LogSource.CLI, `Failed to parse commands from module ${moduleName}`, {
          category: 'commands',
          error: error as Error,
        });
      }
    }

    // Module command scanning complete (silent for CLI)
  }

  /**
   * Ensure the service is initialized.
   * @throws {Error} If service is not initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CLI service not initialized');
    }
  }
}

export { CliService as CLIService };
