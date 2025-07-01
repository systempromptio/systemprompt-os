/**
 * @fileoverview API request type definitions and validation schemas
 * @module types/api/requests
 * @since 1.0.0
 */

import { z } from 'zod';
import { AgentProvider } from '../core/agent.js';
import { TaskType } from '../task.js';

/**
 * Generic API request structure
 * @interface
 * @template T - Type of request body
 * @since 1.0.0
 */
export interface ApiRequest<T = unknown> {
  /**
   * HTTP headers
   * @since 1.0.0
   */
  readonly headers: RequestHeaders;
  
  /**
   * URL path parameters
   * @since 1.0.0
   */
  readonly params?: Record<string, string>;
  
  /**
   * Query string parameters
   * @since 1.0.0
   */
  readonly query?: Record<string, string | string[]>;
  
  /**
   * Request body data
   * @since 1.0.0
   */
  readonly body?: T;
  
  /**
   * Request context information
   * @since 1.0.0
   */
  readonly context: ApiRequestContext;
}

/**
 * Standard HTTP request headers
 * @interface
 * @since 1.0.0
 */
export interface RequestHeaders {
  /**
   * Authorization header value
   * @since 1.0.0
   */
  readonly authorization?: string;
  
  /**
   * Content-Type header value
   * @since 1.0.0
   */
  readonly contentType?: string;
  
  /**
   * Accept header value
   * @since 1.0.0
   */
  readonly accept?: string;
  
  /**
   * User-Agent header value
   * @since 1.0.0
   */
  readonly userAgent?: string;
  
  /**
   * Trace ID for distributed tracing
   * @since 1.0.0
   */
  readonly traceId?: string;
  
  /**
   * Additional custom headers
   * @since 1.0.0
   */
  readonly [key: string]: string | undefined;
}

/**
 * Request context metadata
 * @interface
 * @since 1.0.0
 */
export interface ApiRequestContext {
  /**
   * Unique request identifier
   * @since 1.0.0
   */
  readonly requestId: string;
  
  /**
   * Request timestamp
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * HTTP method (GET, POST, etc.)
   * @since 1.0.0
   */
  readonly method: string;
  
  /**
   * Request path
   * @since 1.0.0
   */
  readonly path: string;
  
  /**
   * Client IP address
   * @since 1.0.0
   */
  readonly ip?: string;
  
  /**
   * Authenticated user information
   * @since 1.0.0
   */
  readonly user?: RequestUser;
}

/**
 * Request user information
 * @interface
 * @since 1.0.0
 */
export interface RequestUser {
  /**
   * User identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * User email address
   * @since 1.0.0
   */
  readonly email?: string;
  
  /**
   * User roles for authorization
   * @since 1.0.0
   */
  readonly roles?: string[];
}

/**
 * Pagination parameters for list requests
 * @interface
 * @since 1.0.0
 */
export interface PaginationParams {
  /**
   * Page number (1-based)
   * @default 1
   * @since 1.0.0
   */
  readonly page?: number;
  
  /**
   * Number of items per page
   * @default 20
   * @since 1.0.0
   */
  readonly pageSize?: number;
  
  /**
   * Field to sort by
   * @since 1.0.0
   */
  readonly sortBy?: string;
  
  /**
   * Sort order
   * @default 'asc'
   * @since 1.0.0
   */
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Filter parameters for list requests
 * @interface
 * @since 1.0.0
 */
export interface FilterParams {
  /**
   * Search query string
   * @since 1.0.0
   */
  readonly search?: string;
  
  /**
   * Field-specific filters
   * @since 1.0.0
   */
  readonly filters?: Record<string, unknown>;
  
  /**
   * Filter by start date
   * @since 1.0.0
   */
  readonly dateFrom?: Date;
  
  /**
   * Filter by end date
   * @since 1.0.0
   */
  readonly dateTo?: Date;
}

/**
 * Request to create a new agent session
 * @interface
 * @since 1.0.0
 */
export interface CreateSessionRequest {
  /**
   * AI provider to use
   * @since 1.0.0
   */
  readonly provider: AgentProvider;
  
  /**
   * Provider-specific configuration
   * @since 1.0.0
   */
  readonly config?: Record<string, unknown>;
  
  /**
   * Session metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request to create a new task
 * @interface
 * @since 1.0.0
 */
export interface CreateTaskRequest {
  /**
   * Session ID to create task in
   * @since 1.0.0
   */
  readonly sessionId: string;
  
  /**
   * Type of task
   * @since 1.0.0
   */
  readonly type: TaskType;
  
  /**
   * Task title
   * @since 1.0.0
   */
  readonly title: string;
  
  /**
   * Task description
   * @since 1.0.0
   */
  readonly description: string;
  
  /**
   * Agent to assign task to
   * @since 1.0.0
   */
  readonly assignedTo?: AgentProvider;
  
  /**
   * Parent task ID for subtasks
   * @since 1.0.0
   */
  readonly parentTaskId?: string;
  
  /**
   * Task metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request to update an existing task
 * @interface
 * @since 1.0.0
 */
export interface UpdateTaskRequest {
  /**
   * New task status
   * @since 1.0.0
   */
  readonly status?: string;
  
