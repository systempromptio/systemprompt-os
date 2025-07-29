/**
 * Base error class for extension-related errors.
 */
export class ExtensionError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly errors?: string[];
  public readonly missingDependencies?: string[];

  /**
   * Creates a new ExtensionError.
   * @param message - The error message.
   * @param code - The error code (defaults to 'EXTENSION_ERROR').
   * @param statusCode - The HTTP status code (defaults to 500).
   */
  constructor(message: string, code = 'EXTENSION_ERROR', statusCode = 500) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates an ExtensionNotFoundError.
   * @param extensionName - The name of the extension that was not found.
   * @returns A new ExtensionError instance.
   */
  static notFound(extensionName: string): ExtensionError {
    const error = new ExtensionError(
      `Extension not found: ${extensionName}`,
      'EXTENSION_NOT_FOUND',
      404
    );
    error.name = 'ExtensionNotFoundError';
    return error;
  }

  /**
   * Creates an ExtensionValidationError.
   * @param errors - Array of validation error messages.
   * @returns A new ExtensionError instance.
   */
  static validationFailed(errors: string[]): ExtensionError {
    const error = new ExtensionError(
      `Extension validation failed: ${errors.join(', ')}`,
      'EXTENSION_VALIDATION_FAILED',
      400
    );
    error.name = 'ExtensionValidationError';
    error.setErrorsProperty(errors);
    return error;
  }

  /**
   * Creates an ExtensionInstallationError.
   * @param message - The error message.
   * @param details - Optional additional details about the error.
   * @returns A new ExtensionError instance.
   */
  static installationFailed(message: string, details?: string): ExtensionError {
    const errorMessage = details === undefined
      ? `Extension installation failed: ${message}`
      : `Extension installation failed: ${message} - ${details}`;

    const error = new ExtensionError(
      errorMessage,
      'EXTENSION_INSTALLATION_FAILED',
      500
    );
    error.name = 'ExtensionInstallationError';
    return error;
  }

  /**
   * Creates a ProtectedExtensionError.
   * @param extensionName - The name of the protected extension.
   * @returns A new ExtensionError instance.
   */
  static protectedExtension(extensionName: string): ExtensionError {
    const error = new ExtensionError(
      `Cannot remove protected extension: ${extensionName}. Core modules cannot be removed.`,
      'PROTECTED_EXTENSION',
      403
    );
    error.name = 'ProtectedExtensionError';
    return error;
  }

  /**
   * Creates an ExtensionConfigError.
   * @param message - The error message.
   * @param configPath - Optional path to the configuration file.
   * @returns A new ExtensionError instance.
   */
  static configError(message: string, configPath?: string): ExtensionError {
    const errorMessage = configPath === undefined
      ? `Invalid extension configuration: ${message}`
      : `Invalid extension configuration at ${configPath}: ${message}`;

    const error = new ExtensionError(
      errorMessage,
      'EXTENSION_CONFIG_ERROR',
      400
    );
    error.name = 'ExtensionConfigError';
    return error;
  }

  /**
   * Creates an ExtensionDependencyError.
   * @param extensionName - The name of the extension with dependency issues.
   * @param missingDependencies - Array of missing dependency names.
   * @returns A new ExtensionError instance.
   */
  static dependencyError(extensionName: string, missingDependencies: string[]): ExtensionError {
    const error = new ExtensionError(
      `Extension ${extensionName} has unsatisfied dependencies: ${missingDependencies.join(', ')}`,
      'EXTENSION_DEPENDENCY_ERROR',
      424
    );
    error.name = 'ExtensionDependencyError';
    error.setMissingDependenciesProperty(missingDependencies);
    return error;
  }

  /**
   * Creates an ExtensionRegistryError.
   * @param message - The error message.
   * @returns A new ExtensionError instance.
   */
  static registryError(message: string): ExtensionError {
    const error = new ExtensionError(
      `Extension registry error: ${message}`,
      'EXTENSION_REGISTRY_ERROR',
      503
    );
    error.name = 'ExtensionRegistryError';
    return error;
  }

  /**
   * Creates an ExtensionAlreadyExistsError.
   * @param extensionName - The name of the extension that already exists.
   * @returns A new ExtensionError instance.
   */
  static alreadyExists(extensionName: string): ExtensionError {
    const error = new ExtensionError(
      `Extension already exists: ${extensionName}. Use --force to overwrite.`,
      'EXTENSION_ALREADY_EXISTS',
      409
    );
    error.name = 'ExtensionAlreadyExistsError';
    return error;
  }

  /**
   * Creates an InvalidExtensionPathError.
   * @param path - The invalid extension path.
   * @param reason - Optional reason why the path is invalid.
   * @returns A new ExtensionError instance.
   */
  static invalidPath(path: string, reason?: string): ExtensionError {
    const errorMessage = reason === undefined
      ? `Invalid extension path: ${path}`
      : `Invalid extension path: ${path} - ${reason}`;

    const error = new ExtensionError(
      errorMessage,
      'INVALID_EXTENSION_PATH',
      400
    );
    error.name = 'InvalidExtensionPathError';
    return error;
  }

  /**
   * Sets the errors property for validation errors.
   * @param errors - Array of validation error messages.
   */
  protected setErrorsProperty(errors: string[]): void {
    Object.defineProperty(this, 'errors', {
      value: errors,
      writable: false,
      enumerable: true,
      configurable: false
    });
  }

  /**
   * Sets the missingDependencies property for dependency errors.
   * @param missingDependencies - Array of missing dependency names.
   */
  protected setMissingDependenciesProperty(missingDependencies: string[]): void {
    Object.defineProperty(this, 'missingDependencies', {
      value: missingDependencies,
      writable: false,
      enumerable: true,
      configurable: false
    });
  }
}

/**
 * Export legacy class names as aliases for backward compatibility.
 */
export const ExtensionNotFoundError = ExtensionError;
export const ExtensionValidationError = ExtensionError;
export const ExtensionInstallationError = ExtensionError;
export const ProtectedExtensionError = ExtensionError;
export const ExtensionConfigError = ExtensionError;
export const ExtensionDependencyError = ExtensionError;
export const ExtensionRegistryError = ExtensionError;
export const ExtensionAlreadyExistsError = ExtensionError;
export const InvalidExtensionPathError = ExtensionError;
