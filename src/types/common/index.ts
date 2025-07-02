/**
 * @fileoverview Common base types used across the application
 * @module types/common
 */

/**
 * Base error interface that all error types should extend
 * @interface
 */
export interface BaseError {
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
   * When the error occurred
   */
  readonly timestamp?: Date;
}

/**
 * Common user identity information
 * @interface
 */
export interface UserIdentity {
  /**
   * Unique user identifier
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
  
  /**
   * Specific permissions granted
   */
  readonly permissions?: string[];
}

/**
 * Base metadata interface
 * @interface
 */
export interface BaseMetadata {
  /**
   * Metadata timestamp
   */
  readonly timestamp: Date;
  
  /**
   * Additional metadata fields
   */
  readonly [key: string]: unknown;
}

/**
 * Common status values for stateful entities
 */
export type EntityStatus = 'idle' | 'initializing' | 'ready' | 'busy' | 'error' | 'terminated';

/**
 * Common tool call structure
 * @interface
 */
export interface BaseToolCall {
  /**
   * Tool name to invoke
   */
  readonly name: string;
  
  /**
   * Tool arguments
   */
  readonly arguments?: unknown;
}

/**
 * Common tool result structure
 * @interface
 */
export interface BaseToolResult {
  /**
   * Tool execution output
   */
  readonly output?: unknown;
  
  /**
   * Error if tool execution failed
   */
  readonly error?: BaseError;
}