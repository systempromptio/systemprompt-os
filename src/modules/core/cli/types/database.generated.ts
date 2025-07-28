// Auto-generated database types for cli module
// Generated on: 2025-07-28T20:02:59.643Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: cli_commands
 * Do not modify this file manually - it will be overwritten
 */
export interface ICliCommandsRow {
  id: number;
  module_name: string;
  command_name: string;
  command_path: string;
  description: string | null;
  executor_path: string;
  options: string | null;
  aliases: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: cli_command_history
 * Do not modify this file manually - it will be overwritten
 */
export interface ICliCommandHistoryRow {
  id: number;
  command_path: string;
  arguments: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  error_message: string | null;
  executed_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type CliDatabaseRow = ICliCommandsRow | ICliCommandHistoryRow;

/**
 * Database table names for this module
 */
export const CLI_TABLES = {
  CLICOMMANDS: 'cli_commands',
  CLICOMMANDHISTORY: 'cli_command_history',
} as const;
