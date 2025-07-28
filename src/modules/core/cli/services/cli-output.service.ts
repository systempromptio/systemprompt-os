/**
 * @file CLI Output Service - Standardized output formatting for CLI commands.
 * @module cli/services/cli-output
 */

import chalk from 'chalk';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';

/**
 * Output format types.
 */
export type OutputFormat = 'text' | 'json' | 'table' | 'csv';

/**
 * Table column definition.
 */
export interface ITableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: unknown) => string;
}

/**
 * Output options.
 */
export interface IOutputOptions {
  format?: OutputFormat;
  noHeaders?: boolean;
  delimiter?: string;
  indent?: number;
}

/**
 * CLI Output Service - Provides consistent output formatting for all CLI commands.
 * This service handles the presentation layer for CLI commands, ensuring that
 * all output follows consistent patterns and respects the user's format preferences.
 */
export class CliOutputService {
  private static instance: CliOutputService;
  private readonly formatter: CliFormatterService;

  /**
   * Get singleton instance.
   * @returns CliOutputService instance.
   */
  public static getInstance(): CliOutputService {
    CliOutputService.instance ||= new CliOutputService();
    return CliOutputService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.formatter = CliFormatterService.getInstance();
  }

  /**
   * Output data in the specified format.
   * @param data - Data to output.
   * @param options - Output options.
   */
  public output(data: unknown, options: IOutputOptions = {}): void {
    const { format = 'text' } = options;

    switch (format) {
      case 'json':
        this.outputJson(data, options);
        break;
      case 'table':
        if (Array.isArray(data)) {
          this.outputTable(data, [], options);
        } else {
          this.outputText(data, options);
        }
        break;
      case 'csv':
        if (Array.isArray(data)) {
          this.outputCsv(data, options);
        } else {
          this.outputText(data, options);
        }
        break;
      default:
        this.outputText(data, options);
    }
  }

  /**
   * Output success message.
   * @param message - Success message.
   */
  public success(message: string): void {
    console.log(this.formatter.formatSuccess(message));
  }

  /**
   * Output error message.
   * @param message - Error message.
   */
  public error(message: string): void {
    console.error(this.formatter.formatError(message));
  }

  /**
   * Output warning message.
   * @param message - Warning message.
   */
  public warning(message: string): void {
    console.warn(this.formatter.formatWarning(message));
  }

  /**
   * Output info message.
   * @param message - Info message.
   */
  public info(message: string): void {
    console.log(this.formatter.formatInfo(message));
  }

  /**
   * Output a section header.
   * @param title - Section title.
   * @param subtitle - Optional subtitle.
   */
  public section(title: string, subtitle?: string): void {
    console.log('');
    console.log(chalk.bold(title));
    if (subtitle) {
      console.log(chalk.gray(subtitle));
    }
    console.log(chalk.gray('─'.repeat(Math.max(title.length, subtitle?.length ?? 0))));
  }

  /**
   * Output a table with proper formatting.
   * @param data - Array of data objects.
   * @param columns - Column definitions.
   * @param options - Output options.
   */
  public table(data: unknown[], columns: ITableColumn[], options: IOutputOptions = {}): void {
    if (options.format === 'json') {
      this.outputJson(data, options);
      return;
    }

    if (options.format === 'csv') {
      this.outputCsv(data, options);
      return;
    }

    this.outputTable(data, columns, options);
  }