  /**
   * Updated task title
   * @since 1.0.0
   */
  readonly title?: string;
  
  /**
   * Updated task description
   * @since 1.0.0
   */
  readonly description?: string;
  
  /**
   * Reassign task to different agent
   * @since 1.0.0
   */
  readonly assignedTo?: AgentProvider;
  
  /**
   * Updated task metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request to query an AI agent
 * @interface
 * @since 1.0.0
 */
export interface QueryAgentRequest {
  /**
   * Session ID for the query
   * @since 1.0.0
   */
  readonly sessionId: string;
  
  /**
   * Query prompt
   * @since 1.0.0
   */
  readonly prompt: string;
  
  /**
   * Additional context for the query
   * @since 1.0.0
   */
  readonly context?: Record<string, unknown>;
  
  /**
   * Query options
   * @since 1.0.0
   */
  readonly options?: QueryOptions;
}

/**
 * Options for agent queries
 * @interface
 * @since 1.0.0
 */
export interface QueryOptions {
  /**
   * Enable streaming response
   * @default false
   * @since 1.0.0
   */
  readonly streaming?: boolean;
  
  /**
   * Maximum tokens in response
   * @since 1.0.0
   */
  readonly maxTokens?: number;
  
  /**
   * Response temperature (0-2)
   * @since 1.0.0
   */
  readonly temperature?: number;
  
  /**
   * Enabled tools for this query
   * @since 1.0.0
   */
  readonly tools?: string[];
  
  /**
   * Query timeout in milliseconds
   * @since 1.0.0
   */
  readonly timeout?: number;
}

/**
 * Zod schema for pagination parameters
 * @since 1.0.0
 */
export const PaginationParamsSchema = z.object({
  page: z.coerce.number().positive().optional().default(1),
  pageSize: z.coerce.number().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
});

/**
 * Zod schema for filter parameters
 * @since 1.0.0
 */
export const FilterParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional()
});

/**
 * Zod schema for create session request
 * @since 1.0.0
 */
export const CreateSessionRequestSchema = z.object({
  provider: z.enum(['claude', 'gemini', 'custom']),
  config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Zod schema for create task request
 * @since 1.0.0
 */
export const CreateTaskRequestSchema = z.object({
  sessionId: z.string(),
  type: z.enum(['query', 'code_generation', 'code_review', 'refactoring', 'testing', 'documentation', 'custom']),
  title: z.string().min(1).max(255),
  description: z.string(),
  assignedTo: z.enum(['claude', 'gemini', 'custom']).optional(),
  parentTaskId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Zod schema for update task request
 * @since 1.0.0
 */
export const UpdateTaskRequestSchema = z.object({
  status: z.string().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  assignedTo: z.enum(['claude', 'gemini', 'custom']).optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Zod schema for query agent request
 * @since 1.0.0
 */
export const QueryAgentRequestSchema = z.object({
  sessionId: z.string(),
  prompt: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  options: z.object({
    streaming: z.boolean().optional(),
    maxTokens: z.number().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    tools: z.array(z.string()).optional(),
    timeout: z.number().positive().optional()
  }).optional()
});

/**
 * Parses and validates pagination parameters
 * @param {Record<string, unknown>} query - Query parameters
 * @returns {PaginationParams} Validated pagination parameters
 * @throws {z.ZodError} If validation fails
 * @since 1.0.0
 */
export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  return PaginationParamsSchema.parse(query);
}

/**
 * Parses and validates filter parameters
 * @param {Record<string, unknown>} query - Query parameters
 * @returns {FilterParams} Validated filter parameters
 * @throws {z.ZodError} If validation fails
 * @since 1.0.0
 */
export function parseFilterParams(query: Record<string, unknown>): FilterParams {
  return FilterParamsSchema.parse(query);
}

/**
 * Validates create session request data
 * @param {unknown} data - Request data to validate
 * @returns {CreateSessionRequest} Validated request
 * @throws {z.ZodError} If validation fails
 * @since 1.0.0
 */
export function validateCreateSessionRequest(data: unknown): CreateSessionRequest {
  return CreateSessionRequestSchema.parse(data);
}

/**
 * Validates create task request data
 * @param {unknown} data - Request data to validate
 * @returns {CreateTaskRequest} Validated request
 * @throws {z.ZodError} If validation fails
 * @since 1.0.0
 */
export function validateCreateTaskRequest(data: unknown): CreateTaskRequest {
  return CreateTaskRequestSchema.parse(data);
}

/**
 * Validates update task request data
 * @param {unknown} data - Request data to validate
 * @returns {UpdateTaskRequest} Validated request
 * @throws {z.ZodError} If validation fails
 * @since 1.0.0
 */
export function validateUpdateTaskRequest(data: unknown): UpdateTaskRequest {
  return UpdateTaskRequestSchema.parse(data);
}

/**
 * Validates query agent request data
 * @param {unknown} data - Request data to validate
 * @returns {QueryAgentRequest} Validated request
 * @throws {z.ZodError} If validation fails
 * @since 1.0.0
 */
export function validateQueryAgentRequest(data: unknown): QueryAgentRequest {
  return QueryAgentRequestSchema.parse(data);
}