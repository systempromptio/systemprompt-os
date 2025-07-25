/**
 * Database error exports.
 * @file Database error exports.
 * @module database/errors
 */

import { DatabaseError as DatabaseErrorClass } from '@/modules/core/database/errors/base.error';
export { DatabaseError } from '@/modules/core/database/errors/base.error';
export { ConnectionError } from '@/modules/core/database/errors/connection.error';
export { QueryError } from '@/modules/core/database/errors/query.error';
export { ModuleDatabaseError } from '@/modules/core/database/errors/module-database.error';

/**
 * Type guard to check if error is a DatabaseError.
 * @param error - The error to check.
 * @returns True if error is a DatabaseError.
 */
export const isDatabaseError = (error: unknown): error is DatabaseErrorClass => {
  return error instanceof DatabaseErrorClass;
};
