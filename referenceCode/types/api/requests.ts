/**
 * @fileoverview API request type definitions and validation schemas
 * @module types/api/requests
 */

import { z } from 'zod';
import { AgentProvider } from '../core/agent.js';
import { TaskType } from '../task.js';

/**
 * Generic API request structure
 * @interface
 * @template T - Type of request body
 */
export interface ApiRequest<T = unknown> {
  /**
   * HTTP headers
   */
  readonly headers: RequestHeaders;
  
  /**
   * URL path parameters
   */
  readonly params?: Record<string, string>;
  
  /**
   * Query string parameters
   */
  readonly query?: Record<string, string | string[]>;
  
  /**
   * Request body data
   */
  readonly body?: T;
  
  /**
   * Request context information
   */
  readonly context: ApiRequestContext;
}

/**
 * Standard HTTP request headers
 * @interface
 */
export interface RequestHeaders {
  /**
   * Authorization header value
   */
  readonly authorization?: string;
  
  /**
   * Content-Type header value
   */
  readonly contentType?: string;
  
  /**
   * Accept header value
   */
  readonly accept?: string;
  
  /**
   * User-Agent header value
   */
  readonly userAgent?: string;
  
  /**
   * Trace ID for distributed tracing
   */
  readonly traceId?: string;
  
  /**
   * Additional custom headers
   */
  readonly [key: string]: string | undefined;
}

/**
 * Request context metadata
 * @interface
 */
export interface ApiRequestContext {
  /**
   * Unique request identifier
   */
  readonly requestId: string;
  
  /**
   * Request timestamp
   */
  readonly timestamp: Date;
  
  /**
   * HTTP method (GET, POST, etc.)
   */
  readonly method: string;
  
  /**
   * Request path
   */
  readonly path: string;
  
  /**
   * Client IP address
   */
  readonly ip?: string;
  
  /**
   * Authenticated user information
   */
  readonly user?: RequestUser;
}

/**
 * Request user information
 * @interface
 */
export interface RequestUser {
  /**
   * User identifier
   */
  readonly id: string;
  
  /**
   * User email address
   */
  readonly email?: string;
  
  /**
   * User roles for authorization
   */
  readonly roles?: string[];
}

/**
 * Pagination parameters for list requests
 * @interface
 */
export interface PaginationParams {
  /**
   * Page number (1-based)
   * @default 1
   */
  readonly page?: number;
  
  /**
   * Number of items per page
   * @default 20
   */
  readonly pageSize?: number;
  
  /**
   * Field to sort by
   */
  readonly sortBy?: string;
  
  /**
   * Sort order
   * @default 'asc'
   */
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Filter parameters for list requests
 * @interface
 */
export interface FilterParams {
  /**
   * Search query string
   */
  readonly search?: string;
  
  /**
   * Field-specific filters
   */
  readonly filters?: Record<string, unknown>;
  
  /**
   * Filter by start date
   */
  readonly dateFrom?: Date;
  
  /**
   * Filter by end date
   */
  readonly dateTo?: Date;
}

/**
 * Request to create a new agent session
 * @interface
 */
export interface CreateSessionRequest {
  /**
   * AI provider to use
   */
  readonly provider: AgentProvider;
  
  /**
   * Provider-specific configuration
   */
  readonly config?: Record<string, unknown>;
  
  /**
   * Session metadata
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request to create a new task
 * @interface
 */
export interface CreateTaskRequest {
  /**
   * Session ID to create task in
   */
  readonly sessionId: string;
  
  /**
   * Type of task
   */
  readonly type: TaskType;
  
  /**
   * Task title
   */
  readonly title: string;
  
  /**
   * Task description
   */
  readonly description: string;
  
  /**
   * Agent to assign task to
   */
  readonly assignedTo?: AgentProvider;
  
  /**
   * Parent task ID for subtasks
   */
  readonly parentTaskId?: string;
  
  /**
   * Task metadata
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request to update an existing task
 * @interface
 */
export interface UpdateTaskRequest {
  /**
   * New task status
   */
  readonly status?: string;
  
  /**
   * Updated task title
   */
  readonly title?: string;
  
  /**
   * Updated task description
   */
  readonly description?: string;
  
  /**
   * Reassign task to different agent
   */
  readonly assignedTo?: AgentProvider;
  
  /**
   * Updated task metadata
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request to query an AI agent
 * @interface
 */
export interface QueryAgentRequest {
  /**
   * Session ID for the query
   */
  readonly sessionId: string;
  
  /**
   * Query prompt
   */
  readonly prompt: string;
  
  /**
   * Additional context for the query
   */
  readonly context?: Record<string, unknown>;
  
  /**
   * Query options
   */
  readonly options?: QueryOptions;
}

/**
 * Options for agent queries
 * @interface
 */
export interface QueryOptions {
  /**
   * Enable streaming response
   * @default false
   */
  readonly streaming?: boolean;
  
  /**
   * Maximum tokens in response
   */
  readonly maxTokens?: number;
  
  /**
   * Response temperature (0-2)
   */
  readonly temperature?: number;
  
  /**
   * Enabled tools for this query
   */
  readonly tools?: string[];
  
  /**
   * Query timeout in milliseconds
   */
  readonly timeout?: number;
}

/**
 * Zod schema for pagination parameters
 */
export const PaginationParamsSchema = z.object({
  page: z.coerce.number().positive().optional().default(1),
  pageSize: z.coerce.number().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
});

/**
 * Zod schema for filter parameters
 */
export const FilterParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional()
});

/**
 * Zod schema for create session request
 */
export const CreateSessionRequestSchema = z.object({
  provider: z.enum(['claude', 'gemini', 'custom']),
  config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Zod schema for create task request
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
 */
export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  return PaginationParamsSchema.parse(query);
}

/**
 * Parses and validates filter parameters
 * @param {Record<string, unknown>} query - Query parameters
 * @returns {FilterParams} Validated filter parameters
 * @throws {z.ZodError} If validation fails
 */
export function parseFilterParams(query: Record<string, unknown>): FilterParams {
  return FilterParamsSchema.parse(query);
}

/**
 * Validates create session request data
 * @param {unknown} data - Request data to validate
 * @returns {CreateSessionRequest} Validated request
 * @throws {z.ZodError} If validation fails
 */
export function validateCreateSessionRequest(data: unknown): CreateSessionRequest {
  return CreateSessionRequestSchema.parse(data);
}

/**
 * Validates create task request data
 * @param {unknown} data - Request data to validate
 * @returns {CreateTaskRequest} Validated request
 * @throws {z.ZodError} If validation fails
 */
export function validateCreateTaskRequest(data: unknown): CreateTaskRequest {
  return CreateTaskRequestSchema.parse(data);
}

/**
 * Validates update task request data
 * @param {unknown} data - Request data to validate
 * @returns {UpdateTaskRequest} Validated request
 * @throws {z.ZodError} If validation fails
 */
export function validateUpdateTaskRequest(data: unknown): UpdateTaskRequest {
  return UpdateTaskRequestSchema.parse(data);
}

/**
 * Validates query agent request data
 * @param {unknown} data - Request data to validate
 * @returns {QueryAgentRequest} Validated request
 * @throws {z.ZodError} If validation fails
 */
export function validateQueryAgentRequest(data: unknown): QueryAgentRequest {
  return QueryAgentRequestSchema.parse(data);
}