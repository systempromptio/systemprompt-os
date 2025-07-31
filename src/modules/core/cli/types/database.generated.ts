// Auto-generated database types for cli module
// Generated on: 2025-07-31T10:03:21.448Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Enums generated from CHECK constraints
export enum CliCommandOptionsOptionType {
  STRING = 'string',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  ARRAY = 'array'
}

// Zod schemas for enums
export const CliCommandOptionsOptionTypeSchema = z.nativeEnum(CliCommandOptionsOptionType);

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

// Zod schemas for database row validation
export const CliCommandsRowSchema = z.object({
  id: z.number(),
  module_name: z.string(),
  command_name: z.string(),
  command_path: z.string(),
  description: z.string().nullable(),
  executor_path: z.string(),
  active: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const CliCommandOptionsRowSchema = z.object({
  id: z.number(),
  command_id: z.number(),
  option_name: z.string(),
  option_type: z.nativeEnum(CliCommandOptionsOptionType),
  description: z.string(),
  alias: z.string().nullable(),
  default_value: z.string().nullable(),
  required: z.boolean().nullable(),
  choices: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
});

export const CliCommandAliasesRowSchema = z.object({
  id: z.number(),
  command_id: z.number(),
  alias: z.string(),
  created_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type CliDatabaseRow = ICliCommandsRow | ICliCommandOptionsRow | ICliCommandAliasesRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const CliDatabaseRowSchema = z.union([CliCommandsRowSchema, CliCommandOptionsRowSchema, CliCommandAliasesRowSchema]);

/**
 * Database table names for this module
 */
export const CLI_TABLES = {
  CLICOMMANDS: 'cli_commands',
  CLICOMMANDOPTIONS: 'cli_command_options',
  CLICOMMANDALIASES: 'cli_command_aliases',
} as const;
