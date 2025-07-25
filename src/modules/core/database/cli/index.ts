/**
 * Database CLI commands.
 */
export { command as status } from '@/modules/core/database/cli/status';
export { command as summary } from '@/modules/core/database/cli/summary';
export { command as view } from '@/modules/core/database/cli/view';
export { command as clear } from '@/modules/core/database/cli/clear';
export { command as rebuild } from '@/modules/core/database/cli/rebuild';

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
      name: 'summary',
      description: 'Show formatted summary of database tables and statistics',
      handler: 'database:summary'
    },
    {
      name: 'view',
      description: 'View table contents and data',
      handler: 'database:view'
    },
    {
      name: 'clear',
      description: 'Clear all data from database tables (preserves schema)',
      handler: 'database:clear'
    },
    {
      name: 'rebuild',
      description: 'Rebuild database - drop all tables and recreate from schema files',
      handler: 'database:rebuild'
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
