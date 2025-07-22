/**
 * @fileoverview Type definitions for CLI module
 * @module modules/core/cli/types
 */

/**
 * Context passed to CLI commands
 */
export interface CLIContext {
  /** Current working directory */
  cwd: string;
  /** Command arguments */
  args: Record<string, any>;
  /** Command options */
  options?: Record<string, any>;
  /** Logger instance */
  logger?: CLILogger;
}

/**
 * CLI command option definition
 */
export interface CLIOption {
  /** Option name */
  name: string;
  /** Option type */
  type: 'string' | 'boolean' | 'number' | 'array';
  /** Option description */
  description: string;
  /** Short alias for the option */
  alias?: string;
  /** Default value */
  default?: any;
  /** Whether the option is required */
  required?: boolean;
  /** Allowed values for string options */
  choices?: string[];
}

/**
 * CLI command positional argument definition
 */
export interface CLIPositional {
  /** Argument name */
  name: string;
  /** Argument type */
  type: 'string' | 'number' | 'array';
  /** Argument description */
  description: string;
  /** Whether the argument is required */
  required?: boolean;
  /** Default value */
  default?: any;
}

/**
 * CLI command definition
 */
export interface CLICommand {
  /** Command description */
  description: string;
  /** Command options */
  options?: CLIOption[];
  /** Positional arguments */
  positionals?: CLIPositional[];
  /** Command execution function */
  execute: (context: CLIContext) => Promise<void>;
  /** Command examples */
  examples?: string[];
  /** Command aliases */
  aliases?: string[];
}

/**
 * CLI logger interface
 */
export interface CLILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Command metadata
 */
export interface CommandMetadata {
  /** Full command name (including module prefix) */
  name: string;
  /** Module name */
  module: string;
  /** Command name without module prefix */
  commandName: string;
  /** Command description */
  description: string;
  /** Usage example */
  usage: string;
  /** Command options */
  options: CLIOption[];
  /** Positional arguments */
  positionals?: CLIPositional[];
}

/**
 * CLI configuration
 */
export interface CLIConfig {
  /** Whether to show colors in output */
  showColors: boolean;
  /** Default output format */
  outputFormat: 'text' | 'json' | 'table';
  /** Whether to enable interactive mode */
  interactiveMode: boolean;
}

/**
 * Command discovery result
 */
export interface CommandDiscoveryResult {
  /** Discovered commands */
  commands: Map<string, CLICommand>;
  /** Discovery errors */
  errors: Array<{ command: string; error: Error }>;
}

/**
 * CLI module exports
 */
export interface CLIModuleExports {
  /** Get all available commands */
  getAllCommands(): Promise<Map<string, CLICommand>>;
  /** Get help for a specific command */
  getCommandHelp(commandName: string, commands: Map<string, CLICommand>): string;
  /** Format commands for display */
  formatCommands(commands: Map<string, CLICommand>, format: string): string;
  /** Generate documentation for all commands */
  generateDocs(commands: Map<string, CLICommand>, format: string): string;
}