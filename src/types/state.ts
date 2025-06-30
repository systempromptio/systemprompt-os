import type { Task } from "./task.js";

/**
 * Application state metrics
 */
export interface StateMetrics {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  average_completion_time: number;
}

/**
 * Session state structure
 */
export interface SessionState {
  id: string;
  type: string;
  status: string;
  created_at: string;
  task_id?: string;
}

/**
 * Application state structure
 */
export interface ApplicationState {
  tasks: Task[];
  sessions: SessionState[];
  metrics: StateMetrics;
  last_saved: string;
}

/**
 * Task filter options
 */
export interface TaskFilter {
  status?: Task["status"];
  assigned_to?: string;
}