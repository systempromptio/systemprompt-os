/**
 * Module database error class.
 * @file Module database error class.
 * @module database/errors/module-database.error
 */

import { DatabaseError } from '@/modules/core/database/errors/base.error';
import { HTTP_500 } from '@/modules/core/database/constants/index';

/**
 * Error thrown when module database operations fail.
 */
export class ModuleDatabaseError extends DatabaseError {
  public readonly moduleName: string;
  public readonly operation?: string;

  /**
   * Creates a new module database error.
   * @param message - Error message.
   * @param moduleName - Name of the module.
   * @param operation - Operation that failed.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    moduleName: string,
    operation?: string,
    cause?: Error,
  ) {
    super(message, 'MODULE_DATABASE_ERROR', HTTP_500, cause);
    Object.defineProperty(this, 'name', {
 value: 'ModuleDatabaseError',
configurable: true
});
    this.moduleName = moduleName;
    if (operation !== undefined) {
      this.operation = operation;
    }
  }
}
