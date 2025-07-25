/**
 * Regular expression pattern for validating UUID format.
 * Matches UUID v1, v4, v5 formats in both uppercase and lowercase.
 * Uses unicode flag for proper pattern matching.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Regular expression pattern for detecting prefixed task IDs.
 * Uses unicode flag for proper pattern matching.
 */
export const PREFIXED_TASK_REGEX = /^[a-zA-Z]+_/u;
