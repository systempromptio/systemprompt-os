/**
 * @fileoverview API response type definitions and helper functions
 * @module types/api/responses
 * @since 1.0.0
 */

import { z } from 'zod';

/**
 * Possible API response statuses
 * @since 1.0.0
 */
export type ApiResponseStatus = 'success' | 'error' | 'partial';

/**
 * Standard API response structure
 * @interface
 * @template T - Type of response data
 * @since 1.0.0
 */
export interface ApiResponse<T = unknown> {
  /**
   * Response status
   * @since 1.0.0
   */
  readonly status: ApiResponseStatus;
  
  /**
   * Response data (present if status is success)
   * @since 1.0.0
   */
  readonly data?: T;
  
  /**
   * Error information (present if status is error)
   * @since 1.0.0
   */
  readonly error?: ApiError;
  
  /**
   * Response metadata
   * @since 1.0.0
   */
  readonly metadata?: ResponseMetadata;
}

/**
 * Structured API error information
 * @interface
 * @since 1.0.0
 */
export interface ApiError {
  /**
   * Error code for programmatic handling
   * @since 1.0.0
   */
  readonly code: string;
  
  /**
   * Human-readable error message
   * @since 1.0.0
   */
  readonly message: string;
  
  /**
   * Additional error details
   * @since 1.0.0
   */
  readonly details?: unknown;
  
  /**
   * Path where error occurred
   * @since 1.0.0
   */
  readonly path?: string;
  
  /**
   * Error timestamp
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * Trace ID for debugging
   * @since 1.0.0
   */
  readonly traceId?: string;
}

/**
 * Response metadata information
 * @interface
 * @since 1.0.0
 */
export interface ResponseMetadata {
  /**
   * Unique request identifier
   * @since 1.0.0
   */
  readonly requestId: string;
  
  /**
   * Response timestamp
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * Request processing duration in milliseconds
   * @since 1.0.0
   */
  readonly duration: number;
  
  /**
   * API version
   * @since 1.0.0
   */
  readonly version: string;
  
  /**
   * Non-fatal warnings
   * @since 1.0.0
   */
  readonly warnings?: string[];
}

/**
 * Paginated API response
 * @interface
 * @template T - Type of items in the response
 * @extends {ApiResponse<T[]>}
 * @since 1.0.0
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /**
   * Pagination information
   * @since 1.0.0
   */
  readonly pagination: PaginationInfo;
}

/**
 * Pagination metadata
 * @interface
 * @since 1.0.0
 */
export interface PaginationInfo {
  /**
   * Current page number (1-based)
   * @since 1.0.0
   */
  readonly page: number;
  
  /**
   * Number of items per page
   * @since 1.0.0
   */
  readonly pageSize: number;
  
  /**
   * Total number of items across all pages
   * @since 1.0.0
   */
  readonly totalItems: number;
  
  /**
   * Total number of pages
   * @since 1.0.0
   */
  readonly totalPages: number;
  
  /**
   * Whether there is a next page
   * @since 1.0.0
   */
  readonly hasNext: boolean;
  
  /**
   * Whether there is a previous page
   * @since 1.0.0
   */
  readonly hasPrevious: boolean;
}

/**
 * Streaming response chunk
 * @interface
 * @template T - Type of streamed data
 * @since 1.0.0
 */
export interface StreamingResponse<T = unknown> {
  /**
   * Type of streaming chunk
   * @since 1.0.0
   */
  readonly type: 'data' | 'error' | 'complete';
  
  /**
   * Chunk data (present if type is 'data')
   * @since 1.0.0
   */
  readonly data?: T;
  
  /**
   * Error information (present if type is 'error')
   * @since 1.0.0
   */
  readonly error?: ApiError;
  
  /**
   * Sequence number for ordering
   * @since 1.0.0
   */
  readonly sequence: number;
  
  /**
   * Chunk timestamp
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Batch operation response
 * @interface
 * @template T - Type of individual result data
 * @since 1.0.0
 */
export interface BatchResponse<T = unknown> {
  /**
   * Individual operation results
   * @since 1.0.0
   */
  readonly results: BatchResult<T>[];
  
  /**
   * Batch operation summary
   * @since 1.0.0
   */
  readonly summary: BatchSummary;
}

/**
 * Individual result in a batch operation
 * @interface
 * @template T - Type of result data
 * @since 1.0.0
 */
export interface BatchResult<T = unknown> {
  /**
   * Operation identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Operation status
   * @since 1.0.0
   */
  readonly status: 'success' | 'error' | 'skipped';
  
  /**
   * Result data (present if status is 'success')
   * @since 1.0.0
   */
  readonly data?: T;
  
  /**
   * Error information (present if status is 'error')
   * @since 1.0.0
   */
  readonly error?: ApiError;
}

/**
 * Summary of batch operation results
 * @interface
 * @since 1.0.0
 */
export interface BatchSummary {
  /**
   * Total number of operations
   * @since 1.0.0
   */
  readonly total: number;
  
  /**
   * Number of successful operations
   * @since 1.0.0
   */
  readonly successful: number;
  
  /**
   * Number of failed operations
   * @since 1.0.0
   */
  readonly failed: number;
  
  /**
   * Number of skipped operations
   * @since 1.0.0
   */
  readonly skipped: number;
  
