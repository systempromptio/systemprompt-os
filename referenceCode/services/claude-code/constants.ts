/**
 * @fileoverview Constants for Claude Code service configuration
 * @module services/claude-code/constants
 * 
 * @remarks
 * This module provides centralized constants for the Claude Code service,
 * including timeouts, paths, error patterns, and environment variables.
 * These constants ensure consistency across the service implementation.
 */

/**
 * Default query timeout in milliseconds (30 seconds)
 */
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Host proxy operation timeout in milliseconds (5 minutes)
 */
export const HOST_PROXY_TIMEOUT_MS = 300000;

/**
 * Prefix for Claude session IDs
 */
export const SESSION_ID_PREFIX = 'claude_';

/**
 * Default host for proxy daemon connection
 */
export const DEFAULT_PROXY_HOST = 'host.docker.internal';

/**
 * Default port for proxy daemon connection
 */
export const DEFAULT_PROXY_PORT = 9876;

/**
 * Docker container workspace path
 */
export const DOCKER_WORKSPACE_PATH = '/workspace';

/**
 * Error message patterns for detection
 */
export const ERROR_PATTERNS = {
  /**
   * Pattern for insufficient credit balance
   */
  CREDIT_BALANCE: 'Credit balance is too low',
  
  /**
   * Pattern for invalid API key
   */
  INVALID_API_KEY: 'Invalid API key'
} as const;

/**
 * Log message prefixes for categorization
 */
export const LOG_PREFIXES = {
  /**
   * Prefix for assistant messages
   */
  ASSISTANT_MESSAGE: '[ASSISTANT_MESSAGE]',
  
  /**
   * Prefix for tool usage logs
   */
  TOOL_USE: '[TOOL_USE]',
  
  /**
   * Prefix for streaming data
   */
  STREAM_DATA: '[STREAM_DATA]',
  
  /**
   * Prefix for error messages
   */
  ERROR: '[ERROR]'
} as const;

/**
 * Environment variable names
 */
export const ENV_VARS = {
  /**
   * Anthropic API key
   */
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  
  /**
   * Host file system root path
   */
  HOST_FILE_ROOT: 'HOST_FILE_ROOT',
  
  /**
   * Claude proxy daemon host
   */
  CLAUDE_PROXY_HOST: 'CLAUDE_PROXY_HOST',
  
  /**
   * Claude proxy daemon port
   */
  CLAUDE_PROXY_PORT: 'CLAUDE_PROXY_PORT'
} as const;