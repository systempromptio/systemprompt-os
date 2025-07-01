/**
 * @fileoverview Central validation registry and middleware
 * @module types/validation
 * @since 1.0.0
 */

import { z } from "zod";
import {
  AgentProviderSchema,
  AgentStatusSchema,
  QueryContextSchema,
  SessionStatusSchema,
  SessionConfigSchema,
  ClaudeConfigSchema,
  ApiResponseSchema,
  CreateSessionRequestSchema,
  CreateTaskRequestSchema,
  QueryAgentRequestSchema,
} from "../index.js";

/**
 * Central validation registry for managing Zod schemas
 * @class
 * @since 1.0.0
 */
export class ValidationRegistry {
  private static schemas = new Map<string, z.ZodSchema<unknown>>();

  static {
    // Register all schemas
    this.register("agent.provider", AgentProviderSchema);
    this.register("agent.status", AgentStatusSchema);
    this.register("agent.queryContext", QueryContextSchema);
    this.register("session.status", SessionStatusSchema);
    this.register("session.config", SessionConfigSchema);
    this.register("provider.claude.config", ClaudeConfigSchema);
    this.register("api.response", ApiResponseSchema);
    this.register("api.request.createSession", CreateSessionRequestSchema);
    this.register("api.request.createTask", CreateTaskRequestSchema);
    this.register("api.request.queryAgent", QueryAgentRequestSchema);
  }

  /**
   * Register a schema
   * @template T - Schema type
   * @param {string} name - Schema name
   * @param {z.ZodSchema<T>} schema - Zod schema
   * @since 1.0.0
   */
  static register<T>(name: string, schema: z.ZodSchema<T>): void {
    this.schemas.set(name, schema);
  }

  /**
   * Get a schema by name
   * @param {string} name - Schema name
   * @returns {z.ZodSchema<unknown> | undefined} Schema if found
   * @since 1.0.0
   */
  static get(name: string): z.ZodSchema<unknown> | undefined {
    return this.schemas.get(name);
  }

  /**
   * Validate data against a schema
   * @template T - Expected type
   * @param {string} name - Schema name
   * @param {unknown} data - Data to validate
   * @returns {T} Validated data
   * @throws {Error} If schema not found
   * @throws {z.ZodError} If validation fails
   * @since 1.0.0
   */
  static validate<T>(name: string, data: unknown): T {
    const schema = this.get(name);
    if (!schema) {
      throw new Error(`Schema '${name}' not found`);
    }
    return schema.parse(data) as T;
  }

  /**
   * Safe validate (returns result instead of throwing)
   * @template T - Expected type
   * @param {string} name - Schema name
   * @param {unknown} data - Data to validate
   * @returns {z.SafeParseReturnType<unknown, T>} Validation result
   * @since 1.0.0
   */
  static safeValidate<T>(name: string, data: unknown): z.SafeParseReturnType<unknown, T> {
    const schema = this.get(name);
    if (!schema) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: "custom",
            message: `Schema '${name}' not found`,
            path: [],
          },
        ]),
      } as z.SafeParseReturnType<unknown, T>;
    }
    return schema.safeParse(data) as z.SafeParseReturnType<unknown, T>;
  }

  /**
   * List all registered schemas
   * @returns {string[]} Sorted list of schema names
   * @since 1.0.0
   */
  static list(): string[] {
    return Array.from(this.schemas.keys()).sort();
  }
}

/**
 * Generic request interface for framework-agnostic middleware
 * @interface
 * @since 1.0.0
 * @private
 */
interface Request {
  /**
   * Request body
   * @since 1.0.0
   */
  body?: unknown;
  
  /**
   * Query parameters
   * @since 1.0.0
   */
  query?: unknown;
  
  /**
   * Path parameters
   * @since 1.0.0
   */
  params?: unknown;
}

/**
 * Generic response interface for framework-agnostic middleware
 * @interface
 * @since 1.0.0
 * @private
 */
interface Response {
  /**
   * Set response status code
   * @param {number} code - HTTP status code
   * @returns {Response} Response for chaining
   * @since 1.0.0
   */
  status(code: number): Response;
  
