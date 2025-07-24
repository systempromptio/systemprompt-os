/**
 * Base error class for CLI-related errors.
 */
export class CliError extends Error {
  /**
   * Creates a new CLI error.
   * @param message - The error message.
   * @param code - The error code.
   */
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CliError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a command is not found.
 */
export class CommandNotFoundError extends CliError {
  /**
   * Creates a new command not found error.
   * @param commandName - The name of the command that was not found.
   */
  constructor(public readonly commandName: string) {
    super(`Command not found: ${commandName}`, 'COMMAND_NOT_FOUND');
    this.name = 'CommandNotFoundError';
  }
}

/**
 * Error thrown when command execution fails.
 */
export class CommandExecutionError extends CliError {
  /**
   * Creates a new command execution error.
   * @param commandName - The name of the command that failed.
   * @param originalError - The original error that caused the failure.
   * @param message - Optional custom error message.
   */
  constructor(
    public readonly commandName: string,
    public readonly originalError: Error,
    message?: string
  ) {
    super(
      message ?? `Failed to execute command "${commandName}": ${originalError.message}`,
      'COMMAND_EXECUTION_FAILED'
    );
    this.name = 'CommandExecutionError';
  }
}

/**
 * Error thrown when command arguments are invalid.
 */
export class InvalidArgumentsError extends CliError {
  /**
   * Creates a new invalid arguments error.
   * @param commandName - The name of the command.
   * @param details - Details about what is invalid.
   */
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
export class MissingRequiredOptionError extends CliError {
  /**
   * Creates a new missing required option error.
   * @param commandName - The name of the command.
   * @param optionName - The name of the missing option.
   */
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
export class CommandDiscoveryError extends CliError {
  /**
   * Creates a new command discovery error.
   * @param path - The path where discovery failed.
   * @param originalError - The original error that caused the failure.
   */
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
export class CliInitializationError extends CliError {
  /**
   * Creates a new CLI initialization error.
   * @param originalError - The original error that caused the failure.
   */
  constructor(public readonly originalError: Error) {
    super(
      `Failed to initialize CLI module: ${originalError.message}`,
      'CLI_INITIALIZATION_FAILED'
    );
    this.name = 'CliInitializationError';
  }
}

/**
 * Error thrown when output formatting fails.
 */
export class OutputFormattingError extends CliError {
  /**
   * Creates a new output formatting error.
   * @param format - The format that failed.
   * @param originalError - The original error that caused the failure.
   */
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
export class DocumentationGenerationError extends CliError {
  /**
   * Creates a new documentation generation error.
   * @param format - The documentation format that failed.
   * @param originalError - The original error that caused the failure.
   */
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

export { CliError as CLIError };
export { CliInitializationError as CLIInitializationError };
