/**
 * @fileoverview Task Resource Content Type
 * @module types/resources/task-resource
 * 
 * @remarks
 * This defines the exact JSON structure returned in TextResourceContents.text
 * for task:// resources
 */

import type { Task } from '../task.js';

/**
 * Task session information
 * @interface
 */
export interface TaskSession {
  /**
   * Session identifier
   */
  id: string;
  
  /**
   * Session type (e.g., 'claude', 'gemini')
   */
  type: string;
  
  /**
   * Current session status
   */
  status: string;
}

/**
 * Task execution metadata
 * @interface
 */
export interface TaskMetadata {
  /**
   * Task execution duration in milliseconds
   */
  duration_ms?: number;
  
  /**
   * Estimated cost in USD
   */
  cost_usd?: number;
  
  /**
   * Token usage statistics
   */
  tokens?: {
    /**
     * Input tokens consumed
     */
    input: number;
    
    /**
     * Output tokens generated
     */
    output: number;
    
    /**
     * Cached tokens used
     */
    cached?: number;
  };
}

/**
 * Clean, concise Task Resource content
 * @interface
 */
export interface TaskResourceContent {
  /**
   * Task identifier
   */
  id: string;
  
  /**
   * Task description
   */
  description: string;
  
  /**
   * AI tool used
   */
  tool: string;
  
  /**
   * Current task status
   */
  status: Task['status'];
  
  /**
   * ISO timestamp when created
   */
  created_at: string;
  
  /**
   * ISO timestamp when last updated
   */
  updated_at: string;
  
  /**
   * Session information (if active)
   */
  session?: TaskSession;
  
  /**
   * Task execution result
   */
  result?: any;
  
  /**
   * Error message (if failed)
   */
  error?: string;
  
  /**
   * Performance metrics
   */
  metadata?: TaskMetadata;
  
  /**
   * Number of log entries
   */
  log_count: number;
}

/**
 * Create clean TaskResourceContent from a Task
 * @param {Task} task - Source task
 * @param {TaskSession} [session] - Optional session information
 * @param {TaskMetadata} [metadata] - Optional metadata
 * @returns {TaskResourceContent} Task resource content
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