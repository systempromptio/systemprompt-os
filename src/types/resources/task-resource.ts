/**
 * @fileoverview Task Resource Content Type
 * @module types/resources/task-resource
 * @since 1.0.0
 * 
 * @remarks
 * This defines the exact JSON structure returned in TextResourceContents.text
 * for task:// resources
 */

import type { Task } from '../task.js';

/**
 * Task session information
 * @interface
 * @since 1.0.0
 */
export interface TaskSession {
  /**
   * Session identifier
   * @since 1.0.0
   */
  id: string;
  
  /**
   * Session type (e.g., 'claude', 'gemini')
   * @since 1.0.0
   */
  type: string;
  
  /**
   * Current session status
   * @since 1.0.0
   */
  status: string;
}

/**
 * Task execution metadata
 * @interface
 * @since 1.0.0
 */
export interface TaskMetadata {
  /**
   * Task execution duration in milliseconds
   * @since 1.0.0
   */
  duration_ms?: number;
  
  /**
   * Estimated cost in USD
   * @since 1.0.0
   */
  cost_usd?: number;
  
  /**
   * Token usage statistics
   * @since 1.0.0
   */
  tokens?: {
    /**
     * Input tokens consumed
     * @since 1.0.0
     */
    input: number;
    
    /**
     * Output tokens generated
     * @since 1.0.0
     */
    output: number;
    
    /**
     * Cached tokens used
     * @since 1.0.0
     */
    cached?: number;
  };
}

/**
 * Clean, concise Task Resource content
 * @interface
 * @since 1.0.0
 */
export interface TaskResourceContent {
  /**
   * Task identifier
   * @since 1.0.0
   */
  id: string;
  
  /**
   * Task description
   * @since 1.0.0
   */
  description: string;
  
  /**
   * AI tool used
   * @since 1.0.0
   */
  tool: string;
  
  /**
   * Current task status
   * @since 1.0.0
   */
  status: Task['status'];
  
  /**
   * ISO timestamp when created
   * @since 1.0.0
   */
  created_at: string;
  
  /**
   * ISO timestamp when last updated
   * @since 1.0.0
   */
  updated_at: string;
  
  /**
   * Session information (if active)
   * @since 1.0.0
   */
  session?: TaskSession;
  
  /**
   * Task execution result
   * @since 1.0.0
   */
  result?: any;
  
  /**
   * Error message (if failed)
   * @since 1.0.0
   */
  error?: string;
  
  /**
   * Performance metrics
   * @since 1.0.0
   */
  metadata?: TaskMetadata;
  
  /**
   * Number of log entries
   * @since 1.0.0
   */
  log_count: number;
}

/**
 * Create clean TaskResourceContent from a Task
 * @param {Task} task - Source task
 * @param {TaskSession} [session] - Optional session information
 * @param {TaskMetadata} [metadata] - Optional metadata
 * @returns {TaskResourceContent} Task resource content
 * @since 1.0.0
 */
export function createTaskResourceContent(
  task: Task,
  session?: TaskSession,
  metadata?: TaskMetadata
): TaskResourceContent {
  return {
    id: task.id,
    description: task.description,
    tool: task.tool,
    status: task.status,
    created_at: task.created_at,
    updated_at: task.updated_at,
    session,
    result: task.result,
    error: task.error,
    metadata,
    log_count: task.logs?.length || 0
  };
}