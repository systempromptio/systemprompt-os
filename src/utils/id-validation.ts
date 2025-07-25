import { PREFIXED_TASK_REGEX, UUID_REGEX } from '@/constants/validation.constants';

/**
 * Validates if the input is a valid UUID format.
 * @param input - The input to validate (can be any type).
 * @returns True if the input is a valid UUID string, false otherwise.
 */
export const isValidUuid = (input: unknown): boolean => {
  if (typeof input !== 'string') {
    return false;
  }

  if (input.trim().length === 0) {
    return false;
  }

  return UUID_REGEX.test(input);
};

/**
 * Validates a task ID format.
 * Accepts UUIDs or UUIDs with 'task_' prefix.
 * @param taskId - The task ID to validate.
 * @returns The validated task ID if valid.
 * @throws {Error} If the task ID is invalid.
 */
export const validateTaskId = (taskId: unknown): string => {
  if (taskId === null || taskId === undefined || typeof taskId !== 'string') {
    throw new Error('Invalid task ID');
  }

  if (taskId.trim().length === 0) {
    throw new Error('Invalid task ID');
  }

  const trimmedId = taskId.trim();

  if (isValidUuid(trimmedId)) {
    return trimmedId;
  }

  if (trimmedId.startsWith('task_')) {
    const uuidPart = trimmedId.substring(5);
    if (isValidUuid(uuidPart)) {
      return trimmedId;
    }
  }

  throw new Error('Invalid task ID');
};

/**
 * Helper function to validate input type and trim whitespace.
 * @param taskId - The task ID to validate.
 * @returns The trimmed task ID.
 * @throws {Error} If the task ID is invalid.
 */
const validateAndTrimInput = (taskId: unknown): string => {
  if (taskId === null || taskId === undefined || typeof taskId !== 'string') {
    throw new Error('Invalid task ID');
  }

  const trimmed = taskId.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid task ID');
  }

  return trimmed;
};

/**
 * Helper function to remove task prefix and validate.
 * @param sanitized - The sanitized task ID.
 * @returns The processed task ID.
 * @throws {Error} If the task ID is invalid.
 */
const removeTaskPrefix = (sanitized: string): string => {
  let processed = sanitized;

  if (processed.startsWith('task_')) {
    processed = processed.substring(5);

    if (processed.startsWith('task_')) {
      throw new Error('Invalid task ID');
    }
  }

  if (processed.includes('_') && PREFIXED_TASK_REGEX.test(processed)) {
    throw new Error('Invalid task ID');
  }

  return processed;
};

/**
 * Sanitizes a task ID by trimming whitespace, removing task_ prefix,
 * and converting to lowercase.
 * @param taskId - The task ID to sanitize.
 * @returns The sanitized UUID string.
 * @throws {Error} If the task ID is invalid after sanitization.
 */
export const sanitizeTaskId = (taskId: unknown): string => {
  const trimmed = validateAndTrimInput(taskId);
  const withoutPrefix = removeTaskPrefix(trimmed);
  const sanitized = withoutPrefix.toLowerCase();

  if (!isValidUuid(sanitized)) {
    throw new Error('Invalid task ID');
  }

  return sanitized;
};
