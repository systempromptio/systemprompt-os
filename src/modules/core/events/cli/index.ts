/**
 * Events module CLI commands registry
 * MANDATORY: Export individual commands using named exports
 * MANDATORY: Export a default command metadata object for CLI registration.
 */

export { command as status } from '@/modules/core/events/cli/status';
export { command as list } from '@/modules/core/events/cli/list';
export { command as get } from '@/modules/core/events/cli/get';
export { command as emit } from '@/modules/core/events/cli/emit';
export { command as clear } from '@/modules/core/events/cli/clear';

/**
 * Module command metadata for CLI registration.
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
    },
    {
      name: 'list',
      description: 'List recent events with optional filtering',
      handler: 'events:list'
    },
    {
      name: 'get',
      description: 'Get details of a specific event by ID',
      handler: 'events:get'
    },
    {
      name: 'emit',
      description: 'Emit an event for testing and debugging',
      handler: 'events:emit'
    },
    {
      name: 'clear',
      description: 'Clear event history and/or subscriptions',
      handler: 'events:clear'
    }
  ]
};

export default eventsCommands;