  /**
   * Output key-value pairs.
   * @param data - Object with key-value pairs.
   * @param options - Output options.
   */
  public keyValue(data: Record<string, unknown>, options: IOutputOptions = {}): void {
    if (options.format === 'json') {
      this.outputJson(data, options);
      return;
    }

    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
    
    Object.entries(data).forEach(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength);
      const formattedValue = this.formatValue(value);
      console.log(`  ${chalk.gray(paddedKey)} : ${formattedValue}`);
    });
  }

  /**
   * Output a list of items.
   * @param items - Array of items.
   * @param options - Output options.
   */
  public list(items: string[], options: IOutputOptions = {}): void {
    if (options.format === 'json') {
      this.outputJson(items, options);
      return;
    }

    items.forEach(item => {
      console.log(`  • ${item}`);
    });
  }

  /**
   * Output data in JSON format.
   * @param data - Data to output as JSON.
   * @param indent - Number of spaces for indentation (default: 2).
   */
  public json(data: unknown, indent = 2): void {
    this.outputJson(data, { indent });
  }

  /**
   * Output JSON formatted data.
   * @param data - Data to output.
   * @param options - Output options.
   */
  private outputJson(data: unknown, options: IOutputOptions): void {
    const { indent = 2 } = options;
    console.log(JSON.stringify(data, null, indent));
  }

  /**
   * Output table formatted data.
   * @param data - Array of data objects.
   * @param columns - Column definitions.
   * @param options - Output options.
   */
  private outputTable(data: unknown[], columns: ITableColumn[], options: IOutputOptions): void {
    if (data.length === 0) {
      console.log('No data to display.');
      return;
    }

    // Auto-detect columns if not provided
    if (columns.length === 0) {
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        columns = Object.keys(firstItem).map(key => ({
          key,
          header: this.humanizeKey(key)
        }));
      }
    }

    // Calculate column widths
    const columnWidths = this.calculateColumnWidths(data, columns);

    // Output headers
    if (!options.noHeaders) {
      const headerLine = columns.map((col, i) => {
        const width = columnWidths[i] ?? 10;
        return this.alignText(col.header, width, col.align);
      }).join(' | ');

      console.log(headerLine);
      console.log('─'.repeat(headerLine.length));
    }

    // Output rows
    data.forEach(row => {
      const rowLine = columns.map((col, i) => {
        const width = columnWidths[i] ?? 10;
        const value = this.getNestedValue(row, col.key);
        const formatted = col.format ? col.format(value) : this.formatValue(value);
        return this.alignText(formatted, width, col.align);
      }).join(' | ');

      console.log(rowLine);
    });
  }

  /**
   * Output CSV formatted data.
   * @param data - Array of data objects.
   * @param options - Output options.
   */
  private outputCsv(data: unknown[], options: IOutputOptions): void {
    const { delimiter = ',', noHeaders = false } = options;

    if (data.length === 0) {
      return;
    }

    const firstItem = data[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return;
    }

    const keys = Object.keys(firstItem);

    // Output headers
    if (!noHeaders) {
      console.log(keys.join(delimiter));
    }

    // Output rows
    data.forEach(row => {
      const values = keys.map(key => {
        const value = this.getNestedValue(row, key);
        return this.escapeCsvValue(String(value ?? ''), delimiter);
      });
      console.log(values.join(delimiter));
    });
  }

  /**
   * Output text formatted data.
   * @param data - Data to output.
   * @param options - Output options.
   */
  private outputText(data: unknown, options: IOutputOptions): void {
    if (typeof data === 'string') {
      console.log(data);
    } else if (typeof data === 'object' && data !== null) {
      this.outputJson(data, { ...options,
indent: 2 });
    } else {
      console.log(String(data));
    }
  }

  /**
   * Calculate column widths based on data.
   * @param data - Array of data objects.
   * @param columns - Column definitions.
   * @returns Array of column widths.
   */
  private calculateColumnWidths(data: unknown[], columns: ITableColumn[]): number[] {
    return columns.map(col => {
      if (col.width) {
        return col.width;
      }

      const headerWidth = col.header.length;
      const maxDataWidth = Math.max(...data.map(row => {
        const value = this.getNestedValue(row, col.key);
        const formatted = col.format ? col.format(value) : this.formatValue(value);
        return formatted.length;
      }));

      return Math.max(headerWidth, maxDataWidth, 10);
    });
  }

  /**
   * Align text within a given width.
   * @param text - Text to align.
   * @param width - Target width.
   * @param align - Alignment type.
   * @returns Aligned text.
   */
  private alignText(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
    const truncated = text.slice(0, width);
    
    switch (align) {
      case 'right':
        return truncated.padStart(width);
      case 'center':
        const leftPad = Math.floor((width - truncated.length) / 2);
        const rightPad = width - truncated.length - leftPad;
        return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad);
      default:
        return truncated.padEnd(width);
    }
  }

  /**
   * Get nested value from an object using dot notation.
   * @param obj - Object to get value from.
   * @param path - Dot notation path.
   * @returns Value at path.
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }

    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  }

  /**
   * Format a value for display.
   * @param value - Value to format.
   * @returns Formatted string.
   */
  private formatValue(value: unknown): string {
    if (value === null) { return chalk.gray('null'); }
    if (value === undefined) { return chalk.gray('undefined'); }
    if (typeof value === 'boolean') { return value ? chalk.green('✓') : chalk.red('✗'); }
    if (typeof value === 'number') { return chalk.yellow(value.toLocaleString()); }
    if (value instanceof Date) { return chalk.cyan(value.toISOString()); }
    if (Array.isArray(value)) { return chalk.gray(`[${value.length} items]`); }
    if (typeof value === 'object') { return chalk.gray('[object]'); }
    return String(value);
  }

  /**
   * Escape a value for CSV output.
   * @param value - Value to escape.
   * @param delimiter - CSV delimiter.
   * @returns Escaped value.
   */
  private escapeCsvValue(value: string, delimiter: string): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Convert a key to human-readable format.
   * @param key - Key to humanize.
   * @returns Humanized key.
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
