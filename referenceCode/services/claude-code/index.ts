/**
 * @fileoverview Claude Code service public API exports
 * @module services/claude-code
 * 
 * @remarks
 * This module provides the public API for the Claude Code service.
 * It exports the main service class, types, errors, and constants.
 * A singleton instance is also exported for backward compatibility.
 * 
 * @example
 * ```typescript
 * // Import the service
 * import { ClaudeCodeService } from './services/claude-code';
 * 
 * // Or use the singleton
 * import { claudeCodeService } from './services/claude-code';
 * 
 * // Import types
 * import type { ClaudeCodeSession, ClaudeCodeOptions } from './services/claude-code';
 * 
 * // Import errors
 * import { SessionNotFoundError, QueryTimeoutError } from './services/claude-code';
 * ```
 */

export { ClaudeCodeService } from './claude-code-service.js';
export type { ClaudeCodeServiceEvents } from './claude-code-service.js';

export * from './types.js';
export * from './errors.js';
export * from './constants.js';

/**
 * Singleton instance of Claude Code service for backward compatibility
 * 
 * @deprecated Use ClaudeCodeService.getInstance() for better control
 */
import { ClaudeCodeService } from './claude-code-service.js';
export const claudeCodeService = ClaudeCodeService.getInstance();