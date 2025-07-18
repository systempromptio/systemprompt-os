/**
 * @fileoverview ID validation utilities
 * @module utils/id-validation
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_ID_PREFIX = 'task_';

/**
 * Validates if a string is a valid UUID v4
 * @param id - String to validate
 * @returns true if valid UUID, false otherwise
 */
export function isValidUUID(id: string): boolean {
  if (typeof id !== 'string' || !id) {
    return false;
  }
  return UUID_REGEX.test(id);
}

/**
 * Validates a task ID (either plain UUID or prefixed with 'task_')
 * @param id - Task ID to validate
 * @returns The validated task ID
 * @throws Error if invalid
 */
export function validateTaskId(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid task ID');
  }

  const trimmed = id.trim();
  
  // Check if it's a plain UUID
  if (isValidUUID(trimmed)) {
    return trimmed;
  }
  
  // Check if it's prefixed
  if (trimmed.startsWith(TASK_ID_PREFIX)) {
    const uuid = trimmed.substring(TASK_ID_PREFIX.length);
    if (isValidUUID(uuid)) {
      return trimmed;
    }
  }
  
  throw new Error('Invalid task ID');
}

/**
 * Sanitizes a task ID by removing prefix and validating
 * @param id - Task ID to sanitize
 * @returns The sanitized UUID
 * @throws Error if invalid
 */
export function sanitizeTaskId(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid task ID');
  }

  let cleaned = id.trim().toLowerCase();
  
  // Remove task_ prefix if present
  if (cleaned.startsWith(TASK_ID_PREFIX)) {
    cleaned = cleaned.substring(TASK_ID_PREFIX.length);
  }
  
  // Validate the remaining UUID
  if (!isValidUUID(cleaned)) {
    throw new Error('Invalid task ID');
  }
  
  return cleaned;
}