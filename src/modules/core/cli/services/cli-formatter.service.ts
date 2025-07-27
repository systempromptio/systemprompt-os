/**
 * @file CLI Formatter Service - Standardized formatting for all CLI commands.
 * @module cli/services/cli-formatter
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { 
  createFooter, 
  createHeader, 
  createSection, 
  highlight
} from '@/modules/core/cli/utils/cli-formatter';
import type { 
  SystemPromptSpinner
} from '@/modules/core/cli/utils/spinner';
import { 
  SPINNER_PRESETS, 
  createProgressSpinner, 
  createSpinner,
  withSpinner 
} from '@/modules/core/cli/utils/spinner';

/**
 * CLI command metadata interface.
 */
export interface ICLICommandMeta {
  icon?: string;
  category?: string;
  priority?: number;
}

/**
 * Extended command interface with metadata.
 */
export interface IEnhancedCommand extends Command {
  meta?: ICLICommandMeta;
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
    CliFormatterService.instance ||= new CliFormatterService();
    return CliFormatterService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    /**
     * Singleton pattern requires empty constructor.
     */
  }

  /**
   * Get icon for a command based on its name and metadata.
   * @param commandName - The command name.
   * @param meta - Optional command metadata.
   * @returns Icon string.
   */
  public getCommandIcon(commandName: string, meta?: ICLICommandMeta): string {
    /**
     * Use metadata icon if provided.
     */
    if (meta?.icon) {
      return meta.icon;
    }

    /**
     * Default icon mapping.
     */
    const icons: Record<string, string> = {
      /**
       * Main commands.
       */
      auth: '🔐',
      database: '🗄️',
      logger: '📋',
      modules: '📦',
      cli: '⚡',
      help: '❓',
      tasks: '📋',
      system: '⚙️',
      config: '🔧',
      /**
       * Database subcommands.
       */
      clear: '🧹',
      information: '📊',
      migrate: '🔄',
      query: '🔍',
      rebuild: '🏗️',
      rollback: '⏪',
      schema: '📋',
      status: '📈',
      summary: '📄',
      view: '👀',
      /**
       * Auth subcommands.
       */
      login: '🚪',
      logout: '🚶',
      token: '🎫',
      providers: '🔌',
      mfa: '🔒',
      audit: '📊',
      /**
       * Logger subcommands.
       */
      show: '📖',
      logs: '📜',
      /**
       * Module subcommands.
       */
      list: '📋',
      install: '📦',
      remove: '🗑️',
      enable: '✅',
      disable: '❌',
      info: 'ℹ️',
      /**
       * Task subcommands.
       */
      add: '➕',
      cancel: '❌',
      pause: '⏸️',
      resume: '▶️',
      history: '📚'
    };

    return icons[commandName] ?? '🔧';
  }

  /**
   * Check if a command is hidden.
   * @param cmd - The command to check.
   * @returns True if the command is hidden.
   */
  private isHiddenCommand(cmd: Command): boolean {
    return Boolean((cmd as unknown as { hidden?: boolean }).hidden);
  }

  /**
   * Create a formatted help output for a command.
   * @param cmd - The commander command.
   * @param isMainCommand - Whether this is the main command.
   * @returns Formatted help string.
   */
  public formatHelp(cmd: Command, isMainCommand = false): string {
    const { header, commandsSection, optionsSection } = this.buildHelpSections(cmd, isMainCommand);
    const footer = this.buildFooter(cmd.name());

    return [
      header,
      commandsSection,
      optionsSection,
      footer
    ].filter(Boolean).join('\n');
  }

  /**
   * Build help sections for a command.
   * @param cmd - The commander command.
   * @param isMainCommand - Whether this is the main command.
   * @returns Object containing header, commands section, and options section.
   */
  private buildHelpSections(cmd: Command, isMainCommand: boolean): {
    header: string;
    commandsSection: string;
    optionsSection: string;
  } {
    const title = isMainCommand ? 'SystemPrompt' : cmd.name();
    const subtitle = isMainCommand 
      ? 'An operating system for autonomous agents' 
      : cmd.description() || '';

    const header = createHeader(title, subtitle, isMainCommand);
    const paddingLength = this.calculatePaddingLength(cmd);
    const commandsSection = this.buildCommandsSection(cmd, paddingLength);
    const optionsSection = this.buildOptionsSection(cmd, paddingLength);

    return { header,
commandsSection,
optionsSection };
  }

  /**
   * Calculate padding length for alignment.
   * @param cmd - The command to calculate padding for.
   * @returns Padding length.
   */
  private calculatePaddingLength(cmd: Command): number {
    const allCommands = cmd.commands.filter((subCmd: Command): boolean => !this.isHiddenCommand(subCmd));
    const maxCommandLength = allCommands.length > 0 
      ? Math.max(...allCommands.map((subCmd): number => subCmd.name().length))
      : 0;
    const maxOptionLength = cmd.options.length > 0
      ? Math.max(...cmd.options.map((opt): number => opt.flags.length))
      : 0;
    return Math.max(maxCommandLength + 2, maxOptionLength + 2, 15);
  }

  /**
   * Build commands section for help output.
   * @param cmd - The commander command.
   * @param paddingLength - Padding length for alignment.
   * @returns Formatted commands section.
   */
  private buildCommandsSection(cmd: Command, paddingLength: number): string {
    const commandGroups = this.groupCommandsByCategory(cmd.commands);
    let commandsSection = '';
    
    for (const [category, commands] of Array.from(commandGroups.entries())) {
      const categoryTitle = category === 'default' ? '🚀 Commands' : `🔧 ${category}`;
      const formattedCommands = commands
        .filter((subCmd: Command): boolean => !this.isHiddenCommand(subCmd))
        .map((subCmd: Command): string => {
          const meta = (subCmd as IEnhancedCommand).meta;
          const icon = this.getCommandIcon(subCmd.name(), meta);
          return this.formatCommandWithPadding({
            icon,
            name: subCmd.name(),
            description: subCmd.description() || '',
            paddingLength
          });
        })
        .join('\n');
      
      commandsSection += `${createSection(categoryTitle)}\n${formattedCommands}\n`;
    }
    
    return commandsSection;
  }

  /**
   * Build options section for help output.
   * @param cmd - The commander command.
   * @param paddingLength - Padding length for alignment.
   * @returns Formatted options section or empty string.
   */
  private buildOptionsSection(cmd: Command, paddingLength: number): string {
    const options = cmd.options
      .map((opt): string => this.formatOptionWithPadding(opt.flags, opt.description || '', paddingLength))
      .join('\n');

    return options ? `${createSection('⚙️  Options')}\n${options}` : '';
  }

  /**
   * Build footer for help output.
   * @param commandName - Name of the command.
   * @returns Formatted footer.
   */
  private buildFooter(commandName: string): string {
    return createFooter([
      `Run "${commandName} <command> --help" for detailed help on any command`,
      'Visit https://systemprompt.io for documentation and examples',
      'Report issues at https://github.com/systemprompt/os/issues'
    ]);
  }

  /**
   * Format command with padding configuration.
   * @param config - Configuration object for command formatting.
   * @param config.icon
   * @param config.name
   * @param config.description
   * @param config.paddingLength
   * @returns Formatted command string.
   */
  private formatCommandWithPadding(config: {
    icon: string;
    name: string;
    description: string;
    paddingLength: number;
  }): string {
    const { icon, name, description, paddingLength } = config;
    const commandName = chalk.hex('#FF8C00').bold(name.padEnd(paddingLength));
    const commandDesc = chalk.gray(description);
    return `  ${icon} ${commandName} ${commandDesc}`;
  }

  /**
   * Format an option with consistent padding.
   * @param flags - Option flags.
   * @param description - Option description.
   * @param paddingLength - Padding length for alignment.
   * @returns Formatted option string.
   */
  private formatOptionWithPadding(flags: string, description: string, paddingLength: number): string {
    const optionFlags = chalk.yellow(flags.padEnd(paddingLength));
    const optionDesc = chalk.gray(description);
    return `  ${optionFlags} ${optionDesc}`;
  }

  /**
   * Group commands by category based on metadata.
   * @param commands - Array of commands to group.
   * @returns Map of category to commands.
   */
  private groupCommandsByCategory(commands: readonly Command[]): Map<string, Command[]> {
    const groups = new Map<string, Command[]>();
    
    for (const cmd of commands) {
      const meta = (cmd as IEnhancedCommand).meta;
      const category = meta?.category ?? 'default';
      
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      const categoryCommands = groups.get(category);
      if (categoryCommands) {
        categoryCommands.push(cmd);
      }
    }

    /**
     * Sort commands within each category by priority, then name.
     */
    for (const [, cmds] of Array.from(groups.entries())) {
      cmds.sort((a: Command, b: Command): number => {
        const aMeta = (a as IEnhancedCommand).meta;
        const bMeta = (b as IEnhancedCommand).meta;
        
        const aPriority = aMeta?.priority ?? 100;
        const bPriority = bMeta?.priority ?? 100;
        
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
  public enhanceCommand(cmd: Command, meta: ICLICommandMeta): void {
    const enhancedCmd = cmd as IEnhancedCommand;
    enhancedCmd.meta = meta;
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

  /**
   * Create a spinner with SystemPrompt branding.
   * @param preset - Spinner preset name.
   * @param text - Optional custom text.
   * @returns New SystemPromptSpinner instance.
   */
  public createSpinner(preset: keyof typeof SPINNER_PRESETS = 'loading', text?: string): SystemPromptSpinner {
    return createSpinner(preset, text);
  }

  /**
   * Execute a function with a spinner.
   * @param config - Spinner configuration.
   * @param config.fn
   * @param config.text
   * @param config.preset
   * @param config.successText
   * @param config.errorText
   * @returns Promise with the function result.
   */
  public async withSpinner<T>(config: {
    fn: () => Promise<T>;
    text?: string;
    preset?: keyof typeof SPINNER_PRESETS;
    successText?: string;
    errorText?: string;
  }): Promise<T> {
    const {
      fn,
      text = 'Loading...',
      preset = 'loading',
      successText,
      errorText
    } = config;
    const spinnerConfig = { ...SPINNER_PRESETS[preset],
text };
    const options: { successText?: string; errorText?: string } = {};
    if (successText !== undefined) {
      options.successText = successText;
    }
    if (errorText !== undefined) {
      options.errorText = errorText;
    }
    return await withSpinner(fn, spinnerConfig, options);
  }

  /**
   * Create a progress spinner for multi-step operations.
   * @param steps - Array of step descriptions.
   * @param preset - Spinner preset.
   * @returns New ProgressSpinner instance.
   */
  public createProgressSpinner(steps: string[], preset: keyof typeof SPINNER_PRESETS = 'loading'): ReturnType<typeof createProgressSpinner> {
    const config = SPINNER_PRESETS[preset];
    return createProgressSpinner(steps, config);
  }
}
