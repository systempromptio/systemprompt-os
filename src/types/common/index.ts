/**
 * @fileoverview Common base types used across the application
 * @module types/common
 * @since 1.0.0
 */

/**
 * Base error interface that all error types should extend
 * @interface
 * @since 1.0.0
 */
export interface BaseError {
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
   * When the error occurred
   * @since 1.0.0
   */
  readonly timestamp?: Date;
}

/**
 * Common user identity information
 * @interface
 * @since 1.0.0
 */
export interface UserIdentity {
  /**
   * Unique user identifier
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
  
  /**
   * Specific permissions granted
   * @since 1.0.0
   */
  readonly permissions?: string[];
}

/**
 * Base metadata interface
 * @interface
 * @since 1.0.0
 */
export interface BaseMetadata {
  /**
   * Metadata timestamp
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * Additional metadata fields
   * @since 1.0.0
   */
  readonly [key: string]: unknown;
}

/**
 * Common status values for stateful entities
 * @since 1.0.0
 */
export type EntityStatus = 'idle' | 'initializing' | 'ready' | 'busy' | 'error' | 'terminated';

/**
 * Common tool call structure
 * @interface
 * @since 1.0.0
 */
export interface BaseToolCall {
  /**
   * Tool name to invoke
   * @since 1.0.0
   */
  readonly name: string;
  
  /**
   * Tool arguments
   * @since 1.0.0
   */
  readonly arguments?: unknown;
}

/**
 * Common tool result structure
 * @interface
 * @since 1.0.0
 */
export interface BaseToolResult {
  /**
   * Tool execution output
   * @since 1.0.0
   */
  readonly output?: unknown;
  
  /**
   * Error if tool execution failed
   * @since 1.0.0
   */
  readonly error?: BaseError;
}