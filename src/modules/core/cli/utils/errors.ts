/**
 * Base error class for CLI-related errors.
 */
export class CLIError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CLIError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a command is not found.
 */
export class CommandNotFoundError extends CLIError {
  constructor(public readonly commandName: string) {
    super(`Command not found: ${commandName}`, 'COMMAND_NOT_FOUND');
    this.name = 'CommandNotFoundError';
  }
}

/**
 * Error thrown when command execution fails.
 */
export class CommandExecutionError extends CLIError {
  constructor(
    public readonly commandName: string,
    public readonly originalError: Error,
    message?: string
  ) {
    super(
      message || `Failed to execute command "${commandName}": ${originalError.message}`,
      'COMMAND_EXECUTION_FAILED'
    );
    this.name = 'CommandExecutionError';
  }
}

/**
 * Error thrown when command arguments are invalid.
 */
export class InvalidArgumentsError extends CLIError {
  constructor(
    public readonly commandName: string,
    public readonly details: string
  ) {
    super(
      `Invalid arguments for command "${commandName}": ${details}`,
      'INVALID_ARGUMENTS'
    );
    this.name = 'InvalidArgumentsError';
  }
}

/**
 * Error thrown when required options are missing.
 */
export class MissingRequiredOptionError extends CLIError {
  constructor(
    public readonly commandName: string,
    public readonly optionName: string
  ) {
    super(
      `Missing required option "${optionName}" for command "${commandName}"`,
      'MISSING_REQUIRED_OPTION'
    );
    this.name = 'MissingRequiredOptionError';
  }
}

/**
 * Error thrown when command discovery fails.
 */
export class CommandDiscoveryError extends CLIError {
  constructor(
    public readonly path: string,
    public readonly originalError: Error
  ) {
    super(
      `Failed to discover commands at "${path}": ${originalError.message}`,
      'COMMAND_DISCOVERY_FAILED'
    );
    this.name = 'CommandDiscoveryError';
  }
}

/**
 * Error thrown when CLI module initialization fails.
 */
export class CLIInitializationError extends CLIError {
  constructor(public readonly originalError: Error) {
    super(
      `Failed to initialize CLI module: ${originalError.message}`,
      'CLI_INITIALIZATION_FAILED'
    );
    this.name = 'CLIInitializationError';
  }
}

/**
 * Error thrown when output formatting fails.
 */
export class OutputFormattingError extends CLIError {
  constructor(
    public readonly format: string,
    public readonly originalError: Error
  ) {
    super(
      `Failed to format output as "${format}": ${originalError.message}`,
      'OUTPUT_FORMATTING_FAILED'
    );
    this.name = 'OutputFormattingError';
  }
}

/**
 * Error thrown when documentation generation fails.
 */
export class DocumentationGenerationError extends CLIError {
  constructor(
    public readonly format: string,
    public readonly originalError: Error
  ) {
    super(
      `Failed to generate documentation in "${format}" format: ${originalError.message}`,
      'DOCUMENTATION_GENERATION_FAILED'
    );
    this.name = 'DocumentationGenerationError';
  }
}
