/**
 * Events module CLI commands registry
 * MANDATORY: Export individual commands using named exports
 * MANDATORY: Export a default command metadata object for CLI registration
 */

export { command as status } from '@/modules/core/events/cli/status';

/**
 * Module command metadata for CLI registration
 */
export const eventsCommands = {
  name: 'events',
  alias: 'evt',
  description: 'Event bus management commands',
  subcommands: [
    {
      name: 'status',
      description: 'Show event bus statistics and recent events',
      handler: 'events:status'
    }
  ]
};

export default eventsCommands;
