/**
 * CLI commands index for MCP module.
 * @file CLI commands index for MCP module.
 * @module modules/core/mcp/cli/index
 */

export { command as listCommand } from '@/modules/core/mcp/cli/list';
export { command as createCommand } from '@/modules/core/mcp/cli/create';
export { command as deleteCommand } from '@/modules/core/mcp/cli/delete';
export { command as statusCommand } from '@/modules/core/mcp/cli/status';

export const mcpCommands = {
  name: 'mcp',
  alias: 'mcp',
  description: 'MCP module commands',
  subcommands: [
    {
      name: 'create',
      description: 'Create a new MCP context',
      handler: 'mcp:create'
    },
    {
      name: 'list',
      description: 'List all configured MCP contexts',
      handler: 'mcp:list'
    },
    {
      name: 'delete',
      description: 'Delete an MCP context',
      handler: 'mcp:delete'
    },
    {
      name: 'status',
      description: 'Show MCP module status (enabled/healthy)',
      handler: 'mcp:status'
    }
  ]
};

export default mcpCommands;
