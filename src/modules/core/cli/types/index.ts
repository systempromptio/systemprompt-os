/**
 * Context passed to CLI commands.
 */
export interface ICLIContext {
    cwd: string;
    args: Record<string, unknown>;
    flags: Record<string, unknown>;
    options?: Record<string, unknown>;
    env: Record<string, string>;
    logger?: CLILogger;
}

/**
 * CLI command option definition.
 */
export interface ICLIOption {
    name: string;
    type: 'string' | 'boolean' | 'number' | 'array';
    description: string;
    alias?: string;
    default?: unknown;
    required?: boolean;
    choices?: string[];
}

/**
 * CLI command positional argument definition.
 */
export interface ICLIPositional {
    name: string;
    type: 'string' | 'number' | 'array';
    description: string;
    required?: boolean;
    default?: unknown;
}

/**
 * CLI command definition.
 */
export interface ICLICommand {
    name?: string;
    description: string;
    options?: ICLIOption[];
    positionals?: ICLIPositional[];
    execute?: (context: ICLIContext) => Promise<void>;
    executorPath?: string;
    examples?: string[];
    aliases?: string[];
}

/**
 * CLI logger interface.
 */
export interface ICLILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Command metadata.
 */
export interface ICommandMetadata {
    name: string;
    module: string;
    commandName: string;
    description: string;
    usage: string;
    options: ICLIOption[];
    positionals?: ICLIPositional[];
}

/**
 * CLI configuration.
 */
export interface ICLIConfig {
    showColors: boolean;
    outputFormat: 'text' | 'json' | 'table';
    interactiveMode: boolean;
}

/**
 * Command discovery result.
 */
export interface ICommandDiscoveryResult {
    commands: Map<string, ICLICommand>;
    errors: Array<{ command: string; error: Error }>;
}

/**
 * CLI module exports.
 */
export interface ICLIModuleExports {
    service(): unknown;
    getAllCommands(): Promise<Map<string, ICLICommand>>;
    getCommandHelp(commandName: string, commands: Map<string, ICLICommand>): string;
    formatCommands(commands: Map<string, ICLICommand>, format: string): string;
    generateDocs(commands: Map<string, ICLICommand>, format: string): string;
}

/**
 * CLI Service interface.
 */
export interface ICLIService {
  initialize(logger: ICLILogger): Promise<void>;
  isInitialized(): boolean;
  getAllCommands(): Promise<Map<string, ICLICommand>>;
  getCommandMetadata(): Promise<ICommandMetadata[]>;
}

/**
 * CLI service interface for help commands.
 */
export interface ICliService {
  getAllCommands: () => Promise<Map<string, unknown>>;
  getCommandHelp: (name: string, commands: Map<string, unknown>) => string;
  formatCommands: (commands: Map<string, unknown>, format: string) => string;
  generateDocs: (commands: Map<string, unknown>, format: string) => string;
  scanAndRegisterModuleCommands: (modules: Map<string, { path: string }>) => Promise<void>;
}

/**
 * CLI module interface for help commands.
 */
export interface ICliModule {
  exports: {
    service?: () => ICliService;
  };
  formatCommands: (commands: Map<string, unknown>, format: string) => string;
}

export type CLIContext = ICLIContext;
export type CLIOption = ICLIOption;
export type CLIPositional = ICLIPositional;
export type CLICommand = ICLICommand;
export type CLILogger = ICLILogger;
export type CommandMetadata = ICommandMetadata;
export type CLIConfig = ICLIConfig;
export type CommandDiscoveryResult = ICommandDiscoveryResult;
export type CLIModuleExports = ICLIModuleExports;
