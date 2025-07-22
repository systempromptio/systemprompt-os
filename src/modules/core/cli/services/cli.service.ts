/**
 * @fileoverview CLI service for command management and execution
 * @module modules/core/cli/services/cli.service
 */

import { CommandDiscovery } from '@/cli/src/discovery.js';
import {
  CLICommand,
  CLILogger,
  CommandMetadata,
  CommandDiscoveryResult,
  CLIOption
} from '@/modules/core/cli/types';
import {
  CommandNotFoundError,
  CommandExecutionError,
  CLIInitializationError,
  OutputFormattingError,
  DocumentationGenerationError
} from '@/modules/core/cli/utils/errors';

/**
 * Service for managing CLI commands and operations
 */
export class CLIService {
  private static instance: CLIService;
  private commandDiscovery: CommandDiscovery | null = null;
  private logger: CLILogger | null = null;
  private initialized = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of CLIService
   * @returns The CLIService instance
   */
  public static getInstance(): CLIService {
    if (!CLIService.instance) {
      CLIService.instance = new CLIService();
    }
    return CLIService.instance;
  }

  /**
   * Initialize the CLI service
   * @param logger - Logger instance
   * @throws {CLIInitializationError} If initialization fails
   */
  public async initialize(logger: CLILogger): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger = logger;
      this.commandDiscovery = new CommandDiscovery();
      this.initialized = true;
      this.logger.info('CLI service initialized');
    } catch (error) {
      throw new CLIInitializationError(error as Error);
    }
  }

  /**
   * Check if service is initialized
   * @returns Whether the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get all available commands
   * @returns Map of command names to command definitions
   * @throws {CommandDiscoveryError} If command discovery fails
   */
  public async getAllCommands(): Promise<Map<string, CLICommand>> {
    this.ensureInitialized();

    if (!this.commandDiscovery) {
      this.commandDiscovery = new CommandDiscovery();
    }

    return await this.commandDiscovery.discoverCommands();
  }

  /**
   * Get metadata for all commands
   * @returns Array of command metadata
   */
  public async getCommandMetadata(): Promise<CommandMetadata[]> {
    const commands = await this.getAllCommands();
    const metadata: CommandMetadata[] = [];

    commands.forEach((command, name) => {
      const parts = name.split(':');
      const module = parts.length > 1 ? parts[0] : 'core';
      const commandName = parts.length > 1 ? parts.slice(1).join(':') : name;

      metadata.push({
        name,
        module,
        commandName,
        description: command.description || 'No description available',
        usage: `systemprompt ${name}`,
        options: command.options || [],
        positionals: command.positionals
      });
    });

    return metadata;
  }

  /**
   * Get help text for a specific command
   * @param commandName - Name of the command
   * @returns Help text for the command
   * @throws {CommandNotFoundError} If command is not found
   */
  public async getCommandHelp(commandName: string): Promise<string> {
    const commands = await this.getAllCommands();
    const command = commands.get(commandName);

    if (!command) {
      throw new CommandNotFoundError(commandName);
    }

    let help = `\nCommand: ${commandName}\n`;
    help += `Description: ${command.description || 'No description available'}\n`;

    if (command.positionals && command.positionals.length > 0) {
      help += '\nPositional Arguments:\n';
      command.positionals.forEach(pos => {
        const requiredText = pos.required ? ' [required]' : ' [optional]';
        help += `  ${pos.name}${requiredText}\n`;
        help += `    ${pos.description}\n`;
        if (pos.default !== undefined) {
          help += `    Default: ${pos.default}\n`;
        }
      });
    }

    if (command.options && command.options.length > 0) {
      help += '\nOptions:\n';
      command.options.forEach((opt: CLIOption) => {
        const aliasText = opt.alias ? `, -${opt.alias}` : '';
        const defaultText = opt.default !== undefined ? ` (default: ${opt.default})` : '';
        const requiredText = opt.required ? ' [required]' : '';
        help += `  --${opt.name}${aliasText}\n`;
        help += `    ${opt.description}${defaultText}${requiredText}\n`;
        if (opt.choices) {
          help += `    Choices: ${opt.choices.join(', ')}\n`;
        }
      });
    }

    if (command.examples && command.examples.length > 0) {
      help += '\nExamples:\n';
      command.examples.forEach(example => {
        help += `  ${example}\n`;
      });
    }

    return help;
  }

  /**
   * Format commands for display
   * @param format - Output format ('text', 'json', or 'table')
   * @returns Formatted command list
   * @throws {OutputFormattingError} If formatting fails
   */
  public async formatCommands(format: string = 'text'): Promise<string> {
    try {
      const commands = await this.getAllCommands();

      if (format === 'json') {
        const metadata = await this.getCommandMetadata();
        return JSON.stringify(metadata, null, 2);
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
      const sortedModules = Array.from(modules.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );

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
    } catch (error) {
      throw new OutputFormattingError(format, error as Error);
    }
  }

  /**
   * Generate documentation for all commands
   * @param format - Documentation format ('markdown', 'html', or 'json')
   * @returns Generated documentation
   * @throws {DocumentationGenerationError} If generation fails
   */
  public async generateDocs(format: string = 'markdown'): Promise<string> {
    try {
      const commands = await this.getAllCommands();

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

                if (cmd.positionals && cmd.positionals.length > 0) {
                  doc += '**Positional Arguments:**\n\n';
                  cmd.positionals.forEach((pos: any) => {
                    const requiredText = pos.required ? ' **[required]**' : '';
                    const defaultText = pos.default !== undefined ? ` (default: ${pos.default})` : '';
                    doc += `- \`${pos.name}\`: ${pos.description}${defaultText}${requiredText}\n`;
                  });
                  doc += '\n';
                }

                if (cmd.options && cmd.options.length > 0) {
                  doc += '**Options:**\n\n';
                  cmd.options.forEach((opt: any) => {
                    const aliasText = opt.alias ? `, -${opt.alias}` : '';
                    const defaultText = opt.default !== undefined ? ` (default: ${opt.default})` : '';
                    const requiredText = opt.required ? ' **[required]**' : '';
                    doc += `- \`--${opt.name}${aliasText}\`: ${opt.description}${defaultText}${requiredText}\n`;
                    if (opt.choices) {
                      doc += `  - Choices: ${opt.choices.join(', ')}\n`;
                    }
                  });
                  doc += '\n';
                }

                if (cmd.examples && cmd.examples.length > 0) {
                  doc += '**Examples:**\n\n';
                  cmd.examples.forEach((example: string) => {
                    doc += `\`\`\`bash\n${example}\n\`\`\`\n\n`;
                  });
                }
              });
          });

        return doc;
      }

      // For other formats, return JSON for now
      const metadata = await this.getCommandMetadata();
      return JSON.stringify(metadata, null, 2);
    } catch (error) {
      throw new DocumentationGenerationError(format, error as Error);
    }
  }

  /**
   * Ensure service is initialized
   * @throws {Error} If service is not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CLI service not initialized. Call initialize() first.');
    }
  }
}