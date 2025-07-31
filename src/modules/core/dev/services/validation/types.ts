/**
 * Base validation result interface.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Module validation specific result.
 */
export interface ModuleValidationResult extends ValidationResult {
  module: string;
  checks: {
    [key: string]: boolean;
  };
}

/**
 * Validation options.
 */
export interface ValidationOptions {
  throwOnError?: boolean;
  logWarnings?: boolean;
}

/**
 * Base validator interface.
 */
export interface IValidator<T = unknown, R extends ValidationResult = ValidationResult> {
  validate(target: T, options?: ValidationOptions): Promise<R>;
}
