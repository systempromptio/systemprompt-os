/**
 * @fileoverview Custom error classes for extension module
 * @module modules/core/extension/utils/errors
 */

/**
 * Base error class for extension-related errors
 */
export class ExtensionError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'EXTENSIONerror', statusCode: number = 500) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when an extension is not found
 */
export class ExtensionNotFoundError extends ExtensionError {
  constructor(extensionName: string) {
    super(`Extension not found: ${extensionName}`, 'EXTENSION_NOT_FOUND', 404);
    this.name = 'ExtensionNotFoundError';
  }
}

/**
 * Error thrown when extension validation fails
 */
export class ExtensionValidationError extends ExtensionError {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Extension validation failed: ${errors.join(', ')}`, 'EXTENSION_VALIDATION_FAILED', 400);
    this.name = 'ExtensionValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when extension installation fails
 */
export class ExtensionInstallationError extends ExtensionError {
  constructor(message: string, details?: string) {
    super(
      details
        ? `Extension installation failed: ${message} - ${details}`
        : `Extension installation failed: ${message}`,
      'EXTENSION_INSTALLATION_FAILED',
      500,
    );
    this.name = 'ExtensionInstallationError';
  }
}

/**
 * Error thrown when trying to remove a protected extension
 */
export class ProtectedExtensionError extends ExtensionError {
  constructor(extensionName: string) {
    super(
      `Cannot remove protected extension: ${extensionName}. Core modules cannot be removed.`,
      'PROTECTED_EXTENSION',
      403,
    );
    this.name = 'ProtectedExtensionError';
  }
}

/**
 * Error thrown when extension configuration is invalid
 */
export class ExtensionConfigError extends ExtensionError {
  constructor(message: string, configPath?: string) {
    super(
      configPath
        ? `Invalid extension configuration at ${configPath}: ${message}`
        : `Invalid extension configuration: ${message}`,
      'EXTENSION_CONFIGerror',
      400,
    );
    this.name = 'ExtensionConfigError';
  }
}

/**
 * Error thrown when extension dependencies are not satisfied
 */
export class ExtensionDependencyError extends ExtensionError {
  public readonly missingDependencies: string[];

  constructor(extensionName: string, missingDependencies: string[]) {
    super(
      `Extension ${extensionName} has unsatisfied dependencies: ${missingDependencies.join(', ')}`,
      'EXTENSION_DEPENDENCYerror',
      424,
    );
    this.name = 'ExtensionDependencyError';
    this.missingDependencies = missingDependencies;
  }
}

/**
 * Error thrown when extension registry is unavailable
 */
export class ExtensionRegistryError extends ExtensionError {
  constructor(message: string) {
    super(`Extension registry error: ${message}`, 'EXTENSION_REGISTRYerror', 503);
    this.name = 'ExtensionRegistryError';
  }
}

/**
 * Error thrown when extension already exists
 */
export class ExtensionAlreadyExistsError extends ExtensionError {
  constructor(extensionName: string) {
    super(
      `Extension already exists: ${extensionName}. Use --force to overwrite.`,
      'EXTENSION_ALREADY_EXISTS',
      409,
    );
    this.name = 'ExtensionAlreadyExistsError';
  }
}

/**
 * Error thrown when extension path is invalid
 */
export class InvalidExtensionPathError extends ExtensionError {
  constructor(path: string, reason?: string) {
    super(
      reason ? `Invalid extension path: ${path} - ${reason}` : `Invalid extension path: ${path}`,
      'INVALID_EXTENSION_PATH',
      400,
    );
    this.name = 'InvalidExtensionPathError';
  }
}
