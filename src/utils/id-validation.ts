/**
 * ID validation utilities to ensure security and consistency
 */

// UUID v4 regex pattern
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID v4
 */
export function isValidUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Validates a task ID to ensure it's safe for filesystem operations
 * @throws Error if the ID is invalid
 */
export function validateTaskId(id: string): string {
  // Check for null/undefined
  if (!id) {
    throw new Error('Task ID cannot be empty');
  }
  
  // Check if it's a valid UUID
  if (!isValidUUID(id)) {
    throw new Error(`Invalid task ID format: ${id}. Must be a valid UUID v4.`);
  }
  
  // Additional security checks
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`Task ID contains invalid characters: ${id}`);
  }
  
  return id;
}

/**
 * Sanitizes a task ID for safe filesystem operations
 */
export function sanitizeTaskId(id: string): string {
  // First validate it
  validateTaskId(id);
  
  // Return the validated ID (already safe)
  return id;
}