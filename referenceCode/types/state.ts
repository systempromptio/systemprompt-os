/**
 * @fileoverview Application state type definitions
 * @module types/state
 */

import type { Task } from "./task.js";

/**
 * Application state metrics
 * @interface
 */
export interface StateMetrics {
  /**
   * Total number of tasks
   */
  total_tasks: number;
  
  /**
   * Number of completed tasks
   */
  completed_tasks: number;
  
  /**
   * Number of failed tasks
   */
  failed_tasks: number;
  
  /**
   * Average task completion time in milliseconds
   */
  average_completion_time: number;
}

/**
 * Session state structure
 * @interface
 */
export interface SessionState {
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
  
  /**
   * ISO timestamp when session was created
   */
  created_at: string;
  
  /**
   * Associated task ID
   */
  task_id?: string;
}

/**
 * Application state structure
 * @interface
 */
export interface ApplicationState {
  /**
   * All tasks in the system
   */
  tasks: Task[];
  
  /**
   * Active sessions
   */
  sessions: SessionState[];
  
  /**
   * Application metrics
   */
  metrics: StateMetrics;
  
  /**
   * ISO timestamp when state was last saved
   */
  last_saved: string;
}

/**
 * Task filter options
 * @interface
 */
export interface TaskFilter {
  /**
   * Filter by task status
   */
  status?: Task["status"];
  
  /**
   * Filter by assigned user/agent
   */
  assigned_to?: string;
}