/**
 * Represents a log entry from the database.
 */
export interface ILogEntry {
  id: number;
  level: string;
  message: string;
  args: string | null;
  module: string | null;
  timestamp: string;
  session_id: string | null;
  user_id: string | null;
}

/**
 * Options for showing logs command.
 */
export interface IShowLogsOptions {
  limit?: number;
  level?: string;
  module?: string;
  since?: string;
  pager?: boolean;
  format?: string;
}
