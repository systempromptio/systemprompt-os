// Database row types are now auto-generated in database.generated.ts

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
