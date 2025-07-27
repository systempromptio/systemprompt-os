/**
 * Database row interface for tasks.
 */
export interface ITaskRow {
  id: number;
  type: string;
  module_id: string;
  payload: string | null;
  priority: number;
  status: string;
  retry_count: number;
  max_retries: number;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: string | null;
}

/**
 * Task status count result from database query.
 */
export interface ITaskStatusCount {
  status: string;
  count: number;
}

/**
 * Task type count result from database query.
 */
export interface ITaskTypeCount {
  type: string;
  count: number;
}

/**
 * Average time result from database query.
 */
export interface IAvgTimeResult {
  avg_time: number | null;
}

/**
 * Database query result for last insert rowid.
 */
export interface ILastInsertRowId {
  id: number;
}