  /**
   * Send JSON response
   * @param {unknown} data - Response data
   * @since 1.0.0
   */
  json(data: unknown): void;
}

/**
 * Next function for middleware chain
 * @since 1.0.0
 * @private
 */
type NextFunction = () => void;

/**
 * Creates validation middleware for request body
 * @param {string} schemaName - Name of schema to validate against
 * @returns {Function} Middleware function
 * @since 1.0.0
 */
export function validateBody(schemaName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = ValidationRegistry.safeValidate(schemaName, req.body);

    if (!result.success) {
      res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          validationErrors: result.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
            value: undefined,
            constraint: e.code,
          })),
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Creates validation middleware for query parameters
 * @param {string} schemaName - Name of schema to validate against
 * @returns {Function} Middleware function
 * @since 1.0.0
 */
export function validateQuery(schemaName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = ValidationRegistry.safeValidate(schemaName, req.query);

    if (!result.success) {
      res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Query parameter validation failed",
          validationErrors: result.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
            value: undefined,
            constraint: e.code,
          })),
        },
      });
      return;
    }

    req.query = result.data;
    next();
  };
}

/**
 * Creates validation middleware for path parameters
 * @param {string} schemaName - Name of schema to validate against
 * @returns {Function} Middleware function
 * @since 1.0.0
 */
export function validateParams(schemaName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = ValidationRegistry.safeValidate(schemaName, req.params);

    if (!result.success) {
      res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Path parameter validation failed",
          validationErrors: result.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
            value: undefined,
            constraint: e.code,
          })),
        },
      });
      return;
    }

    req.params = result.data;
    next();
  };
}

/**
 * Options for combined validation middleware
 * @interface
 * @since 1.0.0
 */
export interface ValidationOptions {
  /**
   * Schema name for body validation
   * @since 1.0.0
   */
  body?: string;
  
  /**
   * Schema name for query validation
   * @since 1.0.0
   */
  query?: string;
  
  /**
   * Schema name for params validation
   * @since 1.0.0
   */
  params?: string;
}

/**
 * Validation error details
 * @interface
 * @since 1.0.0
 * @private
 */
interface ValidationError {
  /**
   * Error location (body, query, params)
   * @since 1.0.0
   */
  location: string;
  
  /**
   * Field path that failed validation
   * @since 1.0.0
   */
  field: string;
  
  /**
   * Error message
   * @since 1.0.0
   */
  message: string;
  
  /**
   * Validation constraint that failed
   * @since 1.0.0
   */
  constraint: string;
}

/**
 * Creates combined validation middleware
 * @param {ValidationOptions} options - Validation options
 * @returns {Function} Middleware function
 * @since 1.0.0
 * @example
 * ```typescript
 * app.post('/api/tasks', validate({
 *   body: 'api.request.createTask',
 *   query: 'pagination.params'
 * }), handler);
 * ```
 */
export function validate(options: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];

    if (options.body) {
      const result = ValidationRegistry.safeValidate(options.body, req.body);
      if (!result.success) {
        errors.push(
          ...result.error.errors.map((e) => ({
            location: "body",
            field: e.path.join("."),
            message: e.message,
            constraint: e.code,
          })),
        );
      } else {
        req.body = result.data;
      }
    }

    if (options.query) {
      const result = ValidationRegistry.safeValidate(options.query, req.query);
      if (!result.success) {
        errors.push(
          ...result.error.errors.map((e) => ({
            location: "query",
            field: e.path.join("."),
            message: e.message,
            constraint: e.code,
          })),
        );
      } else {
        req.query = result.data;
      }
    }

    if (options.params) {
      const result = ValidationRegistry.safeValidate(options.params, req.params);
      if (!result.success) {
        errors.push(
          ...result.error.errors.map((e) => ({
            location: "params",
            field: e.path.join("."),
            message: e.message,
            constraint: e.code,
          })),
        );
      } else {
        req.params = result.data;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          validationErrors: errors,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Re-export zod for convenience
 * @since 1.0.0
 */
export { z } from "zod";
