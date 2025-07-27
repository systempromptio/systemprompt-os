/**
 * Users CLI commands.
 */
export { command as status } from '@/modules/core/users/cli/status';
export { command as create } from '@/modules/core/users/cli/create';
export { command as list } from '@/modules/core/users/cli/list';
export { command as get } from '@/modules/core/users/cli/get';

/**
 * Users command metadata for CLI registration.
 */
export const usersCommands = {
  name: 'users',
  alias: 'usr',
  description: 'User management commands',
  subcommands: [
    {
      name: 'status',
      description: 'Show users module status',
      handler: 'users:status'
    },
    {
      name: 'create',
      description: 'Create a new user',
      handler: 'users:create'
    },
    {
      name: 'list',
      description: 'List all users',
      handler: 'users:list'
    },
    {
      name: 'get',
      description: 'Get user information',
      handler: 'users:get'
    }
  ]
};

/**
 * Export command metadata for CLI registration.
 */
export default usersCommands;
