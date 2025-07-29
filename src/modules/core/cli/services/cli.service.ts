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
} from '@/modules/core/cli/types/index';
import type {
  ICliCommandAliasesRow,
  ICliCommandOptionsRow,
  ICliCommandsRow,
} from '@/modules/core/cli/types/database.generated';
import { CLI_TABLES } from '@/modules/core/cli/types/database.generated';
import {
  CliInitializationError,
  CommandNotFoundError,
  DocumentationGenerationError,
  OutputFormattingError,
} from '@/modules/core/cli/utils/errors';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';

/**
 * Complete command with options and aliases loaded from normalized tables.
 */
interface ICompleteCommand extends ICliCommandsRow {
  options: CLIOption[];
  aliases: string[];
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
  public initialize(logger: CLILogger, database: DatabaseService): void {
    if (this.initialized) {
      return;
    }

    try {
      this.logger = logger;
      this.database = database;

      /**
       * Database schema is handled by the global database service via schema discovery.
       */

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
        description: cmd.description || '',
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

    // Insert the main command record
    await this.database.execute(
      `INSERT OR REPLACE INTO ${CLI_TABLES.CLICOMMANDS}
       (command_path, command_name, description, module_name, executor_path, active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        commandPath,
        command.name ?? 'unknown',
        command.description,
        moduleName,
        executorPath,
        1,
      ],
    );

    // Get the command ID (for INSERT OR REPLACE, we need to query it)
    const commandRecord = await this.database.query<ICliCommandsRow>(
      `SELECT id FROM ${CLI_TABLES.CLICOMMANDS} WHERE command_path = ?`,
      [commandPath],
    );

    if (commandRecord.length === 0) {
      throw new Error(`Failed to retrieve command ID for ${commandPath}`);
    }

    const commandId = commandRecord[0]?.id;
    if (!commandId) {
      throw new Error(`Failed to retrieve command ID for ${commandPath}`);
    }

    // Clear existing options and aliases for this command
    await this.database.execute(
      `DELETE FROM ${CLI_TABLES.CLICOMMANDOPTIONS} WHERE command_id = ?`,
      [commandId],
    );
    await this.database.execute(
      `DELETE FROM ${CLI_TABLES.CLICOMMANDALIASES} WHERE command_id = ?`,
      [commandId],
    );

    // Insert options
    if (command.options && command.options.length > 0) {
      for (const option of command.options) {
        await this.database.execute(
          `INSERT INTO ${CLI_TABLES.CLICOMMANDOPTIONS}
           (command_id, option_name, option_type, description, alias, default_value, required, choices)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            commandId,
            option.name,
            option.type,
            option.description,
            option.alias || null,
            option.default ? String(option.default) : null,
            option.required ? 1 : 0,
            option.choices ? option.choices.join(',') : null,
          ],
        );
      }
    }

    // Insert aliases
    if (command.aliases && command.aliases.length > 0) {
      for (const alias of command.aliases) {
        await this.database.execute(
          `INSERT INTO ${CLI_TABLES.CLICOMMANDALIASES}
           (command_id, alias)
           VALUES (?, ?)`,
          [commandId, alias],
        );
      }
    }
  }

  /**
   * Get commands from database with options and aliases.
   * @returns Array of complete commands.
   */
  public async getCommandsFromDatabase(): Promise<ICompleteCommand[]> {
    if (this.database === null || this.database === undefined) {
      throw new Error('Database not initialized');
    }

    const commands = await this.database.query<ICliCommandsRow>(
      `SELECT * FROM ${CLI_TABLES.CLICOMMANDS} WHERE active = 1 ORDER BY command_path`,
    );

    const result: ICompleteCommand[] = [];

    for (const command of commands) {
      const options = await this.getCommandOptions(command.id);
      const aliases = await this.getCommandAliases(command.id);
      
      result.push({
        ...command,
        options,
        aliases,
      });
    }

    return result;
  }

  /**
   * Get options for a specific command.
   * @param commandId - ID of the command.
   * @returns Array of CLI options.
   */
  private async getCommandOptions(commandId: number): Promise<CLIOption[]> {
    if (this.database === null || this.database === undefined) {
      throw new Error('Database not initialized');
    }

    const options = await this.database.query<ICliCommandOptionsRow>(
      `SELECT * FROM ${CLI_TABLES.CLICOMMANDOPTIONS} WHERE command_id = ? ORDER BY option_name`,
      [commandId],
    );

    return options.map((opt): CLIOption => {
      const cliOption: CLIOption = {
        name: opt.option_name,
        type: opt.option_type as 'string' | 'boolean' | 'number' | 'array',
        description: opt.description,
        required: opt.required ?? false,
      };
      
      if (opt.alias) {
        cliOption.alias = opt.alias;
      }
      
      if (opt.default_value) {
        cliOption.default = opt.default_value;
      }
      
      if (opt.choices) {
        cliOption.choices = opt.choices.split(',').map(c => c.trim());
      }
      
      return cliOption;
    });
  }

  /**
   * Get aliases for a specific command.
   * @param commandId - ID of the command.
   * @returns Array of alias strings.
   */
  private async getCommandAliases(commandId: number): Promise<string[]> {
    if (this.database === null || this.database === undefined) {
      throw new Error('Database not initialized');
    }

    const aliases = await this.database.query<ICliCommandAliasesRow>(
      `SELECT * FROM ${CLI_TABLES.CLICOMMANDALIASES} WHERE command_id = ? ORDER BY alias`,
      [commandId],
    );

    return aliases.map(a => a.alias);
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

    // Delete from child tables first (foreign key constraints)
    await this.database.execute(`DELETE FROM ${CLI_TABLES.CLICOMMANDOPTIONS}`);
    await this.database.execute(`DELETE FROM ${CLI_TABLES.CLICOMMANDALIASES}`);
    await this.database.execute(`DELETE FROM ${CLI_TABLES.CLICOMMANDS}`);
  }

  /**
   * Scan modules and register their CLI commands from module.yaml files.
   * @param modules - Map of loaded modules with their paths.
   * @returns Promise that resolves when all commands are registered.
   */
  public async scanAndRegisterModuleCommands(
    modules: Map<string, { path: string }>,
  ): Promise<void> {
    /**
     * Clear existing commands first to ensure clean state.
     */
    await this.clearAllCommands();

    this.logger?.debug(LogSource.CLI, `Scanning ${String(modules.size)} modules for CLI commands`, {
      category: 'commands',
      persistToDb: false,
    });

    const moduleEntries = Array.from(modules.entries());
    const validModules = moduleEntries.filter(([moduleName, moduleInfo]) => {
      return this.validateModuleYaml(moduleName, moduleInfo.path);
    });

    await Promise.all(
      validModules.map(async ([moduleName, moduleInfo]) => {
        await this.processModuleCommands(moduleName, moduleInfo.path);
      }),
    );

    /**
     * Module command scanning complete (silent for CLI).
     */
  }

  /**
   * Validate if a module has a valid module.yaml file.
   * @param moduleName - Name of the module.
   * @param modulePath - Path to the module.
   * @returns Whether the module has a valid YAML file.
   */
  private validateModuleYaml(moduleName: string, modulePath: string): boolean {
    const yamlPath = join(modulePath, 'module.yaml');
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
      return false;
    }
    return true;
  }

  /**
   * Process commands for a single module.
   * @param moduleName - Name of the module.
   * @param modulePath - Path to the module.
   */
  private async processModuleCommands(moduleName: string, modulePath: string): Promise<void> {
    try {
      const commands = this.parseModuleCommands(moduleName, modulePath);
      await this.registerModuleCommands(moduleName, modulePath, commands);
    } catch (error) {
      this.logger?.warn(LogSource.CLI, `Failed to parse commands from module ${moduleName}`, {
        category: 'commands',
        error: error as Error,
      });
    }
  }

  /**
   * Parse commands from a module's YAML file.
   * @param moduleName - Name of the module.
   * @param modulePath - Path to the module.
   * @returns Array of parsed commands.
   */
  private parseModuleCommands(
    moduleName: string,
    modulePath: string,
  ): Array<{
    name: string;
    description: string;
    executor?: string;
    options?: CLIOption[];
  }> {
    const yamlPath = join(modulePath, 'module.yaml');
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
      `Found ${String(commands.length)} CLI commands in ${moduleName} module`,
      { category: 'commands',
persistToDb: false },
    );

    return commands;
  }

  /**
   * Register commands for a module.
   * @param moduleName - Name of the module.
   * @param modulePath - Path to the module.
   * @param commands - Array of commands to register.
   */
  private async registerModuleCommands(
    moduleName: string,
    modulePath: string,
    commands: Array<{
      name: string;
      description: string;
      executor?: string;
      options?: CLIOption[];
    }>,
  ): Promise<void> {
    for (const command of commands) {
      await this.registerSingleCommand(moduleName, modulePath, command);
    }

    if (commands.length > 0) {
      this.logger?.debug(
        LogSource.CLI,
        `Registered ${String(commands.length)} commands from module: ${moduleName}`,
        { category: 'commands',
persistToDb: false },
      );
    }
  }

  /**
   * Register a single command.
   * @param moduleName - Name of the module.
   * @param modulePath - Path to the module.
   * @param command - Command configuration to register.
   * @param command.name
   * @param command.description
   * @param command.executor
   * @param command.options
   */
  private async registerSingleCommand(
    moduleName: string,
    modulePath: string,
    command: {
      name: string;
      description: string;
      executor?: string;
      options?: CLIOption[];
    },
  ): Promise<void> {
    const commandPath = `${moduleName}:${command.name}`;
    /**
     * If no executor specified, assume it's in cli/{command.name}.js.
     */
    const executor = command.executor ?? `cli/${command.name.replace(':', '/')}.js`;
    /**
     * Use source path directly with tsx.
     */
    const executorPath = join(modulePath, executor.replace('.js', '.ts'));

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
