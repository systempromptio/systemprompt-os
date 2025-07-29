// Auto-generated database types for cli module
// Generated on: 2025-07-29T15:52:59.255Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum CliCommandOptionsOptionType {
  STRING = 'string',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  ARRAY = 'array'
}

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
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: cli_command_options
 * Do not modify this file manually - it will be overwritten
 */
export interface ICliCommandOptionsRow {
  id: number;
  command_id: number;
  option_name: string;
  option_type: CliCommandOptionsOptionType;
  description: string;
  alias: string | null;
  default_value: string | null;
  required: boolean | null;
  choices: string | null;
  created_at: string | null;
}

/**
 * Generated from database table: cli_command_aliases
 * Do not modify this file manually - it will be overwritten
 */
export interface ICliCommandAliasesRow {
  id: number;
  command_id: number;
  alias: string;
  created_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type CliDatabaseRow = ICliCommandsRow | ICliCommandOptionsRow | ICliCommandAliasesRow;

/**
 * Database table names for this module
 */
export const CLI_TABLES = {
  CLICOMMANDS: 'cli_commands',
  CLICOMMANDOPTIONS: 'cli_command_options',
  CLICOMMANDALIASES: 'cli_command_aliases',
} as const;
