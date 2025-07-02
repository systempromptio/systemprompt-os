/**
 * @fileoverview ID validation utilities to ensure security and consistency
 * @module utils/id-validation
 * 
 * @remarks
 * This module provides utilities for validating and sanitizing IDs used throughout
 * the application, particularly task IDs that are used in filesystem operations.
 * All task IDs must be valid UUID v4 format to ensure security and consistency.
 * 
 * @example
 * ```typescript
 * import { validateTaskId, isValidUUID } from './utils/id-validation';
 * 
 * // Validate a UUID
 * if (isValidUUID('550e8400-e29b-41d4-a716-446655440000')) {
 *   console.log('Valid UUID');
 * }
 * 
 * // Validate and sanitize a task ID
 * try {
 *   const safeId = validateTaskId(userInput);
 *   // Use safeId for filesystem operations
 * } catch (error) {
 *   console.error('Invalid task ID:', error.message);
 * }
 * ```
 */

/**
 * UUID v4 regex pattern for validation
 * @internal
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID v4
 * 
 * @param id - The string to validate
 * @returns True if the string is a valid UUID v4, false otherwise
 * 
 * @example
 * ```typescript
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidUUID('not-a-uuid'); // false
 * ```
 */
export function isValidUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Validates a task ID to ensure it's safe for filesystem operations
 * 
 * @param id - The task ID to validate
 * @returns The validated task ID
 * @throws {Error} If the ID is empty, not a valid UUID v4, or contains dangerous characters
 * 
 * @remarks
 * This function performs multiple security checks:
 * 1. Ensures the ID is not empty
 * 2. Validates it's a proper UUID v4 format
 * 3. Checks for path traversal attempts (.., /, \)
 * 
 * @example
 * ```typescript
 * try {
 *   const validId = validateTaskId('550e8400-e29b-41d4-a716-446655440000');
 *   // validId is safe to use
 * } catch (error) {
 *   console.error('Invalid task ID:', error.message);
 * }
 * ```
 */
export function validateTaskId(id: string): string {
  if (!id) {
    throw new Error('Task ID cannot be empty');
  }
  
  if (!isValidUUID(id)) {
    throw new Error(`Invalid task ID format: ${id}. Must be a valid UUID v4.`);
  }
  
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`Task ID contains invalid characters: ${id}`);
  }
  
  return id;
}

/**
 * Sanitizes a task ID for safe filesystem operations
 * 
 * @param id - The task ID to sanitize
 * @returns The sanitized task ID
 * @throws {Error} If the ID fails validation
 * 
 * @remarks
 * Currently this function just validates the ID and returns it unchanged,
 * as valid UUID v4s don't need sanitization. This function exists for
 * API consistency and potential future sanitization needs.
 * 
 * @example
 * ```typescript
 * const safeId = sanitizeTaskId(userInput);
 * // safeId is guaranteed to be safe for filesystem operations
 * ```
 */
export function sanitizeTaskId(id: string): string {
  validateTaskId(id);
  return id;
}