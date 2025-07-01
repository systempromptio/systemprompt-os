/**
 * @fileoverview Agent Manager service exports
 * @module services/agent-manager
 * @since 1.0.0
 * 
 * @remarks
 * This module serves as the main entry point for the agent manager service.
 * It exports all public APIs including the AgentManager class, types, errors,
 * constants, and interfaces needed to work with AI agents.
 * 
 * @example
 * ```typescript
 * import { 
 *   AgentManager, 
 *   AgentSession, 
 *   SessionNotFoundError 
 * } from './services/agent-manager';
 * 
 * const manager = AgentManager.getInstance();
 * 
 * try {
 *   const session = await manager.startClaudeSession({
 *     project_path: '/path/to/project',
 *     task_id: 'task-123'
 *   });
 * } catch (error) {
 *   if (error instanceof SessionNotFoundError) {
 *     console.error('Session not found');
 *   }
 * }
 * ```
 */

export { AgentManager } from './agent-manager.js';
export type { AgentManagerEvents } from './agent-manager.js';

export * from './types.js';
export * from './errors.js';
export * from './constants.js';
export * from './agent-interface.js';

/**
 * Singleton instance of AgentManager for backward compatibility
 * 
 * @constant
 * @since 1.0.0
 * @deprecated Use AgentManager.getInstance() instead
 */
import { AgentManager } from './agent-manager.js';
export const agentManager = AgentManager.getInstance();