  /**
   * Total duration in milliseconds
   * @since 1.0.0
   */
  readonly duration: number;
}

/**
 * Validation error response
 * @interface
 * @extends {ApiResponse<never>}
 * @since 1.0.0
 */
export interface ValidationErrorResponse extends ApiResponse<never> {
  /**
   * Validation error details
   * @since 1.0.0
   */
  readonly error: ValidationApiError;
}

/**
 * Validation-specific API error
 * @interface
 * @extends {ApiError}
 * @since 1.0.0
 */
export interface ValidationApiError extends ApiError {
  /**
   * Error code is always 'VALIDATION_ERROR'
   * @since 1.0.0
   */
  readonly code: 'VALIDATION_ERROR';
  
  /**
   * Field-level validation errors
   * @since 1.0.0
   */
  readonly validationErrors: FieldError[];
}

/**
 * Field-level validation error
 * @interface
 * @since 1.0.0
 */
export interface FieldError {
  /**
   * Field path that failed validation
   * @since 1.0.0
   */
  readonly field: string;
  
  /**
   * Validation error message
   * @since 1.0.0
   */
  readonly message: string;
  
  /**
   * The invalid value
   * @since 1.0.0
   */
  readonly value?: unknown;
  
  /**
   * Validation constraint that failed
   * @since 1.0.0
   */
  readonly constraint?: string;
}

/**
 * Zod schema for API response validation
 * @since 1.0.0
 */
export const ApiResponseSchema = z.object({
  status: z.enum(['success', 'error', 'partial']),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    path: z.string().optional(),
    timestamp: z.date(),
    traceId: z.string().optional()
  }).optional(),
  metadata: z.object({
    requestId: z.string(),
    timestamp: z.date(),
    duration: z.number(),
    version: z.string(),
    warnings: z.array(z.string()).optional()
  }).optional()
});

/**
 * Creates a Zod schema for paginated responses
 * @template T - Zod schema type for items
 * @param {T} itemSchema - Schema for individual items
 * @returns {z.ZodType} Paginated response schema
 * @since 1.0.0
 */
export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) => 
  ApiResponseSchema.extend({
    data: z.array(itemSchema).optional(),
    pagination: z.object({
      page: z.number().positive(),
      pageSize: z.number().positive(),
      totalItems: z.number().nonnegative(),
      totalPages: z.number().nonnegative(),
      hasNext: z.boolean(),
      hasPrevious: z.boolean()
    })
  });

/**
 * Zod schema for streaming response validation
 * @since 1.0.0
 */
export const StreamingResponseSchema = z.object({
  type: z.enum(['data', 'error', 'complete']),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    path: z.string().optional(),
    timestamp: z.date(),
    traceId: z.string().optional()
  }).optional(),
  sequence: z.number(),
  timestamp: z.date()
});

/**
 * Creates a successful API response
 * @template T - Type of response data
 * @param {T} data - Response data
 * @param {Partial<ResponseMetadata>} [metadata] - Optional metadata
 * @returns {ApiResponse<T>} Success response
 * @since 1.0.0
 * @example
 * ```typescript
 * const response = createSuccessResponse({ id: '123', name: 'Test' });
 * ```
 */
export function createSuccessResponse<T>(data: T, metadata?: Partial<ResponseMetadata>): ApiResponse<T> {
  return {
    status: 'success',
    data,
    metadata: metadata ? {
      requestId: metadata.requestId || generateRequestId(),
      timestamp: metadata.timestamp || new Date(),
      duration: metadata.duration || 0,
      version: metadata.version || '1.0.0',
      warnings: metadata.warnings
    } : undefined
  };
}

/**
 * Creates an error API response
 * @param {ApiError} error - Error information
 * @param {Partial<ResponseMetadata>} [metadata] - Optional metadata
 * @returns {ApiResponse<never>} Error response
 * @since 1.0.0
 * @example
 * ```typescript
 * const response = createErrorResponse({
 *   code: 'NOT_FOUND',
 *   message: 'Resource not found',
 *   timestamp: new Date()
 * });
 * ```
 */
export function createErrorResponse(error: ApiError, metadata?: Partial<ResponseMetadata>): ApiResponse<never> {
  return {
    status: 'error',
    error,
    metadata: metadata ? {
      requestId: metadata.requestId || generateRequestId(),
      timestamp: metadata.timestamp || new Date(),
      duration: metadata.duration || 0,
      version: metadata.version || '1.0.0',
      warnings: metadata.warnings
    } : undefined
  };
}

/**
 * Creates a paginated API response
 * @template T - Type of items in the response
 * @param {T[]} data - Array of items
 * @param {PaginationInfo} pagination - Pagination information
 * @param {Partial<ResponseMetadata>} [metadata] - Optional metadata
 * @returns {PaginatedResponse<T>} Paginated response
 * @since 1.0.0
 * @example
 * ```typescript
 * const response = createPaginatedResponse(
 *   items,
 *   { page: 1, pageSize: 20, totalItems: 100, totalPages: 5, hasNext: true, hasPrevious: false }
 * );
 * ```
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationInfo,
  metadata?: Partial<ResponseMetadata>
): PaginatedResponse<T> {
  return {
    status: 'success',
    data,
    pagination,
    metadata: metadata ? {
      requestId: metadata.requestId || generateRequestId(),
      timestamp: metadata.timestamp || new Date(),
      duration: metadata.duration || 0,
      version: metadata.version || '1.0.0',
      warnings: metadata.warnings
    } : undefined
  };
}

/**
 * Generates a unique request ID
 * @returns {string} Unique request identifier
 * @since 1.0.0
 * @private
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}