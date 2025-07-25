/**
 * @fileoverview MCP servers CLI commands
 * @module modules/core/mcp/cli/servers
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';
import { createServersListCommand } from './list.js';

export function createServersCommand(module: MCPModule): Command {
  const cmd = new Command('servers')
    .description('Manage MCP servers');

  // Add subcommands
  cmd.addCommand(createServersListCommand(module));

  return cmd;
}