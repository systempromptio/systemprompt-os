/**
 * Tasks module CLI exports.
 * @file Tasks module CLI exports.
 * @module modules/core/tasks/cli
 */

import type { ICLICommandMap } from '@/modules/core/cli/types/manual';

// Import all commands
import { command as cancelCommand } from '@/modules/core/tasks/cli/cancel';
import { command as createCommand } from '@/modules/core/tasks/cli/create';
import { command as deleteCommand } from '@/modules/core/tasks/cli/delete';
import { command as getCommand } from '@/modules/core/tasks/cli/get';
import { command as listCommand } from '@/modules/core/tasks/cli/list';
import { command as statusCommand } from '@/modules/core/tasks/cli/status';
import { command as updateCommand } from '@/modules/core/tasks/cli/update';

// Export individual commands for direct use
export { command as cancel } from '@/modules/core/tasks/cli/cancel';
export { command as create } from '@/modules/core/tasks/cli/create';
export { command as delete } from '@/modules/core/tasks/cli/delete';
export { command as get } from '@/modules/core/tasks/cli/get';
export { command as list } from '@/modules/core/tasks/cli/list';
export { command as status } from '@/modules/core/tasks/cli/status';
export { command as update } from '@/modules/core/tasks/cli/update';

// CLI command registry
export const commands: ICLICommandMap = {
  cancel: cancelCommand,
  create: createCommand,
  delete: deleteCommand,
  get: getCommand,
  list: listCommand,
  status: statusCommand,
  update: updateCommand
};

// Command metadata for CLI registration
export const tasksCommands = {
  name: 'tasks',
  alias: 'task',
  description: 'Tasks module commands',
  subcommands: [
    {
      name: 'status',
      description: 'Show task module status and queue statistics',
      handler: 'tasks:status'
    },
    {
      name: 'list',
      description: 'List tasks in the queue',
      handler: 'tasks:list'
    },
    {
      name: 'create',
      description: 'Create a new task',
      handler: 'tasks:create'
    },
    {
      name: 'get',
      description: 'Get task details by ID',
      handler: 'tasks:get'
    },
    {
      name: 'update',
      description: 'Update an existing task',
      handler: 'tasks:update'
    },
    {
      name: 'cancel',
      description: 'Cancel a pending task',
      handler: 'tasks:cancel'
    },
    {
      name: 'delete',
      description: 'Delete tasks by type',
      handler: 'tasks:delete'
    }
  ]
};

export default tasksCommands;
