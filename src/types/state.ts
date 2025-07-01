/**
 * @fileoverview Application state type definitions
 * @module types/state
 * @since 1.0.0
 */

import type { Task } from "./task.js";

/**
 * Application state metrics
 * @interface
 * @since 1.0.0
 */
export interface StateMetrics {
  /**
   * Total number of tasks
   * @since 1.0.0
   */
  total_tasks: number;
  
  /**
   * Number of completed tasks
   * @since 1.0.0
   */
  completed_tasks: number;
  
  /**
   * Number of failed tasks
   * @since 1.0.0
   */
  failed_tasks: number;
  
  /**
   * Average task completion time in milliseconds
   * @since 1.0.0
   */
  average_completion_time: number;
}

/**
 * Session state structure
 * @interface
 * @since 1.0.0
 */
export interface SessionState {
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
  
  /**
   * ISO timestamp when session was created
   * @since 1.0.0
   */
  created_at: string;
  
  /**
   * Associated task ID
   * @since 1.0.0
   */
  task_id?: string;
}

/**
 * Application state structure
 * @interface
 * @since 1.0.0
 */
export interface ApplicationState {
  /**
   * All tasks in the system
   * @since 1.0.0
   */
  tasks: Task[];
  
  /**
   * Active sessions
   * @since 1.0.0
   */
  sessions: SessionState[];
  
  /**
   * Application metrics
   * @since 1.0.0
   */
  metrics: StateMetrics;
  
  /**
   * ISO timestamp when state was last saved
   * @since 1.0.0
   */
  last_saved: string;
}

/**
 * Task filter options
 * @interface
 * @since 1.0.0
 */
export interface TaskFilter {
  /**
   * Filter by task status
   * @since 1.0.0
   */
  status?: Task["status"];
  
  /**
   * Filter by assigned user/agent
   * @since 1.0.0
   */
  assigned_to?: string;
}