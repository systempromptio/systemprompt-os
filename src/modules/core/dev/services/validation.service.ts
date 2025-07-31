/**
 * Generic Validation Service
 * @module dev/services/validation
 */

import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import type { ValidationResult, ValidationOptions, IValidator } from './validation/types';

/**
 * Generic validation service that can be extended for specific validation needs
 */
export class ValidationService {
  private static instance: ValidationService;
  private validators: Map<string, IValidator> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor(private readonly logger: ILogger) {}

  /**
   * Get singleton instance
   * @param logger - Logger instance
   * @returns ValidationService instance
   */
  public static getInstance(logger: ILogger): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService(logger);
    }
    return ValidationService.instance;
  }

  /**
   * Register a validator
   * @param name - Validator name
   * @param validator - Validator instance
   */
  public registerValidator(name: string, validator: IValidator): void {
    this.validators.set(name, validator);
    this.logger.info(LogSource.DEV, `Registered validator: ${name}`);
  }

  /**
   * Get a registered validator
   * @param name - Validator name
   * @returns Validator instance or undefined
   */
  public getValidator<T extends IValidator>(name: string): T | undefined {
    return this.validators.get(name) as T;
  }

  /**
   * Run validation using a specific validator
   * @param validatorName - Name of the validator to use
   * @param target - Target to validate
   * @param options - Validation options
   * @returns Validation result
   */
  public async validate<T, R extends ValidationResult>(
    validatorName: string,
    target: T,
    options?: ValidationOptions
  ): Promise<R> {
    const validator = this.validators.get(validatorName);
    
    if (!validator) {
      throw new Error(`Validator '${validatorName}' not found`);
    }

    try {
      const result = await validator.validate(target, options) as R;
      
      if (options?.logWarnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => 
          this.logger.warn(LogSource.DEV, `Validation warning: ${warning}`)
        );
      }
      
      if (options?.throwOnError && !result.valid) {
        throw new Error(`Validation failed: ${result.errors.join(', ')}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(LogSource.DEV, `Validation error in ${validatorName}`, { error });
      throw error;
    }
  }

  /**
   * Check if a validator is registered
   * @param name - Validator name
   * @returns True if validator exists
   */
  public hasValidator(name: string): boolean {
    return this.validators.has(name);
  }

  /**
   * Get all registered validator names
   * @returns Array of validator names
   */
  public getValidatorNames(): string[] {
    return Array.from(this.validators.keys());
  }
}