/**
 * Validation Service Exports.
 * @module dev/services/validation
 */

export { ValidationService } from '@/modules/core/dev/services/validation.service';
export { ModuleValidator } from '@/modules/core/dev/services/validation/validators/module.validator';
export type {
  ValidationResult,
  ModuleValidationResult,
  ValidationOptions,
  IValidator
} from '@/modules/core/dev/services/validation/types';
