/**
 * Validation Service Exports
 * @module dev/services/validation
 */

export { ValidationService } from '../validation.service';
export { ModuleValidator } from './validators/module.validator';
export type {
  ValidationResult,
  ModuleValidationResult,
  ValidationOptions,
  IValidator
} from './types';