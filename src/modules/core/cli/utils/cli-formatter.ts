/**
 * @file CLI formatting utilities for beautiful output.
 * @module cli/utils/cli-formatter
 */

import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';

/**
 * Create a beautiful header for the CLI.
 * @param title - The main title.
 * @param subtitle - Optional subtitle.
 * @param isMainCommand - Whether this is the main command (affects styling).
 * @returns Formatted header string.
 */
export const createHeader = (title: string, subtitle?: string, isMainCommand = true): string => {
  if (!isMainCommand) {
    /**
     * Simpler header for subcommands.
     */
    const simpleTitle = gradient(['orange', 'red'])(title.toUpperCase());
    const headerContent = [
      simpleTitle,
      subtitle ? chalk.gray(subtitle) : ''
    ].filter(Boolean).join('\n');

    return boxen(headerContent, {
      padding: { top: 0,
bottom: 0,
left: 2,
right: 2 },
      margin: { top: 1,
bottom: 0,
left: 0,
right: 0 },
      borderStyle: 'round',
      borderColor: 'yellow'
    });
  }

  /**
   * Single line orange title using lowercase and bold.
   */
  const orangeTitle = gradient(['orange', 'red'])(
    figlet.textSync(title.toLowerCase(), { 
      font: 'Big',
      horizontalLayout: 'fitted',
      width: 100
    })
  );
  
  const headerContent = [
    orangeTitle,
    subtitle ? chalk.gray(subtitle) : ''
  ].filter(Boolean).join('\n');

  return boxen(headerContent, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'yellow',
    backgroundColor: 'black',
    /**
     * Set consistent width for main header.
     */
    width: 91
  });
};

/**
 * Format a command section with icon and description.
 * @param icon - Emoji or symbol for the command.
 * @param name - Command name.
 * @param description - Command description.
 * @returns Formatted command string.
 */
export const formatCommand = (icon: string, name: string, description: string): string => {
  /**
   * Orange color for commands.
   */
  const commandName = chalk.hex('#FF8C00').bold(name.padEnd(15));
  const commandDesc = chalk.gray(description);
  return `  ${icon} ${commandName} ${commandDesc}`;
};

/**
 * Format an option with color coding.
 * @param flags - Option flags (e.g., "-h, --help").
 * @param description - Option description.
 * @returns Formatted option string.
 */
export const formatOption = (flags: string, description: string): string => {
  const optionFlags = chalk.yellow(flags.padEnd(20));
  const optionDesc = chalk.gray(description);
  return `  ${optionFlags} ${optionDesc}`;
};

/**
 * Create a section divider.
 * @param title - Section title.
 * @param width - Optional width for the divider (default: 93 to match header box width).
 * @returns Formatted section divider.
 */
export const createSection = (title: string, width: number = 93): string => {
  const line = '─'.repeat(width);
  const sectionTitle = chalk.magenta.bold(title);
  return `\n${chalk.gray(line)}\n${sectionTitle}\n${chalk.gray(line)}`;
};

/**
 * Create a footer with additional information.
 * @param items - Footer items to display.
 * @returns Formatted footer string.
 */
export const createFooter = (items: string[]): string => {
  const footerContent = items.map((item: string): string => chalk.dim(`• ${item}`)).join('\n');
  
  return boxen(footerContent, {
    padding: { top: 0,
bottom: 0,
left: 2,
right: 2 },
    margin: { top: 1,
bottom: 0,
left: 0,
right: 0 },
    borderStyle: 'single',
    borderColor: 'gray',
    dimBorder: true,
    /**
     * Set consistent width to match header.
     */
    width: 93
  });
};

/**
 * Highlight important text.
 * @param text - Text to highlight.
 * @returns Highlighted text.
 */
export const highlight = (text: string): string => {
  return chalk.cyan.bold(text);
};

/**
 * Format success message.
 * @param message - Success message.
 * @returns Formatted success message.
 */
export const success = (message: string): string => {
  return chalk.green(`✅ ${message}`);
};

/**
 * Format error message.
 * @param message - Error message.
 * @returns Formatted error message.
 */
export const error = (message: string): string => {
  return chalk.red(`❌ ${message}`);
};

/**
 * Format warning message.
 * @param message - Warning message.
 * @returns Formatted warning message.
 */
export const warning = (message: string): string => {
  return chalk.yellow(`⚠️  ${message}`);
};

/**
 * Format info message.
 * @param message - Info message.
 * @returns Formatted info message.
 */
export const info = (message: string): string => {
  return chalk.blue(`ℹ️  ${message}`);
};
