/**
 * Database CLI commands - Minimal interface.
 * @file Database CLI command definitions.
 * @module database/cli
 */

/**
 * Database command metadata for CLI registration.
 */
export const databaseCommands = {
  name: 'database',
  alias: 'db',
  description: 'Database management commands',
  subcommands: [
    {
      name: 'status',
      description: 'Check database connection status',
      handler: 'database:status'
    },
    {
      name: 'migrate',
      description: 'Run pending database migrations',
      handler: 'database:migrate'
    },
    {
      name: 'init',
      description: 'Initialize database with base schema',
      handler: 'database:init'
    }
  ]
};

/**
 * Export command metadata for CLI registration.
 */
export default databaseCommands;