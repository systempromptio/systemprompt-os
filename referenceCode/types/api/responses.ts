/**
 * @fileoverview API response type definitions and helper functions
 * @module types/api/responses
 */

import { z } from 'zod';

/**
 * Possible API response statuses
 */
export type ApiResponseStatus = 'success' | 'error' | 'partial';

/**
 * Standard API response structure
 * @interface
 * @template T - Type of response data
 */
export interface ApiResponse<T = unknown> {
  /**
   * Response status
   */
  readonly status: ApiResponseStatus;
  
  /**
   * Response data (present if status is success)
   */
  readonly data?: T;
  
  /**
   * Error information (present if status is error)
   */
  readonly error?: ApiError;
  
  /**
   * Response metadata
   */
  readonly metadata?: ResponseMetadata;
}

/**
 * Structured API error information
 * @interface
 */
export interface ApiError {
  /**
   * Error code for programmatic handling
   */
  readonly code: string;
  
  /**
   * Human-readable error message
   */
  readonly message: string;
  
  /**
   * Additional error details
   */
  readonly details?: unknown;
  
  /**
   * Path where error occurred
   */
  readonly path?: string;
  
  /**
   * Error timestamp
   */
  readonly timestamp: Date;
  
  /**
   * Trace ID for debugging
   */
  readonly traceId?: string;
}

/**
 * Response metadata information
 * @interface
 */
export interface ResponseMetadata {
  /**
   * Unique request identifier
   */
  readonly requestId: string;
  
  /**
   * Response timestamp
   */
  readonly timestamp: Date;
  
  /**
   * Request processing duration in milliseconds
   */
  readonly duration: number;
  
  /**
   * API version
   */
  readonly version: string;
  
  /**
   * Non-fatal warnings
   */
  readonly warnings?: string[];
}

/**
 * Paginated API response
 * @interface
 * @template T - Type of items in the response
 * @extends {ApiResponse<T[]>}
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /**
   * Pagination information
   */
  readonly pagination: PaginationInfo;
}

/**
 * Pagination metadata
 * @interface
 */
export interface PaginationInfo {
  /**
   * Current page number (1-based)
   */
  readonly page: number;
  
  /**
   * Number of items per page
   */
  readonly pageSize: number;
  
  /**
   * Total number of items across all pages
   */
  readonly totalItems: number;
  
  /**
   * Total number of pages
   */
  readonly totalPages: number;
  
  /**
   * Whether there is a next page
   */
  readonly hasNext: boolean;
  
  /**
   * Whether there is a previous page
   */
  readonly hasPrevious: boolean;
}

/**
 * Streaming response chunk
 * @interface
 * @template T - Type of streamed data
 */
export interface StreamingResponse<T = unknown> {
  /**
   * Type of streaming chunk
   */
  readonly type: 'data' | 'error' | 'complete';
  
  /**
   * Chunk data (present if type is 'data')
   */
  readonly data?: T;
  
  /**
   * Error information (present if type is 'error')
   */
  readonly error?: ApiError;
  
  /**
   * Sequence number for ordering
   */
  readonly sequence: number;
  
  /**
   * Chunk timestamp
   */
  readonly timestamp: Date;
}

/**
 * Batch operation response
 * @interface
 * @template T - Type of individual result data
 */
export interface BatchResponse<T = unknown> {
  /**
   * Individual operation results
   */
  readonly results: BatchResult<T>[];
  
  /**
   * Batch operation summary
   */
  readonly summary: BatchSummary;
}

/**
 * Individual result in a batch operation
 * @interface
 * @template T - Type of result data
 */
export interface BatchResult<T = unknown> {
  /**
   * Operation identifier
   */
  readonly id: string;
  
  /**
   * Operation status
   */
  readonly status: 'success' | 'error' | 'skipped';
  
  /**
   * Result data (present if status is 'success')
   */
  readonly data?: T;
  
  /**
   * Error information (present if status is 'error')
   */
  readonly error?: ApiError;
}

/**
 * Summary of batch operation results
 * @interface
 */
export interface BatchSummary {
  /**
   * Total number of operations
   */
  readonly total: number;
  
  /**
   * Number of successful operations
   */
  readonly successful: number;
  
  /**
   * Number of failed operations
   */
  readonly failed: number;
  
  /**
   * Number of skipped operations
   */
  readonly skipped: number;
  
  /**
   * Total duration in milliseconds
   */
  readonly duration: number;
}

/**
 * Validation error response
 * @interface
 * @extends {ApiResponse<never>}
 */
export interface ValidationErrorResponse extends ApiResponse<never> {
  /**
   * Validation error details
   */
  readonly error: ValidationApiError;
}

/**
 * Validation-specific API error
 * @interface
 * @extends {ApiError}
 */
export interface ValidationApiError extends ApiError {
  /**
   * Error code is always 'VALIDATION_ERROR'
   */
  readonly code: 'VALIDATION_ERROR';
  
  /**
   * Field-level validation errors
   */
  readonly validationErrors: FieldError[];
}

/**
 * Field-level validation error
 * @interface
 */
export interface FieldError {
  /**
   * Field path that failed validation
   */
  readonly field: string;
  
  /**
   * Validation error message
   */
  readonly message: string;
  
  /**
   * The invalid value
   */
  readonly value?: unknown;
  
  /**
   * Validation constraint that failed
   */
  readonly constraint?: string;
}

/**
 * Zod schema for API response validation
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
      version: metadata.version || '0.01',
      warnings: metadata.warnings
    } : undefined
  };
}

/**
 * Creates an error API response
 * @param {ApiError} error - Error information
 * @param {Partial<ResponseMetadata>} [metadata] - Optional metadata
 * @returns {ApiResponse<never>} Error response
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
      version: metadata.version || '0.01',
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
      version: metadata.version || '0.01',
      warnings: metadata.warnings
    } : undefined
  };
}

/**
 * Generates a unique request ID
 * @returns {string} Unique request identifier
 * @private
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}