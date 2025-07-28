/**
 * Agents CLI commands.
 */
export { command as status } from '@/modules/core/agents/cli/status';
export { command as create } from '@/modules/core/agents/cli/create';
export { command as list } from '@/modules/core/agents/cli/list';
export { command as show } from '@/modules/core/agents/cli/show';
export { command as update } from '@/modules/core/agents/cli/update';
export { command as delete } from '@/modules/core/agents/cli/delete';

/**
 * Agents command metadata for CLI registration.
 */
export const agentsCommands = {
  name: 'agent',
  alias: 'agents',
  description: 'Agent management commands',
  subcommands: [
    {
      name: 'status',
      description: 'Show agents module status',
      handler: 'agent:status'
    },
    {
      name: 'create',
      description: 'Create a new agent',
      handler: 'agent:create'
    },
    {
      name: 'list',
      description: 'List all agents',
      handler: 'agent:list'
    },
    {
      name: 'show',
      description: 'Show agent details',
      handler: 'agent:show'
    },
    {
      name: 'update',
      description: 'Update an agent',
      handler: 'agent:update'
    },
    {
      name: 'delete',
      description: 'Delete an agent',
      handler: 'agent:delete'
    }
  ]
};

/**
 * Export command metadata for CLI registration.
 */
export default agentsCommands;
