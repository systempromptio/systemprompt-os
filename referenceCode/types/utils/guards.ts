/**
 * @fileoverview Type guard utility functions
 * @module types/utils/guards
 */

import { AgentStatus, AgentProvider } from "../core/agent.js";
import { SessionStatus } from "../core/session.js";
import { TaskStatus, TaskType } from "../task.js";

/**
 * Type guard for AgentStatus
 * @param {unknown} value - Value to check
 * @returns {value is AgentStatus} True if value is a valid AgentStatus
 */
export function isAgentStatus(value: unknown): value is AgentStatus {
  return (
    typeof value === "string" &&
    ["idle", "initializing", "ready", "processing", "error", "terminated"].includes(value)
  );
}

/**
 * Type guard for AgentProvider
 * @param {unknown} value - Value to check
 * @returns {value is AgentProvider} True if value is a valid AgentProvider
 */
export function isAgentProvider(value: unknown): value is AgentProvider {
  return typeof value === "string" && ["claude", "gemini", "custom"].includes(value);
}

/**
 * Type guard for SessionStatus
 * @param {unknown} value - Value to check
 * @returns {value is SessionStatus} True if value is a valid SessionStatus
 */
export function isSessionStatus(value: unknown): value is SessionStatus {
  return (
    typeof value === "string" &&
    ["active", "paused", "completed", "failed", "cancelled"].includes(value)
  );
}

/**
 * Type guard for TaskStatus
 * @param {unknown} value - Value to check
 * @returns {value is TaskStatus} True if value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    ["pending", "in_progress", "completed", "failed", "cancelled"].includes(value)
  );
}

/**
 * Type guard for TaskType
 * @param {unknown} value - Value to check
 * @returns {value is TaskType} True if value is a valid TaskType
 */
export function isTaskType(value: unknown): value is TaskType {
  return (
    typeof value === "string" &&
    [
      "query",
      "code_generation",
      "code_review",
      "refactoring",
      "testing",
      "documentation",
      "custom",
    ].includes(value)
  );
}

/**
 * Type guard for Record objects
 * @param {unknown} value - Value to check
 * @returns {value is Record<string, unknown>} True if value is a Record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for non-empty strings
 * @param {unknown} value - Value to check
 * @returns {value is string} True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Type guard for positive numbers
 * @param {unknown} value - Value to check
 * @returns {value is number} True if value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

/**
 * Type guard for Date objects
 * @param {unknown} value - Value to check
 * @returns {value is Date} True if value is a valid Date
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard for Error objects
 * @param {unknown} value - Value to check
 * @returns {value is Error} True if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard for object property existence
 * @template T - Object type
 * @template K - Property key type
 * @param {T} obj - Object to check
 * @param {K} key - Property key
 * @returns {obj is T & Record<K, unknown>} True if object has property
 */
export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K,
): obj is T & Record<K, unknown> {
  return key in obj;
}

/**
 * Assertion that value is defined (not null or undefined)
 * @template T - Value type
 * @param {T | null | undefined} value - Value to check
 * @param {string} [message] - Custom error message
 * @throws {Error} If value is null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || "Value is null or undefined");
  }
}

/**
 * Assertion that value is a string
 * @param {unknown} value - Value to check
 * @param {string} [message] - Custom error message
 * @throws {Error} If value is not a string
 */
export function assertString(value: unknown, message?: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(message || "Value is not a string");
  }
}

/**
 * Assertion that value is a number
 * @param {unknown} value - Value to check
 * @param {string} [message] - Custom error message
 * @throws {Error} If value is not a number
 */
export function assertNumber(value: unknown, message?: string): asserts value is number {
  if (typeof value !== "number") {
    throw new Error(message || "Value is not a number");
  }
}

/**
 * Assertion that value is a boolean
 * @param {unknown} value - Value to check
 * @param {string} [message] - Custom error message
 * @throws {Error} If value is not a boolean
 */
export function assertBoolean(value: unknown, message?: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(message || "Value is not a boolean");
  }
}

/**
 * Assertion that value is an array with optional item type checking
 * @template T - Array item type
 * @param {unknown} value - Value to check
 * @param {(item: unknown) => item is T} [itemGuard] - Type guard for array items
 * @param {string} [message] - Custom error message
 * @throws {Error} If value is not an array or items fail type guard
 */
export function assertArray<T>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T,
  message?: string,
): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new Error(message || "Value is not an array");
  }

  if (itemGuard) {
    for (let i = 0; i < value.length; i++) {
      if (!itemGuard(value[i])) {
        throw new Error(`Array item at index ${i} failed type guard`);
      }
    }
  }
}

/**
 * Assertion that value is an object (Record)
 * @param {unknown} value - Value to check
 * @param {string} [message] - Custom error message
 * @throws {Error} If value is not an object
 */
export function assertObject(
  value: unknown,
  message?: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(message || "Value is not an object");
  }
}
