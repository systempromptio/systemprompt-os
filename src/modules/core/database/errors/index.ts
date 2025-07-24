/**
 * Database error exports.
 * @file Database error exports.
 * @module database/errors
 */

export { DatabaseError } from '@/modules/core/database/errors/base.error';
export { ConnectionError } from '@/modules/core/database/errors/connection.error';
export { QueryError } from '@/modules/core/database/errors/query.error';
export { ModuleDatabaseError } from '@/modules/core/database/errors/module-database.error';

/**
 * Type guard to check if error is a DatabaseError.
 * @param error - The error to check.
 * @returns True if error is a DatabaseError.
 */
export const isDatabaseError = (error: unknown): error is import('./base.error.js').DatabaseError => {
  return error instanceof (await import('./base.error.js')).DatabaseError;
};
