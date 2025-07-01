/**
 * @fileoverview Constants for Agent Manager service
 * @module services/agent-manager/constants
 * @since 1.0.0
 * 
 * @remarks
 * This module contains constant values used throughout the agent manager service,
 * including session ID prefixes, log message prefixes, default values, and error codes.
 */

/**
 * Session ID prefixes for different agent types
 * 
 * @constant
 * @since 1.0.0
 * 
 * @remarks
 * Used to generate unique session IDs with type-specific prefixes
 */
export const SESSION_ID_PREFIXES = {
  /**
   * Prefix for Claude agent sessions
   */
  CLAUDE: 'agent_claude_'
} as const;

/**
 * Log message prefixes for consistent formatting
 * 
 * @constant
 * @since 1.0.0
 * 
 * @remarks
 * Empty strings indicate no prefix needed for that log type
 */
export const LOG_PREFIXES = {
  /**
   * Prefix for session creation logs
   */
  SESSION_CREATED: '',
  
  /**
   * Prefix for session context logs
   */
  SESSION_CONTEXT: '',
  
  /**
   * Prefix for session ending logs
   */
  SESSION_ENDING: '',
  
  /**
   * Prefix for session termination logs
   */
  SESSION_TERMINATED: '',
  
  /**
   * Prefix for session error logs
   */
  SESSION_ERROR: 'Error:',
  
  /**
   * Prefix for command sent logs
   */
  COMMAND_SENT: '',
  
  /**
   * Prefix for command error logs
   */
  COMMAND_ERROR: 'Error:',
  
  /**
   * Prefix for response received logs
   */
  RESPONSE_RECEIVED: '',
  
  /**
   * Prefix for response preview logs
   */
  RESPONSE_PREVIEW: ''
} as const;

/**
 * Default maximum number of turns for Claude conversations
 * 
 * @constant
 * @since 1.0.0
 */
export const DEFAULT_MAX_TURNS = 30;

/**
 * Maximum length of response preview in characters
 * 
 * @constant
 * @since 1.0.0
 */
export const RESPONSE_PREVIEW_LENGTH = 500;

/**
 * Standard error codes for agent manager operations
 * 
 * @constant
 * @since 1.0.0
 * 
 * @remarks
 * Used for programmatic error handling and logging
 */
export const ERROR_CODES = {
  /**
   * Session not found in session store
   */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  
  /**
   * Session is not in an active state
   */
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  
  /**
   * Unknown or unsupported session type
   */
  UNKNOWN_SESSION_TYPE: 'UNKNOWN_SESSION_TYPE',
  
  /**
   * Command execution failed
   */
  COMMAND_FAILED: 'COMMAND_FAILED'
} as const;