/**
 * Regular expression pattern for validating UUID format.
 * Matches UUID v1, v4, v5 formats in both uppercase and lowercase.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if the input is a valid UUID format.
 * @param input - The input to validate (can be any type).
 * @returns True if the input is a valid UUID string, false otherwise.
 */
export function isValidUUID(input: any): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  if (input.trim().length === 0) {
    return false;
  }

  return UUID_REGEX.test(input);
}

/**
 * Validates a task ID format.
 * Accepts UUIDs or UUIDs with 'task_' prefix.
 * @param taskId - The task ID to validate.
 * @returns The validated task ID if valid.
 * @throws {Error} If the task ID is invalid.
 */
export function validateTaskId(taskId: any): string {
  if (taskId === null || taskId === undefined || typeof taskId !== 'string') {
    throw new Error('Invalid task ID');
  }

  if (taskId.trim().length === 0) {
    throw new Error('Invalid task ID');
  }

  const trimmedId = taskId.trim();

  if (isValidUUID(trimmedId)) {
    return trimmedId;
  }

  if (trimmedId.startsWith('task_')) {
    const uuidPart = trimmedId.substring(5)
    if (isValidUUID(uuidPart)) {
      return trimmedId;
    }
  }

  throw new Error('Invalid task ID');
}

/**
 * Sanitizes a task ID by trimming whitespace, removing task_ prefix,
 * and converting to lowercase.
 * @param taskId - The task ID to sanitize.
 * @returns The sanitized UUID string.
 * @throws {Error} If the task ID is invalid after sanitization.
 */
export function sanitizeTaskId(taskId: any): string {
  if (taskId === null || taskId === undefined || typeof taskId !== 'string') {
    throw new Error('Invalid task ID');
  }

  let sanitized = taskId.trim();

  if (sanitized.length === 0) {
    throw new Error('Invalid task ID');
  }

  if (sanitized.startsWith('task_')) {
    sanitized = sanitized.substring(5);

    if (sanitized.startsWith('task_')) {
      throw new Error('Invalid task ID');
    }
  }

  if (sanitized.includes('_') && (/^[a-zA-Z]+_/).test(sanitized)) {
    if (!sanitized.startsWith('task_')) {
      throw new Error('Invalid task ID');
    }
  }

  sanitized = sanitized.toLowerCase();

  if (!isValidUUID(sanitized)) {
    throw new Error('Invalid task ID');
  }

  return sanitized;
}
