/**
 * @file CLI Formatter Service - Standardized formatting for all CLI commands.
 * @module cli/services/cli-formatter
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { 
  createHeader, 
  formatCommand, 
  formatOption, 
  createSection, 
  createFooter,
  highlight
} from '@/modules/core/cli/utils/cli-formatter';

/**
 * CLI command metadata interface.
 */
export interface CLICommandMeta {
  icon?: string;
  category?: string;
  priority?: number;
}

/**
 * Extended command interface with metadata.
 */
export interface EnhancedCommand extends Command {
  meta?: CLICommandMeta;
}

/**
 * CLI Formatter Service - Provides standardized formatting for all CLI commands.
 * @class CliFormatterService
 */
export class CliFormatterService {
  private static instance: CliFormatterService;

  /**
   * Get singleton instance.
   * @returns CliFormatterService instance.
   */
  public static getInstance(): CliFormatterService {
    if (!CliFormatterService.instance) {
      CliFormatterService.instance = new CliFormatterService();
    }
    return CliFormatterService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Get icon for a command based on its name and metadata.
   * @param commandName - The command name.
   * @param meta - Optional command metadata.
   * @returns Icon string.
   */
  public getCommandIcon(commandName: string, meta?: CLICommandMeta): string {
    // Use metadata icon if provided
    if (meta?.icon) {
      return meta.icon;
    }

    // Default icon mapping
    const icons: Record<string, string> = {
      // Main commands
      'auth': '🔐',
      'database': '🗄️',
      'logger': '📋',
      'modules': '📦',
      'cli': '⚡',
      'help': '❓',
      'tasks': '📋',
      'system': '⚙️',
      'config': '🔧',
      // Database subcommands
      'clear': '🧹',
      'data': '📊',
      'migrate': '🔄',
      'query': '🔍',
      'rebuild': '🏗️',
      'rollback': '⏪',
      'schema': '📋',
      'status': '📈',
      'summary': '📄',
      'view': '👀',
      // Auth subcommands
      'login': '🚪',
      'logout': '🚶',
      'token': '🎫',
      'providers': '🔌',
      'mfa': '🔒',
      'audit': '📊',
      // Logger subcommands
      'show': '📖',
      'logs': '📜',
      // Module subcommands
      'list': '📋',
      'install': '📦',
      'remove': '🗑️',
      'enable': '✅',
      'disable': '❌',
      'info': 'ℹ️',
      // Task subcommands
      'add': '➕',
      'cancel': '❌',
      'pause': '⏸️',
      'resume': '▶️',
      'history': '📚'
    };

    return icons[commandName] || '🔧';
  }

  /**
   * Create a formatted help output for a command.
   * @param cmd - The commander command.
   * @param isMainCommand - Whether this is the main command.
   * @returns Formatted help string.
   */
  public formatHelp(cmd: Command, isMainCommand = false): string {
    const commandName = cmd.name();
    const title = isMainCommand ? 'SystemPrompt' : commandName;
    const subtitle = isMainCommand 
      ? 'An operating system for autonomous agents' 
      : cmd.description() || '';

    const header = createHeader(title, subtitle, isMainCommand);
    
    // Group commands by category if metadata is available
    const commandGroups = this.groupCommandsByCategory(cmd.commands);
    
    // Calculate the maximum command name length for consistent alignment
    const allCommands = cmd.commands.filter(subCmd => !subCmd.hidden);
    const maxCommandLength = Math.max(...allCommands.map(subCmd => subCmd.name().length));
    const paddingLength = Math.max(maxCommandLength + 2, 15); // At least 15, or longest + 2
    
    let commandsSection = '';
    for (const [category, commands] of commandGroups) {
      const categoryTitle = category === 'default' ? '🚀 Commands' : `🔧 ${category}`;
      const formattedCommands = commands
        .filter(subCmd => !subCmd.hidden)
        .map(subCmd => {
          const meta = (subCmd as EnhancedCommand).meta;
          const icon = this.getCommandIcon(subCmd.name(), meta);
          return this.formatCommandWithPadding(icon, subCmd.name(), subCmd.description() || '', paddingLength);
        })
        .join('\n');
      
      commandsSection += createSection(categoryTitle) + '\n' + formattedCommands + '\n';
    }

    const options = cmd.options
      .map(opt => formatOption(opt.flags, opt.description || ''))
      .join('\n');

    const optionsSection = options ? createSection('⚙️  Options') + '\n' + options : '';

    const footer = createFooter([
      `Run "${commandName} <command> --help" for detailed help on any command`,
      'Visit https://systemprompt.io for documentation and examples',
      'Report issues at https://github.com/systemprompt/os/issues'
    ]);

    return [
      header,
      commandsSection,
      optionsSection,
      footer
    ].filter(Boolean).join('\n');
  }

  /**
   * Format a command with consistent padding.
   * @param icon - Command icon.
   * @param name - Command name.
   * @param description - Command description.
   * @param paddingLength - Padding length for alignment.
   * @returns Formatted command string.
   */
  private formatCommandWithPadding(icon: string, name: string, description: string, paddingLength: number): string {
    const commandName = chalk.hex('#FF8C00').bold(name.padEnd(paddingLength));
    const commandDesc = chalk.gray(description);
    return `  ${icon} ${commandName} ${commandDesc}`;
  }

  /**
   * Group commands by category based on metadata.
   * @param commands - Array of commands to group.
   * @returns Map of category to commands.
   */
  private groupCommandsByCategory(commands: Command[]): Map<string, Command[]> {
    const groups = new Map<string, Command[]>();
    
    for (const cmd of commands) {
      const meta = (cmd as EnhancedCommand).meta;
      const category = meta?.category || 'default';
      
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(cmd);
    }

    // Sort commands within each category by priority, then name
    for (const [category, cmds] of groups) {
      cmds.sort((a, b) => {
        const aMeta = (a as EnhancedCommand).meta;
        const bMeta = (b as EnhancedCommand).meta;
        
        const aPriority = aMeta?.priority || 100;
        const bPriority = bMeta?.priority || 100;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        return a.name().localeCompare(b.name());
      });
    }

    return groups;
  }

  /**
   * Register metadata for a command.
   * @param cmd - The command to enhance.
   * @param meta - The metadata to attach.
   */
  public enhanceCommand(cmd: Command, meta: CLICommandMeta): void {
    (cmd as EnhancedCommand).meta = meta;
  }

  /**
   * Apply consistent styling to error messages.
   * @param message - Error message.
   * @returns Formatted error message.
   */
  public formatError(message: string): string {
    return `❌ ${message}`;
  }

  /**
   * Apply consistent styling to success messages.
   * @param message - Success message.
   * @returns Formatted success message.
   */
  public formatSuccess(message: string): string {
    return `✅ ${message}`;
  }

  /**
   * Apply consistent styling to warning messages.
   * @param message - Warning message.
   * @returns Formatted warning message.
   */
  public formatWarning(message: string): string {
    return `⚠️  ${message}`;
  }

  /**
   * Apply consistent styling to info messages.
   * @param message - Info message.
   * @returns Formatted info message.
   */
  public formatInfo(message: string): string {
    return `ℹ️  ${message}`;
  }

  /**
   * Highlight text consistently.
   * @param text - Text to highlight.
   * @returns Highlighted text.
   */
  public highlight(text: string): string {
    return highlight(text);
  }
}