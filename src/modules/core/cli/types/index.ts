/**
 * Context passed to CLI commands.
 */
export interface CLIContext {
    cwd: string;
    args: Record<string, any>;
    flags: Record<string, any>;
    options?: Record<string, any>;
    env: Record<string, string>;
    logger?: CLILogger;
}

/**
 * CLI command option definition.
 */
export interface CLIOption {
    name: string;
    type: 'string' | 'boolean' | 'number' | 'array';
    description: string;
    alias?: string;
    default?: any;
    required?: boolean;
    choices?: string[];
}

/**
 * CLI command positional argument definition.
 */
export interface CLIPositional {
    name: string;
    type: 'string' | 'number' | 'array';
    description: string;
    required?: boolean;
    default?: any;
}

/**
 * CLI command definition.
 */
export interface CLICommand {
    name?: string;
    description: string;
    options?: CLIOption[];
    positionals?: CLIPositional[];
    execute?: (context: CLIContext) => Promise<void>;
    executorPath?: string;
    examples?: string[];
    aliases?: string[];
}

/**
 * CLI logger interface.
 */
export interface CLILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Command metadata.
 */
export interface CommandMetadata {
    name: string;
    module: string;
    commandName: string;
    description: string;
    usage: string;
    options: CLIOption[];
    positionals?: CLIPositional[];
}

/**
 * CLI configuration.
 */
export interface CLIConfig {
    showColors: boolean;
    outputFormat: 'text' | 'json' | 'table';
    interactiveMode: boolean;
}

/**
 * Command discovery result.
 */
export interface CommandDiscoveryResult {
    commands: Map<string, CLICommand>;
    errors: Array<{ command: string; error: Error }>;
}

/**
 * CLI module exports.
 */
export interface CLIModuleExports {
    service(): any;
    getAllCommands(): Promise<Map<string, CLICommand>>;
    getCommandHelp(commandName: string, commands: Map<string, CLICommand>): string;
    formatCommands(commands: Map<string, CLICommand>, format: string): string;
    generateDocs(commands: Map<string, CLICommand>, format: string): string;
}

/**
 * CLI Service interface.
 */
export interface ICLIService {
  initialize(logger: CLILogger): Promise<void>;
  isInitialized(): boolean;
  getAllCommands(): Promise<Map<string, CLICommand>>;
  getCommandMetadata(): Promise<CommandMetadata[]>;
}

// Dependency injection token removed - using self-contained modules
