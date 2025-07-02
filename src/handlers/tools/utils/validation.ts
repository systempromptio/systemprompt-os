/**
 * @fileoverview Validation utilities for orchestrator tools providing
 * schema validation, input sanitization, and error handling
 * @module handlers/tools/orchestrator/utils/validation
 */

import { z, ZodError } from "zod";
import { ValidationError } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatToolResponse } from "../types.js";

/**
 * Validates input against a Zod schema with detailed error reporting
 * 
 * @template T The expected output type
 * @template I The input type
 * @param schema The Zod schema to validate against
 * @param input The input to validate
 * @returns The validated and parsed input
 * @throws ValidationError with detailed field information
 * 
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string() });
 * const result = validateInput(schema, { name: "test" });
 * ```
 */
export function validateInput<T, I = unknown>(schema: z.ZodSchema<T>, input: I): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join("."),
        firstError.path.length > 0 ? getNestedValue(input, firstError.path) : input,
      );
    }
    throw error;
  }
}

/**
 * Validates input and returns a formatted error response on failure
 * 
 * @template T The expected output type
 * @template I The input type
 * @param schema The Zod schema to validate against
 * @param input The input to validate
 * @returns Either the validated input or an error response
 */
export function validateWithResponse<T, I = unknown>(
  schema: z.ZodSchema<T>,
  input: I,
): T | CallToolResult {
  try {
    return validateInput(schema, input);
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatToolResponse({
        status: "error",
        message: `Invalid input: ${error.message}`,
        error: {
          type: "validation_error",
          details: {
            field: error.field,
            value: error.value,
            message: error.message,
          },
        },
      });
    }

    return formatToolResponse({
      status: "error",
      message: "Validation failed",
      error: {
        type: "validation_error",
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/**
 * Creates a safe validator function that returns a result object
 * 
 * @template T The expected output type
 * @param schema The Zod schema to validate against
 * @returns A validator function that returns a result object
 */
export function createSafeValidator<T>(schema: z.ZodSchema<T>) {
  return (
    input: unknown,
  ): { success: true; data: T } | { success: false; error: ValidationError } => {
    try {
      const data = validateInput(schema, input);
      return { success: true, data };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error };
      }
      return {
        success: false,
        error: new ValidationError(
          error instanceof Error ? error.message : "Unknown validation error",
        ),
      };
    }
  };
}

/**
 * Gets a nested value from an object using a path array
 * 
 * @param obj The object to traverse
 * @param path The path array
 * @returns The value at the path or undefined
 */
function getNestedValue(obj: unknown, path: (string | number)[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;

  let current: any = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Validates that a tool is available based on environment
 * 
 * @param tool The tool name to check
 * @returns True if available, false otherwise
 */
export function isToolAvailable(tool: "CLAUDECODE"): boolean {
  switch (tool) {
    case "CLAUDECODE":
      return process.env.CLAUDE_AVAILABLE === "true";
    default:
      return false;
  }
}

/**
 * Sanitizes a string for safe logging (removes sensitive patterns)
 * 
 * @param input The string to sanitize
 * @returns The sanitized string
 * 
 * @example
 * ```typescript
 * sanitizeForLogging("API key: sk-abcd1234..."); // "API key: sk-***"
 * ```
 */
export function sanitizeForLogging(input: string): string {
  return input
    .replace(/sk-[a-zA-Z0-9]{48}/g, "sk-***")
    .replace(/AIza[a-zA-Z0-9-_]{35}/g, "AIza***")
    .replace(/(password|token|secret|key)[\s]*[:=][\s]*["']?([^"'\s]+)["']?/gi, "$1=***")
    .replace(/Bearer\s+[a-zA-Z0-9-._~+/]+/g, "Bearer ***");
}
